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
  const authResult = await authenticateV1(req, "analytics");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const hours = Math.min(72, Math.max(1, parseInt(searchParams.get("hours") || "24")));
    const interval = searchParams.get("interval") === "day" ? "day" : "hour";

    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [buckets, overall] = await Promise.all([
      prisma.$queryRaw<{
        bucket: Date;
        sentiment: string;
        count: bigint;
        avg_score: number | null;
      }[]>`
        SELECT date_trunc(${interval}, "createdAt") as bucket,
               sentiment,
               COUNT(*) as count,
               AVG("sentimentScore") as avg_score
        FROM "Signal"
        WHERE "createdAt" >= ${timeThreshold} AND sentiment IS NOT NULL
        GROUP BY bucket, sentiment
        ORDER BY bucket ASC
      `,
      prisma.$queryRaw<{
        sentiment: string;
        count: bigint;
        avg_score: number | null;
      }[]>`
        SELECT sentiment, COUNT(*) as count, AVG("sentimentScore") as avg_score
        FROM "Signal"
        WHERE "createdAt" >= ${timeThreshold} AND sentiment IS NOT NULL
        GROUP BY sentiment
      `,
    ]);

    // Group by bucket
    const bucketMap = new Map<string, Record<string, unknown>>();
    for (const row of buckets) {
      const ts = row.bucket.toISOString();
      if (!bucketMap.has(ts)) {
        bucketMap.set(ts, { timestamp: row.bucket, positive: 0, negative: 0, neutral: 0, mixed: 0, avgScore: 0 });
      }
      const entry = bucketMap.get(ts)!;
      const key = row.sentiment.toLowerCase();
      if (key in entry) entry[key] = Number(row.count);
    }

    // Compute per-bucket avgScore
    for (const [ts, entry] of bucketMap) {
      const bucketRows = buckets.filter((b) => b.bucket.toISOString() === ts);
      let totalCount = 0;
      let weightedScore = 0;
      for (const r of bucketRows) {
        const c = Number(r.count);
        totalCount += c;
        if (r.avg_score !== null) weightedScore += r.avg_score * c;
      }
      entry.avgScore = totalCount > 0 ? Math.round((weightedScore / totalCount) * 100) / 100 : 0;
    }

    // Overall summary
    const overallMap: Record<string, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    let overallTotal = 0;
    let overallWeighted = 0;
    for (const row of overall) {
      const key = row.sentiment.toLowerCase();
      const c = Number(row.count);
      if (key in overallMap) overallMap[key] = c;
      overallTotal += c;
      if (row.avg_score !== null) overallWeighted += row.avg_score * c;
    }

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, {
      interval,
      dataPoints: Array.from(bucketMap.values()),
      overall: {
        ...overallMap,
        avgScore: overallTotal > 0 ? Math.round((overallWeighted / overallTotal) * 100) / 100 : 0,
      },
    });
  } catch (error) {
    console.error("[V1/ANALYTICS/SENTIMENT] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch sentiment data", 500, auth);
  }
}
