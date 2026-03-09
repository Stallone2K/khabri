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

    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [distribution, total] = await Promise.all([
      prisma.signal.groupBy({
        by: ["category"],
        where: { createdAt: { gte: timeThreshold } },
        _count: { category: true },
        orderBy: { _count: { category: "desc" } },
      }),
      prisma.signal.count({ where: { createdAt: { gte: timeThreshold } } }),
    ]);

    const categories = distribution
      .filter((d) => d.category !== null)
      .map((d) => ({
        name: d.category,
        count: d._count.category,
        percentage: total > 0 ? Math.round((d._count.category / total) * 1000) / 10 : 0,
      }));

    const uncategorized = distribution
      .filter((d) => d.category === null)
      .reduce((sum, d) => sum + d._count.category, 0);

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, { categories, total, uncategorized });
  } catch (error) {
    console.error("[V1/ANALYTICS/CATEGORIES] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch category data", 500, auth);
  }
}
