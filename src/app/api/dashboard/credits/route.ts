import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPlanSlug } from "@/lib/credits";

/**
 * Dashboard credit snapshot: balance, plan, 30-day daily series, and the
 * last 50 ledger entries. Consumed by /dashboard/usage.
 */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [user, planSlug, ledger, last30] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      }),
      getPlanSlug(userId),
      prisma.creditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          delta: true,
          reason: true,
          refType: true,
          refId: true,
          createdAt: true,
        },
      }),
      prisma.creditLedger.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { delta: true, createdAt: true },
      }),
    ]);

    // Daily buckets for the sparkline
    const buckets = new Map<string, { spent: number; granted: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      buckets.set(d.toISOString().slice(0, 10), { spent: 0, granted: 0 });
    }
    let spent30 = 0;
    let granted30 = 0;
    for (const row of last30) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (row.delta < 0) {
        bucket.spent += -row.delta;
        spent30 += -row.delta;
      } else {
        bucket.granted += row.delta;
        granted30 += row.delta;
      }
    }

    return NextResponse.json({
      balance: user?.creditBalance ?? 0,
      isUnlimited: planSlug === "unlimited",
      last30Days: { spent: spent30, granted: granted30 },
      series: Array.from(buckets.entries()).map(([date, v]) => ({
        date,
        ...v,
      })),
      ledger,
    });
  } catch (error) {
    console.error("[dashboard/credits] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit data" },
      { status: 500 },
    );
  }
}
