import { NextResponse } from "next/server";
import { retryPendingDeliveries } from "@/lib/webhook-dispatch";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const retried = await retryPendingDeliveries();

    console.log(`[WEBHOOK-DELIVER] Retried ${retried} pending deliveries`);

    return NextResponse.json({ success: true, retriedCount: retried });
  } catch (error: unknown) {
    console.error("[WEBHOOK-DELIVER] Error:", error);
    return NextResponse.json(
      { error: "Webhook delivery retry failed" },
      { status: 500 },
    );
  }
}
