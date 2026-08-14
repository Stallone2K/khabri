import { NextResponse } from "next/server";
import { after } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { gemini } from "@/lib/gemini";
import { buildTrendEnginePrompt } from "@/lib/prompts";
import { enrichSignals } from "@/lib/ingestion/signal-enricher";
import {
  chargeCredits,
  refundCredits,
  CREDIT_COSTS,
  InsufficientCreditsError,
  insufficientCreditsBody,
} from "@/lib/credits";

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
// BACKGROUND PIPELINE — for ONE user, filtered to their categories
// ---------------------------------------------------------------------------
async function runPipeline(userId: string, userCountryCode: string | null, userCategories: string[]) {
  try {
    // 1. Load ALL active feeds (feed categories don't match user preference categories)
    const feeds = await prisma.feedCatalog.findMany({
      where: { isActive: true, consecutiveErrors: { lt: 5 } },
      select: { id: true, url: true, sourceLabel: true, category: true },
    });

    if (feeds.length === 0) return;
    console.log(`[INGEST] Starting pipeline for user ${userId} with ${feeds.length} feeds (user wants: ${userCategories.length > 0 ? userCategories.join(", ") : "ALL"})`);

    // 2. Fetch feeds (batches of 20)
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
    let signalsToRank = uniqueNewItems.map((s) => ({
      title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
      url: s.url,
      source: s.source,
      category: s.category,
    }));

    if (signalsToRank.length < 15) {
      console.log("[INGEST] Few new signals. Fetching recent from DB for context...");
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

    const signalText = signalsToRank
      .slice(0, 120)
      .map((s) => {
        const prefix = s.source === "GoogleTrends" ? "**[HIGH TRAFFIC]** " : "";
        return `- [${s.source}][${s.category}] ${prefix}${s.title} (Link: ${s.url})`;
      })
      .join("\n");

    // 7. AI ranking (Gemini) — one call, scoped to user's preferred categories
    const categoryInstruction = userCategories.length > 0
      ? `\n- IMPORTANT: The user is ONLY interested in these categories: ${userCategories.join(", ")}. ALL 30 trends you return MUST belong to one of these categories. Ignore signals that don't fit these categories. You MUST return exactly 30 trends — look broadly within these categories. Even if signals seem minor, include them to reach 30.`
      : "";

    const finalPrompt = `${buildTrendEnginePrompt(userCountryCode)}

SPECIAL INSTRUCTION:
- Prioritize items marked with "[HIGH TRAFFIC]" or from "GoogleTrends" if they also have strong narrative potential.
- These represent verified mass-interest topics.
- You are analyzing signals from ${successFeedIds.length} feeds across ${new Set(signalsToRank.map((s) => s.category)).size} categories.${categoryInstruction}

RAW SIGNALS (${signalsToRank.length} total):
${signalText}`;

    console.log(`[INGEST] Sending ${signalsToRank.length} signals to Gemini for ranking`);

    const response = await gemini.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });

    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const jsonString = responseText.replace(/```json|```/g, "").trim();

    let rankedTrends: any[] = [];
    try {
      rankedTrends = JSON.parse(jsonString);
    } catch {
      console.error("[INGEST] Failed to parse Gemini JSON:", responseText);
      return;
    }

    // 8. Save ranked trends for this user
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

    // 9. Enrich
    const enrichStats = await enrichSignals(100);
    console.log(
      `[INGEST] Pipeline complete: ${newSignalsCount} signals, ${rankedTrends.length} trends, ${enrichStats.enrichedCount} enriched`,
    );
  } catch (error: any) {
    console.error("[INGEST] Background pipeline error:", error);
    throw error;
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
    select: { countryCode: true, preferredCategories: true },
  });
  const userCountryCode = user?.countryCode || null;
  const userCategories = user?.preferredCategories || [];

  let charged = 0;
  try {
    charged = await chargeCredits(userId, CREDIT_COSTS.INGEST_SCAN, {
      reason: "ingest_scan",
      refType: "IngestRun",
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(insufficientCreditsBody(), { status: 402 });
    }
    throw err;
  }

  // Pipeline runs AFTER response is sent
  after(async () => {
    try {
      await runPipeline(userId, userCountryCode, userCategories);
    } catch {
      if (charged > 0) {
        await refundCredits(userId, charged, {
          reason: "refund",
          refType: "IngestRun",
        }).catch((e) => console.error("[INGEST] Refund failed:", e));
      }
    }
  });

  return NextResponse.json({ started: true, creditsCharged: charged });
}
