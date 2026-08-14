import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getRazorpay, isRazorpayConfigured } from "@/lib/razorpay";

/**
 * Cancels a paid subscription. Razorpay subscriptions are cancelled at cycle
 * end (access is retained until the period the user paid for runs out); the
 * webhook applies the final CANCELLED state + downgrade when Razorpay fires it.
 */
export async function POST() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription || subscription.source === "FREE") {
      return NextResponse.json({ error: "No paid subscription to cancel" }, { status: 400 });
    }
    if (subscription.status === "CANCELLED") {
      return NextResponse.json({ error: "Subscription is already cancelled" }, { status: 409 });
    }

    // Razorpay-billed: schedule cancellation at cycle end upstream.
    if (
      subscription.source === "RAZORPAY" &&
      subscription.razorpaySubscriptionId &&
      isRazorpayConfigured()
    ) {
      await getRazorpay().subscriptions.cancel(subscription.razorpaySubscriptionId, true);
      await prisma.subscription.update({
        where: { userId },
        data: { cancelledAt: new Date() },
      });
      const periodEnd = subscription.currentPeriodEnd
        ? subscription.currentPeriodEnd.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "the end of the current period";
      return NextResponse.json({
        message: `Subscription cancelled. You'll retain access until ${periodEnd}.`,
      });
    }

    // Redeem-code or unconfigured fallback: cancel locally right away.
    await prisma.subscription.update({
      where: { userId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    const message = subscription.currentPeriodEnd
      ? "Subscription cancelled. You'll retain access until the end of the current period."
      : "Subscription cancelled. You've been moved to the Free plan.";
    return NextResponse.json({ message });
  } catch (error) {
    console.error("[subscription/cancel] Failed:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
