import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  const isDev = process.env.NODE_ENV === "development";

  if (!isCron && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    // Aggregate yesterday's logs per key
    const aggregates = await prisma.apiUsageLog.groupBy({
      by: ["keyId"],
      where: {
        createdAt: { gte: yesterday, lte: endOfYesterday },
      },
      _count: { id: true },
      _avg: { responseTimeMs: true },
    });

    // Get error counts separately
    const errorAggregates = await prisma.apiUsageLog.groupBy({
      by: ["keyId"],
      where: {
        createdAt: { gte: yesterday, lte: endOfYesterday },
        statusCode: { gte: 400 },
      },
      _count: { id: true },
    });

    const errorMap = new Map(
      errorAggregates.map((e) => [e.keyId, e._count.id]),
    );

    // Upsert daily stats
    let aggregated = 0;
    for (const agg of aggregates) {
      await prisma.apiUsageDailyStat.upsert({
        where: {
          keyId_date: {
            keyId: agg.keyId,
            date: yesterday,
          },
        },
        create: {
          keyId: agg.keyId,
          date: yesterday,
          totalRequests: agg._count.id,
          errorCount: errorMap.get(agg.keyId) || 0,
          avgResponseMs: Math.round(agg._avg.responseTimeMs || 0),
        },
        update: {
          totalRequests: agg._count.id,
          errorCount: errorMap.get(agg.keyId) || 0,
          avgResponseMs: Math.round(agg._avg.responseTimeMs || 0),
        },
      });
      aggregated++;
    }

    // Delete raw logs older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.apiUsageLog.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });

    console.log(
      `[CRON/USAGE] Aggregated ${aggregated} key stats, deleted ${deleted.count} old logs`,
    );

    return NextResponse.json({
      success: true,
      aggregated,
      deletedOldLogs: deleted.count,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[CRON/USAGE] Fatal error:", error);
    return NextResponse.json(
      { error: "Usage aggregation failed", details: message },
      { status: 500 },
    );
  }
}
