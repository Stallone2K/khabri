import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/monitor/summary
 * Everything the Monitor's right rail needs in one read — all derived from
 * data, no hardcoded geographies. Pure DB aggregation, no LLM, <200ms.
 */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const h24 = new Date(now - 24 * 3_600_000);
  const d7 = new Date(now - 7 * 24 * 3_600_000);

  const [
    signals24h,
    signals7d,
    anomalies,
    topCountries,
    topCategories,
    lastSignal,
    lastCycle,
  ] = await Promise.all([
    prisma.signal.count({ where: { createdAt: { gte: h24 } } }),
    prisma.signal.count({ where: { createdAt: { gte: d7 } } }),
    prisma.anomalyEvent.groupBy({
      by: ["severity"],
      where: { isResolved: false },
      _count: true,
    }),
    prisma.$queryRaw<{ name: string; countryCode: string; count: bigint }[]>`
      SELECT c."name", c."countryCode", COUNT(DISTINCT sl."signalId") AS count
      FROM "Location" c
      JOIN "Location" member ON member."countryCode" = c."countryCode"
      JOIN "SignalLocation" sl ON sl."locationId" = member."id"
      JOIN "Signal" s ON s."id" = sl."signalId"
      WHERE c."type" = 'COUNTRY'
        AND s."createdAt" > ${d7}
      GROUP BY c."name", c."countryCode"
      ORDER BY count DESC
      LIMIT 8
    `,
    prisma.$queryRaw<{ category: string; count: bigint }[]>`
      SELECT COALESCE("category", 'OTHER') AS category, COUNT(*) AS count
      FROM "Signal"
      WHERE "createdAt" > ${h24}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 6
    `,
    prisma.signal.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.regionTrendCache.findFirst({
      orderBy: { computedAt: "desc" },
      select: { computedAt: true },
    }),
  ]);

  const severityCounts: Record<string, number> = {};
  for (const a of anomalies) severityCounts[a.severity] = a._count;

  const maxCountry = Number(topCountries[0]?.count ?? 1);

  return NextResponse.json({
    signals24h,
    signals7d,
    anomalies: {
      critical: severityCounts.CRITICAL ?? 0,
      high: severityCounts.HIGH ?? 0,
      elevated: severityCounts.ELEVATED ?? 0,
      total: Object.values(severityCounts).reduce((a, b) => a + b, 0),
    },
    topLocations: topCountries.map((c) => ({
      name: c.name,
      countryCode: c.countryCode,
      count: Number(c.count),
      pct: Math.round((Number(c.count) / maxCountry) * 100),
    })),
    topCategories: topCategories.map((c) => ({ name: c.category, count: Number(c.count) })),
    lastSignalAt: lastSignal?.createdAt ?? null,
    lastCycleAt: lastCycle?.computedAt ?? null,
  });
}
