import { NextResponse } from "next/server";
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
  const authResult = await authenticateV1(req, "trends");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip } = parsePagination(searchParams);
    const category = searchParams.get("category");
    const region = searchParams.get("region");
    const minScore = searchParams.get("min_score");
    const sort = searchParams.get("sort") || "rank";

    // Get latest batch timestamp
    const latestBatch = await prisma.rankedTrend.findFirst({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!latestBatch) {
      return v1Success(auth, [], { total: 0, page, pageSize });
    }

    const where: Record<string, unknown> = {
      userId: auth.userId,
      createdAt: latestBatch.createdAt,
    };
    if (category) where.category = category;
    if (region === "DOMESTIC" || region === "INTERNATIONAL") where.region = region;
    if (minScore) where.score = { gte: parseInt(minScore) };

    const orderBy =
      sort === "score" ? { score: "desc" as const } :
      sort === "created_at" ? { createdAt: "desc" as const } :
      { rank: "asc" as const };

    const [trends, total] = await Promise.all([
      prisma.rankedTrend.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          rank: true,
          topic: true,
          score: true,
          reason: true,
          category: true,
          region: true,
          originalUrl: true,
          createdAt: true,
        },
      }),
      prisma.rankedTrend.count({ where }),
    ]);

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, trends, { total, page, pageSize });
  } catch (error) {
    console.error("[V1/TRENDS] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch trends", 500, auth);
  }
}
