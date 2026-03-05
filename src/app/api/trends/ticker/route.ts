import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  let userId = session?.user?.id;

  if (!userId) {
    const firstUser = await prisma.user.findFirst();
    userId = firstUser?.id;
  }

  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");

    // 1. Find the latest batch timestamp
    const latestTrend = await prisma.rankedTrend.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!latestTrend) {
      return NextResponse.json([]);
    }

    // 2. Get Top 10 from LATEST batch only
    const trendWhere: any = { userId, createdAt: latestTrend.createdAt };
    if (region === "DOMESTIC" || region === "INTERNATIONAL") {
      trendWhere.region = region;
    }

    const topTrends = await prisma.rankedTrend.findMany({
      where: trendWhere,
      orderBy: { rank: "asc" },
      take: 10,
      select: { id: true, topic: true, rank: true, score: true },
    });

    // 2. Calculate Momentum for each
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    const tickerData = await Promise.all(
      topTrends.map(async (trend) => {
        // Simplified Keyword Extraction
        const keywords = trend.topic
          .split(" ")
          .filter((w) => w.length > 3)
          .slice(0, 2);

        if (keywords.length === 0) return { ...trend, delta: "neutral" };

        const whereCondition = {
          OR: keywords.map((w) => ({
            title: { contains: w, mode: "insensitive" as const },
          })),
        };

        // Count Recent (0-2h ago) vs Past (2-4h ago)
        const [recentCount, pastCount] = await Promise.all([
          prisma.signal.count({
            where: {
              ...whereCondition,
              publishedAt: { gte: twoHoursAgo },
            },
          }),
          prisma.signal.count({
            where: {
              ...whereCondition,
              publishedAt: { gte: fourHoursAgo, lt: twoHoursAgo },
            },
          }),
        ]);

        let change = "neutral";
        if (recentCount > pastCount) change = "up";
        else if (recentCount < pastCount) change = "down";

        return {
          id: trend.id,
          rank: trend.rank,
          topic: trend.topic,
          score: trend.score,
          change,
          volume: recentCount,
        };
      }),
    );

    return NextResponse.json(tickerData);
  } catch (error) {
    return NextResponse.json({ error: "Ticker failed" }, { status: 500 });
  }
}
