import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/monitor/summary
 * Situation-room data for the Monitor rail — what is HAPPENING, not internal
 * telemetry: top developments (ranked trends), hotspots with momentum,
 * global sentiment. Pure DB reads, no LLM, <200ms.
 */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const h24 = new Date(now - 24 * 3_600_000);
  const h48 = new Date(now - 48 * 3_600_000);

  const [
    signals24h,
    anomalies,
    anomalyList,
    latestBatch,
    hotspots,
    topEntities,
    sentiment,
    firehose,
    lastSignal,
    lastCycle,
  ] = await Promise.all([
    prisma.signal.count({ where: { createdAt: { gte: h24 } } }),
    prisma.anomalyEvent.groupBy({
      by: ["severity"],
      where: { isResolved: false },
      _count: true,
    }),
    prisma.anomalyEvent.findMany({
      where: { isResolved: false },
      orderBy: [{ severity: "desc" }, { zScore: "desc" }],
      take: 5,
      select: { label: true, severity: true, zScore: true, currentValue: true },
    }),
    // Top developments: newest ranked batch, HARD NEWS ONLY — a situation
    // room has an editorial line: no entertainment/sports/celebrity fluff.
    // (Everything is still browsable on /dashboard/signals.)
    prisma.$queryRaw<
      { topic: string; score: number; category: string | null; region: string | null }[]
    >`
      SELECT "topic", "score", "category", "region"
      FROM "RankedTrend"
      WHERE "createdAt" = (SELECT MAX("createdAt") FROM "RankedTrend")
        AND COALESCE("category", '') NOT IN ('ENTERTAINMENT', 'SPORTS')
        AND "score" >= 55
      ORDER BY "rank" ASC
      LIMIT 6
    `,
    // Hotspots with momentum: 24h volume + delta vs the previous 24h
    prisma.$queryRaw<
      { name: string; countryCode: string; count24: bigint; prev24: bigint }[]
    >`
      WITH counts AS (
        SELECT member."countryCode" AS cc,
               COUNT(DISTINCT sl."signalId") FILTER (WHERE s."createdAt" >= ${h24}) AS count24,
               COUNT(DISTINCT sl."signalId") FILTER (WHERE s."createdAt" >= ${h48} AND s."createdAt" < ${h24}) AS prev24
        FROM "Location" member
        JOIN "SignalLocation" sl ON sl."locationId" = member."id"
        JOIN "Signal" s ON s."id" = sl."signalId"
        WHERE s."createdAt" >= ${h48}
        GROUP BY member."countryCode"
      )
      SELECT c."name", c."countryCode", counts.count24, counts.prev24
      FROM counts
      JOIN "Location" c ON c."countryCode" = counts.cc AND c."type" = 'COUNTRY'
      WHERE counts.count24 > 2
      ORDER BY counts.count24 DESC
      LIMIT 7
    `,
    // Trending entities: most-mentioned people/orgs in 24h, hard-news
    // sources only (viral-trend and entertainment feeds excluded)
    prisma.$queryRaw<{ name: string; type: string; count: bigint }[]>`
      SELECT e."name", e."type", COUNT(DISTINCT e."signalId") AS count
      FROM "SignalEntity" e
      JOIN "Signal" s ON s."id" = e."signalId"
      WHERE s."createdAt" >= ${h24}
        AND e."type" IN ('PERSON', 'ORG', 'COMPANY', 'COUNTRY')
        AND s."source" NOT IN ('GoogleTrends', 'RedditRising')
        AND COALESCE(s."category", '') NOT ILIKE '%entertainment%'
        AND COALESCE(s."category", '') NOT ILIKE '%sport%'
      GROUP BY e."name", e."type"
      HAVING COUNT(DISTINCT e."signalId") > 1
      ORDER BY count DESC
      LIMIT 8
    `,
    prisma.$queryRaw<{ sentiment: string; count: bigint }[]>`
      SELECT "sentiment", COUNT(*) AS count
      FROM "Signal"
      WHERE "createdAt" >= ${h24} AND "sentiment" IS NOT NULL
      GROUP BY "sentiment"
    `,
    // The wire: latest raw headlines — hard-news sources only
    prisma.signal.findMany({
      where: {
        source: { notIn: ["GoogleTrends", "RedditRising"] },
        NOT: [
          { category: { contains: "entertainment", mode: "insensitive" } },
          { category: { contains: "sport", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, source: true, url: true, createdAt: true },
    }),
    prisma.signal.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.regionTrendCache.findFirst({
      orderBy: { computedAt: "desc" },
      select: { computedAt: true },
    }),
  ]);

  const severityCounts: Record<string, number> = {};
  for (const a of anomalies) severityCounts[a.severity] = a._count;

  const sentimentCounts: Record<string, number> = {};
  let sentimentTotal = 0;
  for (const s of sentiment) {
    sentimentCounts[s.sentiment] = Number(s.count);
    sentimentTotal += Number(s.count);
  }
  const pct = (k: string) =>
    sentimentTotal ? Math.round(((sentimentCounts[k] ?? 0) / sentimentTotal) * 100) : 0;

  const maxHot = Number(hotspots[0]?.count24 ?? 1);

  return NextResponse.json({
    signals24h,
    anomalies: {
      critical: severityCounts.CRITICAL ?? 0,
      high: severityCounts.HIGH ?? 0,
      elevated: severityCounts.ELEVATED ?? 0,
      total: Object.values(severityCounts).reduce((a, b) => a + b, 0),
    },
    topDevelopments: latestBatch.map((t, i) => ({
      rank: i + 1,
      topic: t.topic,
      score: t.score,
      category: t.category,
    })),
    hotspots: hotspots.map((h) => {
      const cur = Number(h.count24);
      const prev = Number(h.prev24);
      return {
        name: h.name,
        countryCode: h.countryCode,
        count: cur,
        pct: Math.round((cur / maxHot) * 100),
        deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0,
      };
    }),
    anomalyList: anomalyList.map((a) => ({
      label: a.label,
      severity: a.severity,
      zScore: Math.round(a.zScore * 10) / 10,
      count: a.currentValue,
    })),
    topEntities: topEntities.map((e) => ({
      name: e.name,
      type: e.type,
      count: Number(e.count),
    })),
    sentiment: {
      negative: pct("NEGATIVE"),
      neutral: pct("NEUTRAL") + pct("MIXED"),
      positive: pct("POSITIVE"),
      sampled: sentimentTotal,
    },
    firehose: firehose.map((s) => ({
      id: s.id,
      title: s.title.replace(/^\[Traffic: [^\]]+\] /, ""),
      source: s.source,
      url: s.url,
      createdAt: s.createdAt,
    })),
    lastSignalAt: lastSignal?.createdAt ?? null,
    lastCycleAt: lastCycle?.computedAt ?? null,
  });
}
