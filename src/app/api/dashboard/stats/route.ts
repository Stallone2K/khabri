import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  // Dev Mode Fallback
  let userId = session?.user?.id;
  if (!userId) {
    const firstUser = await prisma.user.findFirst();
    userId = firstUser?.id;
  }

  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      signalsCount,
      criticalCount,
      lastTrend,
      activeProjects,
      scoreAgg,
      topSource,
    ] = await Promise.all([
      // 1. Total Signals (24h)
      prisma.signal.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
      // 2. High Impact Trends
      prisma.rankedTrend.count({
        where: { userId, score: { gte: 80 } },
      }),
      // 3. Last Pipeline Run
      prisma.rankedTrend.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      // 4. Active Projects (Drafts)
      prisma.project.count({
        where: { userId, status: { not: "COMPLETED" } },
      }),
      // 5. Avg Score (Market Temp)
      prisma.rankedTrend.aggregate({
        where: { userId },
        _avg: { score: true },
      }),
      // 6. Top Source (Optional Context)
      prisma.signal.groupBy({
        by: ["source"],
        where: { createdAt: { gte: twentyFourHoursAgo } },
        _count: { source: true },
        orderBy: { _count: { source: "desc" } },
        take: 1,
      }),
    ]);

    // Calculate Velocity (Signals per hour active today)
    // Floor of 1 to avoid division by zero errors visually
    const velocity = Math.max(1, Math.round(signalsCount / 24));

    return NextResponse.json({
      signalsProcessed: signalsCount,
      criticalTrends: criticalCount,
      lastUpdate: lastTrend?.createdAt || null,
      activeProjects: activeProjects,
      avgScore: Math.round(scoreAgg._avg.score || 0),
      topSource: topSource[0]?.source || "N/A",
      trendVelocity: velocity,
    });
  } catch (error) {
    console.error("Stats API Error:", error);
    return NextResponse.json({ error: "Stats failed" }, { status: 500 });
  }
}
