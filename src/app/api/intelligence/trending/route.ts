import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { logUsage, addRateLimitHeaders } from "@/lib/api-middleware";

export async function GET(req: Request) {
  const startTime = Date.now();
  const auth = await authenticateRequest(req, "anomalies");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const typeFilter = searchParams.get("type"); // "keyword" | "entity" | "all"

    // Fetch top active anomalies by z-score
    const typeWhere: any = { isResolved: false };
    if (typeFilter === "keyword") typeWhere.type = "KEYWORD_SPIKE";
    else if (typeFilter === "entity") typeWhere.type = "ENTITY_SURGE";

    const anomalies = await prisma.anomalyEvent.findMany({
      where: typeWhere,
      orderBy: { zScore: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        key: true,
        label: true,
        zScore: true,
        severity: true,
        currentValue: true,
        baselineMean: true,
      },
    });

    // Generate sparklines for each item — last 24 hours of hourly counts
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const items = await Promise.all(
      anomalies.map(async (anomaly) => {
        const dimension =
          anomaly.type === "KEYWORD_SPIKE" ? "KEYWORD" :
          anomaly.type === "ENTITY_SURGE" ? "ENTITY" :
          anomaly.type === "GEO_CONCENTRATION" ? "COUNTRY" : "SENTIMENT";

        let sparkline: number[] = [];

        try {
          if (dimension === "KEYWORD" || dimension === "SENTIMENT") {
            const keyword = dimension === "SENTIMENT"
              ? anomaly.key.replace("sentiment::", "")
              : anomaly.key;

            const hourlyData = await prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
              SELECT date_trunc('hour', s."createdAt") as hour, COUNT(*) as count
              FROM "SignalKeyword" sk
              JOIN "Signal" s ON sk."signalId" = s."id"
              WHERE sk."keyword" = ${keyword}
                AND s."createdAt" >= ${twentyFourHoursAgo}
              GROUP BY date_trunc('hour', s."createdAt")
              ORDER BY hour ASC
            `;
            sparkline = padSparkline(hourlyData, twentyFourHoursAgo, now);
          } else if (dimension === "ENTITY") {
            const [name, type] = anomaly.key.split("::");
            const hourlyData = await prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
              SELECT date_trunc('hour', s."createdAt") as hour, COUNT(*) as count
              FROM "SignalEntity" se
              JOIN "Signal" s ON se."signalId" = s."id"
              WHERE se."name" = ${name} AND se."type" = ${type}
                AND s."createdAt" >= ${twentyFourHoursAgo}
              GROUP BY date_trunc('hour', s."createdAt")
              ORDER BY hour ASC
            `;
            sparkline = padSparkline(hourlyData, twentyFourHoursAgo, now);
          } else if (dimension === "COUNTRY") {
            const hourlyData = await prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
              SELECT date_trunc('hour', s."createdAt") as hour, COUNT(DISTINCT sl."signalId") as count
              FROM "SignalLocation" sl
              JOIN "Signal" s ON sl."signalId" = s."id"
              WHERE sl."countryCode" = ${anomaly.key}
                AND s."createdAt" >= ${twentyFourHoursAgo}
              GROUP BY date_trunc('hour', s."createdAt")
              ORDER BY hour ASC
            `;
            sparkline = padSparkline(hourlyData, twentyFourHoursAgo, now);
          }
        } catch {
          // Sparkline is optional — don't fail the whole response
          sparkline = [];
        }

        return {
          key: anomaly.key,
          label: anomaly.label,
          dimension,
          zScore: anomaly.zScore,
          severity: anomaly.severity,
          currentValue: anomaly.currentValue,
          baselineMean: anomaly.baselineMean,
          sparkline,
        };
      }),
    );

    const response = NextResponse.json({ items });
    if (auth.authMode === "apikey" && auth.keyId) {
      logUsage(auth.keyId, req, 200, Date.now() - startTime).catch(() => {});
      addRateLimitHeaders(response, auth.rateLimit!, auth.remaining!, auth.resetMs!);
    }
    return response;
  } catch (error) {
    console.error("Trending API error:", error);
    if (auth.authMode === "apikey" && auth.keyId) {
      logUsage(auth.keyId, req, 500, Date.now() - startTime).catch(() => {});
    }
    return NextResponse.json({ error: "Failed to fetch trending" }, { status: 500 });
  }
}

/** Pad hourly data into a 24-slot array, filling 0 for missing hours. */
function padSparkline(
  data: { hour: Date; count: bigint }[],
  start: Date,
  end: Date,
): number[] {
  const hourMap = new Map<number, number>();
  for (const d of data) {
    const hourTs = new Date(d.hour).getTime();
    hourMap.set(hourTs, Number(d.count));
  }

  const result: number[] = [];
  const startHour = new Date(start);
  startHour.setMinutes(0, 0, 0);

  for (let i = 0; i < 24; i++) {
    const hourTs = startHour.getTime() + i * 60 * 60 * 1000;
    result.push(hourMap.get(hourTs) || 0);
  }

  return result;
}
