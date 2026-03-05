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
    const type = searchParams.get("type");
    const severity = searchParams.get("severity");
    const active = searchParams.get("active") !== "false"; // default true
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    // Build where clause
    const where: any = {};
    if (active) where.isResolved = false;
    if (type) where.type = type;
    if (severity) where.severity = severity;

    // Fetch anomalies + severity counts in parallel
    const [anomalies, counts] = await Promise.all([
      prisma.anomalyEvent.findMany({
        where,
        orderBy: [{ severity: "desc" }, { zScore: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
      prisma.anomalyEvent.groupBy({
        by: ["severity"],
        where: { isResolved: false },
        _count: { severity: true },
      }),
    ]);

    // Build severity counts
    const countMap: Record<string, number> = { CRITICAL: 0, HIGH: 0, ELEVATED: 0 };
    for (const c of counts) {
      countMap[c.severity] = c._count.severity;
    }

    return NextResponse.json({
      anomalies,
      counts: {
        total: countMap.CRITICAL + countMap.HIGH + countMap.ELEVATED,
        critical: countMap.CRITICAL,
        high: countMap.HIGH,
        elevated: countMap.ELEVATED,
      },
    });
  } catch (error) {
    console.error("Anomalies API error:", error);
    return NextResponse.json({ error: "Failed to fetch anomalies" }, { status: 500 });
  }
}
