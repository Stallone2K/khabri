import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/api-auth";
import { gemini } from "@/lib/gemini";
import { buildTrendEnginePrompt } from "@/lib/prompts";
import { enrichSignals } from "@/lib/ingestion/signal-enricher";
import { emitEvent } from "@/lib/webhook-events";
import { ALL_CATEGORIES } from "@/lib/categories";

// ---------------------------------------------------------------------------
// RSS PARSER — configured with Google Trends custom fields + timeout
// ---------------------------------------------------------------------------
const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "Khabri/1.0 Intelligence Platform" },
  customFields: {
    item: [
      ["ht:approx_traffic", "traffic"],
      ["ht:news_item", "newsItem"],
    ],
  },
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Fetch a single feed with timeout. Returns parsed items or empty on failure. */
async function fetchFeed(
  feed: { id: string; url: string; sourceLabel: string; category: string },
): Promise<{
  feedId: string;
  items: {
    title: string;
    url: string;
    source: string;
    category: string;
    pubDate: Date;
    traffic: string | null;
  }[];
  error?: string;
}> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items = parsed.items.slice(0, 10).map((item: any) => ({
      title: item.title?.trim() || "No Title",
      url: item.link || "",
      source: feed.sourceLabel,
      category: feed.category,
      pubDate: item.isoDate ? new Date(item.isoDate) : new Date(),
      traffic: item.traffic ? item.traffic.replace(/\+/g, "") : null,
    }));
    return { feedId: feed.id, items };
  } catch (e: any) {
    return { feedId: feed.id, items: [], error: e.message || String(e) };
  }
}

