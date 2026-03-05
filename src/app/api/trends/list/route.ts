import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const region = searchParams.get("region");

    // Each "page" = one ingest batch. Find all distinct batch timestamps.
    const batches = await prisma.$queryRaw<{ createdAt: Date }[]>`
      SELECT DISTINCT "createdAt"
      FROM "RankedTrend"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
    `;

    const totalPages = batches.length;
    const batchIdx = Math.min(page - 1, totalPages - 1);
    const batchTimestamp = batches[batchIdx]?.createdAt;

    if (!batchTimestamp) {
      return NextResponse.json({
        trends: [],
        pagination: { page: 1, totalPages: 0 },
      });
    }

    const where: any = { userId, createdAt: batchTimestamp };
    if (region === "DOMESTIC" || region === "INTERNATIONAL") {
      where.region = region;
    }

    const trends = await prisma.rankedTrend.findMany({
      where,
      orderBy: [{ rank: "asc" }],
      select: {
        id: true,
        rank: true,
        topic: true,
        score: true,
        category: true,
        region: true,
        originalUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      trends,
      pagination: {
        page,
        totalPages,
        totalCount: trends.length,
        pageSize: trends.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch trends", error);
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }
}
