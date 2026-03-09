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
  const authResult = await authenticateV1(req, "trends");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const region = searchParams.get("region");

    // Get latest batch
    const latestTrend = await prisma.rankedTrend.findFirst({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!latestTrend) {
      return v1Success(auth, []);
    }

    const where: Record<string, unknown> = {
      userId: auth.userId,
      createdAt: latestTrend.createdAt,
    };
    if (region === "DOMESTIC" || region === "INTERNATIONAL") where.region = region;

    const topTrends = await prisma.rankedTrend.findMany({
      where,
      orderBy: { rank: "asc" },
      take: limit,
      select: { id: true, topic: true, rank: true, score: true },
    });

    // Calculate momentum for each trend
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    const data = await Promise.all(
      topTrends.map(async (trend) => {
        const keywords = trend.topic
          .split(" ")
          .filter((w) => w.length > 3)
          .slice(0, 2);

        if (keywords.length === 0) {
          return { id: trend.id, rank: trend.rank, topic: trend.topic, score: trend.score, change: "neutral", volume: 0 };
        }

        const whereCondition = {
          OR: keywords.map((w) => ({
            title: { contains: w, mode: "insensitive" as const },
          })),
        };

        const [recentCount, pastCount] = await Promise.all([
          prisma.signal.count({ where: { ...whereCondition, publishedAt: { gte: twoHoursAgo } } }),
          prisma.signal.count({ where: { ...whereCondition, publishedAt: { gte: fourHoursAgo, lt: twoHoursAgo } } }),
        ]);

        const change = recentCount > pastCount ? "up" : recentCount < pastCount ? "down" : "neutral";

        return { id: trend.id, rank: trend.rank, topic: trend.topic, score: trend.score, change, volume: recentCount };
      }),
    );

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, data);
  } catch (error) {
    console.error("[V1/TRENDS/TOP] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch top trends", 500, auth);
  }
}