/** Process feeds in batches to avoid overwhelming network/memory */
async function fetchFeedsInBatches(
  feeds: { id: string; url: string; sourceLabel: string; category: string }[],
  batchSize: number = 20,
) {
  const allResults: Awaited<ReturnType<typeof fetchFeed>>[] = [];

  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fetchFeed));

    for (const result of results) {
      if (result.status === "fulfilled") {
        allResults.push(result.value);
      }
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// MAIN PIPELINE (Cron-triggered — no session required)
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  // =========================================================================
  // 1. AUTHENTICATION — Cron secret or dev mode
  // =========================================================================
  const isCron = verifyCronSecret(req);
  const isDev = process.env.NODE_ENV === "development";
  if (!isCron && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up ALL active users with their category preferences
  const allUsers = await prisma.user.findMany({
    select: { id: true, countryCode: true, preferredCategories: true },
  });
  // Use the first user's country for the AI prompt (geo-classification)
  const userCountryCode = allUsers[0]?.countryCode || null;

  try {
    // =========================================================================
    // 2. LOAD ACTIVE FEEDS FROM CATALOG
    // =========================================================================
    const feeds = await prisma.feedCatalog.findMany({
      where: {
        isActive: true,
        consecutiveErrors: { lt: 5 },
      },
      select: { id: true, url: true, sourceLabel: true, category: true },
    });

    console.log(`[CRON-INGEST] Starting pipeline with ${feeds.length} active feeds`);

    if (feeds.length === 0) {
      return NextResponse.json({
        success: true,
        signalsIngested: 0,
        trendsGenerated: 0,
        message: "No active feeds in catalog. Run the seed script first.",
      });
    }

    // =========================================================================
    // 3. FETCH ALL FEEDS (batches of 20, 8s timeout each)
    // =========================================================================
    const feedResults = await fetchFeedsInBatches(feeds, 20);

    const successFeedIds: string[] = [];
    const failedFeedIds: string[] = [];

    const allItems: {
      title: string;
      url: string;
      source: string;
      category: string;
      pubDate: Date;
      traffic: string | null;
    }[] = [];

    for (const result of feedResults) {
      if (result.error) {
        failedFeedIds.push(result.feedId);
      } else if (result.items.length > 0) {
        successFeedIds.push(result.feedId);
        allItems.push(...result.items);
      } else {
        successFeedIds.push(result.feedId);
      }
    }

    console.log(
      `[CRON-INGEST] Fetched ${allItems.length} items from ${successFeedIds.length} feeds (${failedFeedIds.length} failed)`,
    );

    // =========================================================================
    // 4. BULK DEDUP
    // =========================================================================
    const validItems = allItems.filter((s) => s.url);
    const allUrls = validItems.map((s) => s.url);

    const existingSignals = await prisma.signal.findMany({
      where: { url: { in: allUrls } },
      select: { url: true },
    });
    const existingUrlSet = new Set(existingSignals.map((s) => s.url));

    const newItems = validItems.filter((s) => !existingUrlSet.has(s.url));

    const seenUrls = new Set<string>();
    const uniqueNewItems = newItems.filter((s) => {
      if (seenUrls.has(s.url)) return false;
      seenUrls.add(s.url);
      return true;
    });

    // =========================================================================
    // 5. BULK INSERT NEW SIGNALS
    // =========================================================================
    const signalsToCreate = uniqueNewItems.map((s) => ({
      title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
      url: s.url,
      source: s.source,
      category: s.category,
      publishedAt: s.pubDate,
    }));

    let newSignalsCount = 0;
    if (signalsToCreate.length > 0) {
      const result = await prisma.signal.createMany({
        data: signalsToCreate,
        skipDuplicates: true,
      });
      newSignalsCount = result.count;
    }

    console.log(`[CRON-INGEST] Ingested ${newSignalsCount} new signals`);

    // =========================================================================
    // 6. UPDATE FEED HEALTH
    // =========================================================================
    const now = new Date();

    if (successFeedIds.length > 0) {
      await prisma.feedCatalog.updateMany({
        where: { id: { in: successFeedIds } },
        data: { lastFetchedAt: now, consecutiveErrors: 0 },
      });
    }

    if (failedFeedIds.length > 0) {
      await prisma.$executeRaw`
        UPDATE "FeedCatalog"
        SET "consecutiveErrors" = "consecutiveErrors" + 1,
            "lastErrorAt" = ${now}
        WHERE "id" = ANY(${failedFeedIds})
      `;
    }

    // =========================================================================
    // 7. PREPARE SIGNALS FOR AI RANKING
    // =========================================================================
    let allSignalsToRank = uniqueNewItems.map((s) => ({
      title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
      url: s.url,
      source: s.source,
      category: s.category,
    }));

    if (allSignalsToRank.length < 15) {
      console.log(
        "[CRON-INGEST] Few new signals. Fetching recent from DB for context...",
      );
      const recentDbSignals = await prisma.signal.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
      });
      allSignalsToRank = recentDbSignals.map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source,
        category: s.category || "UNKNOWN",
      }));
    }

    // =========================================================================
    // 8. GROUP USERS BY CATEGORY PREFERENCES + AI RANKING PER GROUP
    // =========================================================================
    const preferenceGroups = new Map<string, typeof allUsers>();
    for (const user of allUsers) {
      const cats = user.preferredCategories && user.preferredCategories.length > 0
        ? [...user.preferredCategories].sort()
        : [...ALL_CATEGORIES];
      const key = JSON.stringify(cats);
      if (!preferenceGroups.has(key)) preferenceGroups.set(key, []);
      preferenceGroups.get(key)!.push(user);
    }

    console.log(`[CRON-INGEST] ${preferenceGroups.size} unique category preference group(s) to rank`);

    let totalTrendsGenerated = 0;
    let allRankedTrends: any[] = [];

    for (const [catKey, groupUsers] of preferenceGroups) {
      const categories = JSON.parse(catKey) as string[];

      // Send ALL signals but instruct Gemini to focus on user's categories
      const signalText = allSignalsToRank
        .slice(0, 120)
        .map((s) => {
          const prefix =
            s.source === "GoogleTrends" ? "**[HIGH TRAFFIC]** " : "";
          return `- [${s.source}][${s.category}] ${prefix}${s.title} (Link: ${s.url})`;
        })
        .join("\n");

      const isAllCategories = categories.length === ALL_CATEGORIES.length;
      const categoryInstruction = !isAllCategories
        ? `\n- IMPORTANT: The user is ONLY interested in these categories: ${categories.join(", ")}. ALL 30 trends you return MUST belong to one of these categories. Ignore signals that don't fit these categories. You MUST return exactly 30 trends — look broadly within these categories. Even if signals seem minor, include them to reach 30.`
        : "";

      const finalPrompt = `${buildTrendEnginePrompt(userCountryCode)}

SPECIAL INSTRUCTION:
- Prioritize items marked with "[HIGH TRAFFIC]" or from "GoogleTrends" if they also have strong narrative potential.
- These represent verified mass-interest topics.
- You are analyzing signals from ${successFeedIds.length} feeds across ${new Set(allSignalsToRank.map((s) => s.category)).size} categories.${categoryInstruction}

RAW SIGNALS (${allSignalsToRank.length} total):
${signalText}`;

      console.log(`[CRON-INGEST] Ranking ${allSignalsToRank.length} signals for [${categories.join(", ")}] (${groupUsers.length} user(s))`);

      const response = await gemini.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const responseText =
        response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const jsonString = responseText.replace(/```json|```/g, "").trim();

      let rankedTrends: any[] = [];
      try {
        rankedTrends = JSON.parse(jsonString);
      } catch (e) {
        console.error(`[CRON-INGEST] Failed to parse Gemini JSON for [${categories.join(", ")}]:`, responseText);
        continue;
      }

      // =========================================================================
      // 9. SAVE RANKED TRENDS — for users in this preference group
      // =========================================================================
      if (Array.isArray(rankedTrends) && rankedTrends.length > 0) {
        const trendData = rankedTrends.map((trend: any) => ({
          rank: trend.rank || 99,
          topic: trend.topic || "Unknown",
          score: trend.score || 0,
          reason: trend.reason || "",
          category: trend.category || null,
          region: trend.region || null,
          originalUrl: trend.original_url || null,
        }));

        await prisma.rankedTrend.createMany({
          data: groupUsers.flatMap((user) =>
            trendData.map((trend) => ({ ...trend, userId: user.id })),
          ),
        });

        totalTrendsGenerated += rankedTrends.length;
        allRankedTrends.push(...rankedTrends);

        // Emit webhook events for users in this group
        for (const user of groupUsers) {
          emitEvent("trend.new", {
            count: rankedTrends.length,
            topTrends: rankedTrends.slice(0, 5).map((t: any) => ({
              topic: t.topic,
              score: t.score,
              category: t.category,
            })),
          }, user.id);

          const spikes = rankedTrends.filter((t: any) => (t.score || 0) >= 90);
          for (const spike of spikes) {
            emitEvent("trend.spike", {
              topic: spike.topic,
              score: spike.score,
              category: spike.category,
              reason: spike.reason,
            }, user.id);
          }
        }
      }
    }

    // =========================================================================
    // 10. ENRICH NEW SIGNALS
    // =========================================================================
    console.log("[CRON-INGEST] Running enrichment on new signals...");
    const enrichStats = await enrichSignals(100);
    console.log(
      `[CRON-INGEST] Enrichment done: ${enrichStats.enrichedCount} enriched, ` +
        `${enrichStats.entitiesExtracted} entities, ${enrichStats.keywordsExtracted} keywords, ` +
        `${enrichStats.locationsExtracted} locations`,
    );

    console.log(
      `[CRON-INGEST] Pipeline complete: ${newSignalsCount} signals, ${totalTrendsGenerated} trends across ${preferenceGroups.size} group(s), ${enrichStats.enrichedCount} enriched`,
    );

    return NextResponse.json({
      success: true,
      feedsScanned: successFeedIds.length,
      feedsFailed: failedFeedIds.length,
      signalsIngested: newSignalsCount,
      trendsGenerated: totalTrendsGenerated,
      preferenceGroups: preferenceGroups.size,
      trends: allRankedTrends,
      enrichment: {
        enrichedCount: enrichStats.enrichedCount,
        entitiesExtracted: enrichStats.entitiesExtracted,
        keywordsExtracted: enrichStats.keywordsExtracted,
        locationsExtracted: enrichStats.locationsExtracted,
      },
    });
  } catch (error: any) {
    console.error("[CRON-INGEST] Pipeline Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: String(error?.message || error),
      },
      { status: 500 },
    );
  }
}
