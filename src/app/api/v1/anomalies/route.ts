import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
  parsePagination,
} from "@/lib/api-v1";

export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "anomalies");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip } = parsePagination(searchParams);
    const type = searchParams.get("type");
    const severity = searchParams.get("severity");
    const active = searchParams.get("active") !== "false";

    const where: Record<string, unknown> = {};
    if (active) where.isResolved = false;
    if (type) where.type = type;
    if (severity) where.severity = severity;

    const [anomalies, total, counts] = await Promise.all([
      prisma.anomalyEvent.findMany({
        where,
        orderBy: [{ severity: "desc" }, { zScore: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.anomalyEvent.count({ where }),
      prisma.anomalyEvent.groupBy({
        by: ["severity"],
        where: { isResolved: false },
        _count: { severity: true },
      }),
    ]);

    const countMap: Record<string, number> = { CRITICAL: 0, HIGH: 0, ELEVATED: 0 };
    for (const c of counts) {
      countMap[c.severity] = c._count.severity;
    }

    const data = {
      anomalies,
      summary: {
        total: countMap.CRITICAL + countMap.HIGH + countMap.ELEVATED,
        critical: countMap.CRITICAL,
        high: countMap.HIGH,
        elevated: countMap.ELEVATED,
      },
    };

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, data, { total, page, pageSize });
  } catch (error) {
    console.error("[V1/ANOMALIES] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch anomalies", 500, auth);
  }
}
