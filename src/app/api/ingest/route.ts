import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { gemini } from "@/lib/gemini";
import { buildTrendEnginePrompt } from "@/lib/prompts";
import { enrichSignals } from "@/lib/ingestion/signal-enricher";

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
// MAIN PIPELINE
// ---------------------------------------------------------------------------
export async function POST() {
  // =========================================================================
  // 1. AUTHENTICATION
  // =========================================================================
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized & No Fallback User Found" },
      { status: 401 },
    );
  }

  // Fetch user's country for geographic trend classification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { countryCode: true },
  });
  const userCountryCode = user?.countryCode || null;

  try {
    // =========================================================================
    // 2. LOAD ACTIVE FEEDS FROM CATALOG
    // =========================================================================
    const feeds = await prisma.feedCatalog.findMany({
      where: {
        isActive: true,
        consecutiveErrors: { lt: 5 }, // Circuit breaker: skip broken feeds
      },
      select: { id: true, url: true, sourceLabel: true, category: true },
    });

    console.log(`[INGEST] Starting pipeline with ${feeds.length} active feeds`);

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

    // Separate successes and failures for health tracking
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
        // Feed returned 0 items but no error — still counts as success
        successFeedIds.push(result.feedId);
      }
    }

    console.log(
      `[INGEST] Fetched ${allItems.length} items from ${successFeedIds.length} feeds (${failedFeedIds.length} failed)`,
    );

    // =========================================================================
    // 4. BULK DEDUP (single query instead of N+1)
    // =========================================================================
    // Filter out items without URLs
    const validItems = allItems.filter((s) => s.url);

    // Collect all URLs for bulk lookup
    const allUrls = validItems.map((s) => s.url);

    // Single query to find existing URLs
    const existingSignals = await prisma.signal.findMany({
      where: { url: { in: allUrls } },
      select: { url: true },
    });
    const existingUrlSet = new Set(existingSignals.map((s) => s.url));

    // Filter to only new signals
    const newItems = validItems.filter((s) => !existingUrlSet.has(s.url));

    // Deduplicate by URL within the current batch (in case multiple feeds have same URL)
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

    console.log(`[INGEST] Ingested ${newSignalsCount} new signals`);

    // =========================================================================
    // 6. UPDATE FEED HEALTH
    // =========================================================================
    const now = new Date();

    // Mark successful feeds
    if (successFeedIds.length > 0) {
      await prisma.feedCatalog.updateMany({
        where: { id: { in: successFeedIds } },
        data: { lastFetchedAt: now, consecutiveErrors: 0 },
      });
    }

    // Increment error count for failed feeds
    if (failedFeedIds.length > 0) {
      // Use raw query for atomic increment
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
    let signalsToRank = uniqueNewItems.map((s) => ({
      title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
      url: s.url,
      source: s.source,
      category: s.category,
    }));

    // If few new signals (e.g. re-run), fetch recent ones from DB
    if (signalsToRank.length < 15) {
      console.log(
        "[INGEST] Few new signals. Fetching recent from DB for context...",
      );
      const recentDbSignals = await prisma.signal.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
      });
      signalsToRank = recentDbSignals.map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source,
        category: s.category || "UNKNOWN",
      }));
    }

    // Format for AI — cap at 120 signals for context window
    const signalText = signalsToRank
      .slice(0, 120)
      .map((s) => {
        const prefix =
          s.source === "GoogleTrends" ? "**[HIGH TRAFFIC]** " : "";
        return `- [${s.source}][${s.category}] ${prefix}${s.title} (Link: ${s.url})`;
      })
      .join("\n");

    // =========================================================================
    // 8. AI RANKING (Gemini)
    // =========================================================================
    console.log("[INGEST] Sending to Gemini for ranking...");

    const finalPrompt = `${buildTrendEnginePrompt(userCountryCode)}

SPECIAL INSTRUCTION:
- Prioritize items marked with "[HIGH TRAFFIC]" or from "GoogleTrends" if they also have strong narrative potential.
- These represent verified mass-interest topics.
- You are analyzing signals from ${successFeedIds.length} feeds across ${new Set(signalsToRank.map((s) => s.category)).size} categories.

RAW SIGNALS (${signalsToRank.length} total):
${signalText}`;

    const response = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText =
      response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const jsonString = responseText.replace(/```json|```/g, "").trim();

    let rankedTrends = [];
    try {
      rankedTrends = JSON.parse(jsonString);
    } catch (e) {
      console.error("[INGEST] Failed to parse Gemini JSON:", responseText);
      return NextResponse.json(
        { error: "AI Parsing Failed", raw: responseText },
        { status: 500 },
      );
    }

    // =========================================================================
    // 9. SAVE RANKED TRENDS (append — keep history for pagination)
    // =========================================================================
    if (Array.isArray(rankedTrends) && rankedTrends.length > 0) {
      await prisma.rankedTrend.createMany({
        data: rankedTrends.map((trend: any) => ({
          rank: trend.rank || 99,
          topic: trend.topic || "Unknown",
          score: trend.score || 0,
          reason: trend.reason || "",
          category: trend.category || null,
          region: trend.region || null,
          originalUrl: trend.original_url || null,
          userId,
        })),
      });
    }

    // =========================================================================
    // 10. ENRICH NEW SIGNALS (entity/keyword/location/sentiment extraction)
    // =========================================================================
    console.log("[INGEST] Running enrichment on new signals...");
    const enrichStats = await enrichSignals(100);
    console.log(
      `[INGEST] Enrichment done: ${enrichStats.enrichedCount} enriched, ` +
        `${enrichStats.entitiesExtracted} entities, ${enrichStats.keywordsExtracted} keywords, ` +
        `${enrichStats.locationsExtracted} locations`,
    );

    console.log(
      `[INGEST] Pipeline complete: ${newSignalsCount} signals, ${rankedTrends.length} trends, ${enrichStats.enrichedCount} enriched`,
    );

    return NextResponse.json({
      success: true,
      feedsScanned: successFeedIds.length,
      feedsFailed: failedFeedIds.length,
      signalsIngested: newSignalsCount,
      trendsGenerated: rankedTrends.length,
      trends: rankedTrends,
      enrichment: {
        enrichedCount: enrichStats.enrichedCount,
        entitiesExtracted: enrichStats.entitiesExtracted,
        keywordsExtracted: enrichStats.keywordsExtracted,
        locationsExtracted: enrichStats.locationsExtracted,
      },
    });
  } catch (error: any) {
    console.error("[INGEST] Pipeline Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: String(error?.message || error),
      },
      { status: 500 },
    );
  }
}
