import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 7;

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Delete completed/failed deliveries older than retention
    const deletedDeliveries = await prisma.webhookDelivery.deleteMany({
      where: {
        status: { in: ["SUCCESS", "FAILED"] },
        createdAt: { lt: cutoff },
      },
    });

    // Delete old webhook events
    const deletedEvents = await prisma.webhookEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    console.log(
      `[WEBHOOK-CLEANUP] Deleted ${deletedDeliveries.count} deliveries, ${deletedEvents.count} events (older than ${RETENTION_DAYS}d)`,
    );

    return NextResponse.json({
      success: true,
      deletedDeliveries: deletedDeliveries.count,
      deletedEvents: deletedEvents.count,
    });
  } catch (error: unknown) {
    console.error("[WEBHOOK-CLEANUP] Error:", error);
    return NextResponse.json(
      { error: "Webhook cleanup failed" },
      { status: 500 },
    );
  }
}
