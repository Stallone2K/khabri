import { NextResponse } from "next/server";
import { after } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { gemini } from "@/lib/gemini";
import { buildTrendEnginePrompt } from "@/lib/prompts";
import { enrichSignals } from "@/lib/ingestion/signal-enricher";
import { ALL_CATEGORIES } from "@/lib/categories";

// ---------------------------------------------------------------------------
// RSS PARSER
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
// TYPES
// ---------------------------------------------------------------------------
type FeedDef = { id: string; url: string; sourceLabel: string; category: string };
type FeedItem = {
  title: string; url: string; source: string;
  category: string; pubDate: Date; traffic: string | null;
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

async function fetchFeed(feed: FeedDef): Promise<{
  feedId: string; items: FeedItem[]; error?: string;
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

/** Fetch feeds in batches to avoid overwhelming network */
async function fetchFeedsInBatches(feeds: FeedDef[], batchSize: number = 20) {
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
// BACKGROUND PIPELINE — fetches all feeds, then ranks everything at once
// ---------------------------------------------------------------------------
async function runPipeline(userCountryCode: string | null) {
  try {
    // 1. Load active feeds
    const feeds = await prisma.feedCatalog.findMany({
      where: { isActive: true, consecutiveErrors: { lt: 5 } },
      select: { id: true, url: true, sourceLabel: true, category: true },
    });

    if (feeds.length === 0) return;
    console.log(`[INGEST] Starting pipeline with ${feeds.length} feeds`);

    // 2. Fetch all feeds (batches of 20 for network)
    const feedResults = await fetchFeedsInBatches(feeds, 20);

    const successFeedIds: string[] = [];
    const failedFeedIds: string[] = [];
    const allItems: FeedItem[] = [];

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
      `[INGEST] Fetched ${allItems.length} items from ${successFeedIds.length} feeds (${failedFeedIds.length} failed)`,
    );

    // 3. Bulk dedup
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

    // 4. Bulk insert new signals
    let newSignalsCount = 0;
    if (uniqueNewItems.length > 0) {
      const result = await prisma.signal.createMany({
        data: uniqueNewItems.map((s) => ({
          title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
          url: s.url,
          source: s.source,
          category: s.category,
          publishedAt: s.pubDate,
        })),
        skipDuplicates: true,
      });
      newSignalsCount = result.count;
    }

    console.log(`[INGEST] Ingested ${newSignalsCount} new signals`);

    // 5. Update feed health
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

    // 6. Prepare signals for AI ranking
    let allSignalsToRank = uniqueNewItems.map((s) => ({
      title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
      url: s.url,
      source: s.source,
      category: s.category,
    }));

    if (allSignalsToRank.length < 15) {
      console.log("[INGEST] Few new signals. Fetching recent from DB for context...");
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

    // 7. Group users by category preferences + AI ranking per group
    const allUsers = await prisma.user.findMany({
      select: { id: true, countryCode: true, preferredCategories: true },
    });

    const preferenceGroups = new Map<string, typeof allUsers>();
    for (const user of allUsers) {
      const cats = user.preferredCategories && user.preferredCategories.length > 0
        ? [...user.preferredCategories].sort()
        : [...ALL_CATEGORIES];
      const key = JSON.stringify(cats);
      if (!preferenceGroups.has(key)) preferenceGroups.set(key, []);
      preferenceGroups.get(key)!.push(user);
    }

    console.log(`[INGEST] ${preferenceGroups.size} unique category preference group(s) to rank`);

    let totalTrendsGenerated = 0;

    for (const [catKey, groupUsers] of preferenceGroups) {
      const categories = JSON.parse(catKey) as string[];

      const groupSignals = allSignalsToRank.filter((s) =>
        categories.includes(s.category)
      );

      if (groupSignals.length === 0) {
        console.log(`[INGEST] No signals for categories [${categories.join(", ")}], skipping`);
        continue;
      }

      const signalText = groupSignals
        .slice(0, 120)
        .map((s) => {
          const prefix = s.source === "GoogleTrends" ? "**[HIGH TRAFFIC]** " : "";
          return `- [${s.source}][${s.category}] ${prefix}${s.title} (Link: ${s.url})`;
        })
        .join("\n");

      const finalPrompt = `${buildTrendEnginePrompt(userCountryCode)}

SPECIAL INSTRUCTION:
- Prioritize items marked with "[HIGH TRAFFIC]" or from "GoogleTrends" if they also have strong narrative potential.
- These represent verified mass-interest topics.
- You are analyzing signals from ${successFeedIds.length} feeds across ${new Set(groupSignals.map((s) => s.category)).size} categories.

RAW SIGNALS (${groupSignals.length} total):
${signalText}`;

      console.log(`[INGEST] Ranking ${groupSignals.length} signals for [${categories.join(", ")}] (${groupUsers.length} user(s))`);

      const response = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
        config: { responseMimeType: "application/json", temperature: 0.2 },
      });

      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const jsonString = responseText.replace(/```json|```/g, "").trim();

      let rankedTrends: any[] = [];
      try {
        rankedTrends = JSON.parse(jsonString);
      } catch {
        console.error(`[INGEST] Failed to parse Gemini JSON for [${categories.join(", ")}]:`, responseText);
        continue;
      }

      // 8. Save ranked trends for users in this preference group
      if (Array.isArray(rankedTrends) && rankedTrends.length > 0) {
        await prisma.rankedTrend.createMany({
          data: groupUsers.flatMap((user) =>
            rankedTrends.map((trend: any) => ({
              rank: trend.rank || 99,
              topic: trend.topic || "Unknown",
              score: trend.score || 0,
              reason: trend.reason || "",
              category: trend.category || null,
              region: trend.region || null,
              originalUrl: trend.original_url || null,
              userId: user.id,
            })),
          ),
        });

        totalTrendsGenerated += rankedTrends.length;
      }
    }

    // 9. Enrich
    const enrichStats = await enrichSignals(100);
    console.log(
      `[INGEST] Pipeline complete: ${newSignalsCount} signals, ${totalTrendsGenerated} trends across ${preferenceGroups.size} group(s), ${enrichStats.enrichedCount} enriched`,
    );
  } catch (error: any) {
    console.error("[INGEST] Background pipeline error:", error);
  }
}

// ---------------------------------------------------------------------------
// ROUTE HANDLER — responds instantly, pipeline runs in background
// ---------------------------------------------------------------------------
export async function POST() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized & No Fallback User Found" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { countryCode: true },
  });
  const userCountryCode = user?.countryCode || null;

  // Pipeline runs AFTER response is sent
  after(async () => {
    await runPipeline(userCountryCode);
  });

  return NextResponse.json({ started: true });
}
