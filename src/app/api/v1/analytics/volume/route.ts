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

    const [buckets, totalResult] = await Promise.all([
      prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
        SELECT date_trunc(${interval}, "createdAt") as bucket, COUNT(*) as count
        FROM "Signal"
        WHERE "createdAt" >= ${timeThreshold}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      prisma.signal.count({ where: { createdAt: { gte: timeThreshold } } }),
    ]);

    const dataPoints = buckets.map((b) => ({
      timestamp: b.bucket,
      count: Number(b.count),
    }));

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, { interval, dataPoints, total: totalResult });
  } catch (error) {
    console.error("[V1/ANALYTICS/VOLUME] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch volume data", 500, auth);
  }
}
