import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // --- 1. Find the Top 5 Trending Keywords in the last 48 hours ---
    const fortyEightHoursAgo = new Date(
      new Date().getTime() - 48 * 60 * 60 * 1000
    );
    const topKeywordsResult = await prisma.trendDataPoint.groupBy({
      by: ["keyword"],
      where: {
        timestamp: { gte: fortyEightHoursAgo },
      },
      _sum: {
        count: true,
      },
      orderBy: {
        _sum: {
          count: "desc",
        },
      },
      take: 5,
    });

    const topKeywords = topKeywordsResult.map((k) => k.keyword);

    // --- 2. Get all historical data for ONLY those top 5 keywords for the last 30 days ---
    const thirtyDaysAgo = new Date(
      new Date().getTime() - 30 * 24 * 60 * 60 * 1000
    );
    const historicalData = await prisma.trendDataPoint.findMany({
      where: {
        keyword: { in: topKeywords },
        timestamp: { gte: thirtyDaysAgo },
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    // --- 3. Process the data into a format that's easy for the chart to read ---
    const processedData = new Map<string, any>();

    historicalData.forEach((point) => {
      const date = point.timestamp.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (!processedData.has(date)) {
        const initialData: { [key: string]: number | string } = { date };
        topKeywords.forEach((k) => {
          initialData[k] = 0;
        });
        processedData.set(date, initialData);
      }

      const dateEntry = processedData.get(date);
      dateEntry[point.keyword] = (dateEntry[point.keyword] || 0) + point.count;
    });

    const chartData = Array.from(processedData.values());

    // --- 4. Return both the list of top keywords (for the legend) and the chart data ---
    return NextResponse.json({
      keywords: topKeywords,
      data: chartData,
    });
  } catch (error) {
    console.error("Failed to retrieve graph trend data:", error);
    return NextResponse.json(
      { error: "Failed to retrieve graph trend data" },
      { status: 500 }
    );
  }
}
