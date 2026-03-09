import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30")));

  try {
    // Get all key IDs for the user
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true },
    });

    const keyIds = keys.map((k) => k.id);

    if (keyIds.length === 0) {
      return NextResponse.json({
        daily: [],
        topEndpoints: [],
        summary: { totalRequests: 0, totalErrors: 0, errorRate: 0, avgResponseMs: 0 },
      });
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Daily stats
    const daily = await prisma.$queryRaw<
      { date: Date; requests: bigint; errors: bigint; avg_ms: number }[]
    >`
      SELECT DATE("createdAt") as date,
             COUNT(*) as requests,
             COUNT(*) FILTER (WHERE "statusCode" >= 400) as errors,
             COALESCE(AVG("responseTimeMs"), 0) as avg_ms
      FROM "ApiUsageLog"
      WHERE "keyId" = ANY(${keyIds})
        AND "createdAt" >= ${cutoff}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Top endpoints
    const topEndpoints = await prisma.$queryRaw<
      { endpoint: string; count: bigint; avg_ms: number }[]
    >`
      SELECT "endpoint",
             COUNT(*) as count,
             COALESCE(AVG("responseTimeMs"), 0) as avg_ms
      FROM "ApiUsageLog"
      WHERE "keyId" = ANY(${keyIds})
        AND "createdAt" >= ${cutoff}
      GROUP BY "endpoint"
      ORDER BY count DESC
      LIMIT 10
    `;

    // Summary
    const totalRequests = daily.reduce((sum, d) => sum + Number(d.requests), 0);
    const totalErrors = daily.reduce((sum, d) => sum + Number(d.errors), 0);

    return NextResponse.json({
      daily: daily.map((d) => ({
        date: d.date.toISOString().split("T")[0],
        requests: Number(d.requests),
        errors: Number(d.errors),
        avgMs: Math.round(Number(d.avg_ms)),
      })),
      topEndpoints: topEndpoints.map((e) => ({
        endpoint: e.endpoint,
        count: Number(e.count),
        avgMs: Math.round(Number(e.avg_ms)),
      })),
      summary: {
        totalRequests,
        totalErrors,
        errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 1000) / 10 : 0,
        avgResponseMs: Math.round(
          daily.reduce((sum, d) => sum + Number(d.avg_ms) * Number(d.requests), 0) /
            Math.max(totalRequests, 1),
        ),
      },
    });
  } catch (error) {
    console.error("[KEYS/USAGE] Error:", error);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
