import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      signalsIngested,
      topKeywordsResult,
      onTheRiseResult,
      mostActiveSourceResult,
    ] = await Promise.all([
      prisma.article.count({
        where: {
          source: { userId: session.user.id },
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.trendDataPoint.groupBy({
        by: ["keyword"],
        where: {
          timestamp: { gte: sevenDaysAgo },
          userId: session.user.id,
        },
        _sum: { count: true },
        orderBy: { _sum: { count: "desc" } },
        take: 5,
      }),
      prisma.trendDataPoint.findMany({
        where: {
          timestamp: { gte: fortyEightHoursAgo },
          userId: session.user.id,
        },
      }),
      prisma.article.groupBy({
        by: ["sourceId"],
        where: {
          source: { userId: session.user.id },
          createdAt: { gte: twentyFourHoursAgo },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      }),
    ]);

    // --- Process "On the Rise" Keyword ---
    const recentCounts = new Map<string, number>();
    const previousCounts = new Map<string, number>();
    onTheRiseResult.forEach((point) => {
      const map =
        point.timestamp >= twentyFourHoursAgo ? recentCounts : previousCounts;
      map.set(point.keyword, (map.get(point.keyword) || 0) + point.count);
    });
    let onTheRiseKeyword = { keyword: "N/A", change: 0, isNew: false };
    let maxChange = -Infinity;

    recentCounts.forEach((recentCount, keyword) => {
      const previousCount = previousCounts.get(keyword) || 0;
      let change = 0;
      if (previousCount > 0) {
        change = ((recentCount - previousCount) / previousCount) * 100;
      } else if (recentCount > 0) {
        change = 100; // Represents a new trend
      }
      if (change > maxChange) {
        maxChange = change;
        onTheRiseKeyword = {
          keyword,
          change: parseFloat(change.toFixed(1)),
          isNew: previousCount === 0,
        };
      }
    });

    // --- Fallback logic for "On the Rise" ---
    if (onTheRiseKeyword.keyword === "N/A" && recentCounts.size > 0) {
      let topTodayKeyword = "N/A";
      let maxCount = 0;
      recentCounts.forEach((count, keyword) => {
        if (count > maxCount) {
          maxCount = count;
          topTodayKeyword = keyword;
        }
      });
      onTheRiseKeyword = { keyword: topTodayKeyword, change: 0, isNew: true };
    }

    // --- Process Most Active Source ---
    let mostActiveSource = { name: "N/A", count: 0 };
    if (mostActiveSourceResult.length > 0) {
      const source = await prisma.source.findUnique({
        where: { id: mostActiveSourceResult[0].sourceId },
        select: { name: true },
      });
      mostActiveSource = {
        name: source?.name || "Unknown",
        count: mostActiveSourceResult[0]._count.id,
      };
    }

    // --- Assemble final response ---
    return NextResponse.json({
      topKeywords: topKeywordsResult.map((k) => k.keyword),
      onTheRise: onTheRiseKeyword,
      mostActiveSource: mostActiveSource,
      signalsIngested: signalsIngested,
    });
  } catch (error) {
    console.error("Failed to retrieve stat card data:", error);
    return NextResponse.json(
      { error: "Failed to retrieve stat card data" },
      { status: 500 }
    );
  }
}
