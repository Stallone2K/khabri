import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { logUsage, addRateLimitHeaders } from "@/lib/api-middleware";

const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there",
  "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no",
  "just", "him", "know", "take", "people", "into", "year", "your",
  "good", "some", "could", "them", "see", "other", "than", "then",
  "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first",
  "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "may", "says", "has", "been",
]);

export async function GET(req: Request) {
  const reqStartTime = Date.now();
  const auth = await authenticateRequest(req, "trends");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(req.url);
    const hoursParam = parseInt(searchParams.get("hours") || "24");
    const hours = Math.max(1, Math.min(hoursParam, 48));
    const region = searchParams.get("region");

    // -----------------------------------------------------------------------
    // 1. Get the latest batch of ranked trends
    // -----------------------------------------------------------------------
    const latestTrend = await prisma.rankedTrend.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!latestTrend) {
      return NextResponse.json({ chartData: [], trends: [] });
    }

    const trendWhere: any = { userId, createdAt: latestTrend.createdAt };
    if (region === "DOMESTIC" || region === "INTERNATIONAL") {
      trendWhere.region = region;
    }

    const topTrends = await prisma.rankedTrend.findMany({
      where: trendWhere,
      orderBy: { rank: "asc" },
      take: 30,
      select: { id: true, topic: true, rank: true, originalUrl: true },
    });

    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // -----------------------------------------------------------------------
    // 2. Initialize hourly buckets
    // -----------------------------------------------------------------------
    const chartData: Record<string, any>[] = Array.from({ length: hours }, (_, i) => {
      const d = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      return {
        time: d.getHours().toString().padStart(2, "0") + ":00",
        timestamp: d.getTime(),
        ...topTrends.reduce(
          (acc, t) => ({ ...acc, [`trend_${t.rank}`]: 0 }),
          {},
        ),
      };
    });

    // -----------------------------------------------------------------------
    // 3. Extract keywords per trend topic
    // -----------------------------------------------------------------------
    const trendKeywords = topTrends.map((t) => {
      const words = t.topic
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
      return { ...t, words };
    });

    // -----------------------------------------------------------------------
    // 4. ONE query: fetch all signals in time range with enriched keywords
    // -----------------------------------------------------------------------
    const signals = await prisma.signal.findMany({
      where: {
        OR: [
          { publishedAt: { gte: startTime } },
          { createdAt: { gte: startTime } },
        ],
      },
      select: {
        id: true,
        url: true,
        title: true,
        publishedAt: true,
        createdAt: true,
        isEnriched: true,
        keywords: { select: { keyword: true } },
      },
    });

    // Pre-process signals
    const signalData = signals.map((s) => ({
      id: s.id,
      url: s.url,
      title: s.title.toLowerCase(),
      date: s.publishedAt > startTime ? s.publishedAt : s.createdAt,
      isEnriched: s.isEnriched,
      keywords: s.keywords.map((k) => k.keyword),
    }));

    // -----------------------------------------------------------------------
    // 5. HYBRID matching: enriched keywords when available, title fallback
    //
    //    Enriched signals: match if 1+ enriched keyword contains a trend word
    //    Non-enriched:     match if title contains 2+ trend words (AND logic)
    //    Either:           exact URL match always counts
    // -----------------------------------------------------------------------
    for (const trend of trendKeywords) {
      if (trend.words.length === 0 && !trend.originalUrl) continue;

      const seen = new Set<string>();

      for (const sig of signalData) {
        if (seen.has(sig.url)) continue;

        let matched = false;

        // URL exact match
        if (trend.originalUrl && sig.url === trend.originalUrl) {
          matched = true;
        }

        if (!matched && trend.words.length > 0) {
          if (sig.isEnriched && sig.keywords.length > 0) {
            // Enriched: count how many trend words appear in enriched keywords
            let overlap = 0;
            for (const tw of trend.words) {
              if (sig.keywords.some((k) => k.includes(tw))) overlap++;
            }
            // Require 2+ keyword matches for precision (enriched keywords are reliable)
            matched = overlap >= Math.min(2, trend.words.length);
          } else {
            // Non-enriched fallback: require 2+ trend words in the title (AND logic)
            let titleHits = 0;
            for (const tw of trend.words) {
              if (sig.title.includes(tw)) titleHits++;
            }
            matched = titleHits >= Math.min(2, trend.words.length);
          }
        }

        if (matched) {
          seen.add(sig.url);
          const sigTime = sig.date.getTime();
          const hourIndex = Math.floor(
            (sigTime - startTime.getTime()) / (60 * 60 * 1000),
          );
          if (hourIndex >= 0 && hourIndex < hours) {
            chartData[hourIndex][`trend_${trend.rank}`] += 1;
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 6. Return
    // -----------------------------------------------------------------------
    const response = NextResponse.json({
      chartData,
      trends: topTrends.map((t) => ({
        rank: t.rank,
        topic: t.topic,
        key: `trend_${t.rank}`,
      })),
    });
    if (auth.authMode === "apikey" && auth.keyId) {
      logUsage(auth.keyId, req, 200, Date.now() - reqStartTime).catch(() => {});
      addRateLimitHeaders(response, auth.rateLimit!, auth.remaining!, auth.resetMs!);
    }
    return response;
  } catch (error) {
    console.error("Graph API Error:", error);
    if (auth.authMode === "apikey" && auth.keyId) {
      logUsage(auth.keyId, req, 500, Date.now() - reqStartTime).catch(() => {});
    }
    return NextResponse.json({ error: "Graph failed" }, { status: 500 });
  }
}
