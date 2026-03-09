import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";

export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "anomalies");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const typeFilter = searchParams.get("type");

    const typeWhere: Record<string, unknown> = { isResolved: false };
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

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, items);
  } catch (error) {
    console.error("[V1/ANOMALIES/TRENDING] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch trending", 500, auth);
  }
}

function padSparkline(
  data: { hour: Date; count: bigint }[],
  start: Date,
  end: Date,
): number[] {
  const hourMap = new Map<number, number>();
  for (const d of data) {
    hourMap.set(new Date(d.hour).getTime(), Number(d.count));
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
