import { NextResponse } from "next/server";
import { after } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { gemini } from "@/lib/gemini";
import { buildTrendEnginePrompt } from "@/lib/prompts";
import { enrichSignals } from "@/lib/ingestion/signal-enricher";

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

/** Dedup items against DB + seen set, insert signals, return unique items */
async function dedupAndInsert(items: FeedItem[], seenUrls: Set<string>) {
  const valid = items.filter((s) => s.url && !seenUrls.has(s.url));
  if (valid.length === 0) return { unique: [], inserted: 0 };

  const urls = valid.map((s) => s.url);
  const existing = await prisma.signal.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const existingSet = new Set(existing.map((s) => s.url));

  const unique: FeedItem[] = [];
  for (const item of valid) {
    if (!existingSet.has(item.url) && !seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      unique.push(item);
    }
  }

  let inserted = 0;
  if (unique.length > 0) {
    const result = await prisma.signal.createMany({
      data: unique.map((s) => ({
        title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
        url: s.url,
        source: s.source,
        category: s.category,
        publishedAt: s.pubDate,
      })),
      skipDuplicates: true,
    });
    inserted = result.count;
  }

  return { unique, inserted };
}

/** Rank signals with Gemini and save as RankedTrend */
async function rankAndSave(
  items: FeedItem[],
  userId: string,
  userCountryCode: string | null,
  feedCount: number,
) {
  let signalsToRank = items.map((s) => ({
    title: s.traffic ? `[Traffic: ${s.traffic}] ${s.title}` : s.title,
    url: s.url, source: s.source, category: s.category,
  }));

  // If few new signals, supplement with recent DB signals
  if (signalsToRank.length < 15) {
    const recent = await prisma.signal.findMany({
      orderBy: { createdAt: "desc" }, take: 80,
    });
    signalsToRank = recent.map((s) => ({
      title: s.title, url: s.url, source: s.source,
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

  const finalPrompt = `${buildTrendEnginePrompt(userCountryCode)}

SPECIAL INSTRUCTION:
- Prioritize items marked with "[HIGH TRAFFIC]" or from "GoogleTrends" if they also have strong narrative potential.
- These represent verified mass-interest topics.
- You are analyzing signals from ${feedCount} feeds across ${new Set(signalsToRank.map((s) => s.category)).size} categories.

RAW SIGNALS (${signalsToRank.length} total):
${signalText}`;

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
    console.error("[INGEST] Failed to parse Gemini JSON:", responseText);
    return 0;
  }

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

  return rankedTrends.length;
}

// ---------------------------------------------------------------------------
// BACKGROUND PIPELINE — processes in batches, saves trends after each batch
// so the frontend picks up new data within seconds
// ---------------------------------------------------------------------------
async function runPipeline(userId: string, userCountryCode: string | null) {
  try {
    const feeds = await prisma.feedCatalog.findMany({
      where: { isActive: true, consecutiveErrors: { lt: 5 } },
      select: { id: true, url: true, sourceLabel: true, category: true },
    });

    if (feeds.length === 0) return;
    console.log(`[INGEST] Starting batched pipeline with ${feeds.length} feeds`);

    const BATCH_SIZE = 30;
    const seenUrls = new Set<string>();
    const allSuccessIds: string[] = [];
    const allFailedIds: string[] = [];
    let totalSignals = 0;
    let totalTrends = 0;

    // Process in batches — each batch: fetch → dedup → insert → rank → save
    for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
      const batch = feeds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      // 1. Fetch this batch of feeds in parallel
      const results = await Promise.allSettled(batch.map(fetchFeed));
      const batchItems: FeedItem[] = [];

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const r = result.value;
        if (r.error) {
          allFailedIds.push(r.feedId);
        } else {
          allSuccessIds.push(r.feedId);
          batchItems.push(...r.items);
        }
      }

      // 2. Dedup + insert signals
      const { unique, inserted } = await dedupAndInsert(batchItems, seenUrls);
      totalSignals += inserted;

      // 3. Rank with AI and save to DB immediately
      if (unique.length > 0) {
        const trendsCount = await rankAndSave(
          unique, userId, userCountryCode, allSuccessIds.length,
        );
        totalTrends += trendsCount;
        console.log(`[INGEST] Batch ${batchNum}: ${inserted} signals, ${trendsCount} trends saved`);
      }
    }

    // Update feed health after all batches
    const now = new Date();
    if (allSuccessIds.length > 0) {
      await prisma.feedCatalog.updateMany({
        where: { id: { in: allSuccessIds } },
        data: { lastFetchedAt: now, consecutiveErrors: 0 },
      });
    }
    if (allFailedIds.length > 0) {
      await prisma.$executeRaw`
        UPDATE "FeedCatalog"
        SET "consecutiveErrors" = "consecutiveErrors" + 1,
            "lastErrorAt" = ${now}
        WHERE "id" = ANY(${allFailedIds})
      `;
    }

    // Enrich at the end
    const enrichStats = await enrichSignals(100);
    console.log(
      `[INGEST] Pipeline complete: ${totalSignals} signals, ${totalTrends} trends, ${enrichStats.enrichedCount} enriched`,
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

  // Pipeline runs AFTER response is sent — processes in batches,
  // saving trends after each batch so polls pick them up quickly
  after(async () => {
    await runPipeline(userId, userCountryCode);
  });

  return NextResponse.json({ started: true });
}
