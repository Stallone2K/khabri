import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getRazorpay, verifyCheckoutSignature, slugForRazorpayPlanId } from "@/lib/razorpay";
import { grantCredits, MONTHLY_GRANTS } from "@/lib/credits";

/**
 * POST /api/subscription/verify — called by the checkout modal after payment.
 * Verifies the Razorpay signature and activates the subscription locally
 * (the webhook is the backup path for this).
 */
export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let paymentId: string, subscriptionId: string, signature: string;
  try {
    const body = await req.json();
    paymentId = String(body.razorpay_payment_id || "");
    subscriptionId = String(body.razorpay_subscription_id || "");
    signature = String(body.razorpay_signature || "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!paymentId || !subscriptionId || !signature) {
    return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
  }

  if (!verifyCheckoutSignature(paymentId, subscriptionId, signature)) {
    return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
  }

  try {
    const razorpay = getRazorpay();
    const rzpSub = await razorpay.subscriptions.fetch(subscriptionId);
    const mapped = slugForRazorpayPlanId(String(rzpSub.plan_id));
    if (!mapped) {
      return NextResponse.json({ error: "Unknown Razorpay plan id" }, { status: 500 });
    }

    const plan = await prisma.plan.findUnique({ where: { slug: mapped.slug } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 500 });
    }

    // Plan change / resubscribe: retire the previous Razorpay subscription and
    // credit back the unused portion of its current period.
    const previous = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (
      previous?.source === "RAZORPAY" &&
      previous.razorpaySubscriptionId &&
      previous.razorpaySubscriptionId !== subscriptionId
    ) {
      try {
        await razorpay.subscriptions.cancel(previous.razorpaySubscriptionId, false);
      } catch (e) {
        // Already cancelled / expired upstream — fine.
        console.warn("[subscription/verify] Old subscription cancel skipped:", e);
      }

      if (previous.status === "ACTIVE" && !previous.cancelledAt && previous.currentPeriodEnd) {
        const remainingDays = Math.max(
          0,
          Math.min(30, Math.floor((previous.currentPeriodEnd.getTime() - Date.now()) / 86_400_000)),
        );
        const oldGrant = MONTHLY_GRANTS[previous.plan.slug] ?? 0;
        const bonus = Math.floor((oldGrant * remainingDays) / 30);
        if (bonus > 0) {
          const refId = `proration:${previous.razorpaySubscriptionId}`;
          const already = await prisma.creditLedger.findFirst({
            where: { userId, refType: "Razorpay", refId },
          });
          if (!already) {
            await grantCredits(userId, bonus, {
              reason: "proration_credit",
              refType: "Razorpay",
              refId,
            });
          }
        }
      }
    }

    const periodStart = rzpSub.current_start
      ? new Date(Number(rzpSub.current_start) * 1000)
      : new Date();
    const periodEnd = rzpSub.current_end
      ? new Date(Number(rzpSub.current_end) * 1000)
      : new Date(Date.now() + (mapped.yearly ? 365 : 30) * 24 * 60 * 60 * 1000);

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status: "ACTIVE",
        source: "RAZORPAY",
        razorpaySubscriptionId: subscriptionId,
        razorpayPlanId: String(rzpSub.plan_id),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        source: "RAZORPAY",
        razorpaySubscriptionId: subscriptionId,
        razorpayPlanId: String(rzpSub.plan_id),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
        redeemCodeId: null,
      },
    });

    // Grant the first month's credits, idempotently (payment id as ref).
    const grant = MONTHLY_GRANTS[mapped.slug] ?? 0;
    if (grant > 0) {
      const already = await prisma.creditLedger.findFirst({
        where: { userId, refType: "Razorpay", refId: paymentId },
      });
      if (!already) {
        await grantCredits(userId, grant, {
          reason: "monthly_grant",
          refType: "Razorpay",
          refId: paymentId,
        });
      }
    }

    return NextResponse.json({
      message: `Welcome to ${plan.name}! Your subscription is active.`,
      plan: { slug: plan.slug, name: plan.name },
    });
  } catch (error) {
    console.error("[subscription/verify] Failed:", error);
    return NextResponse.json({ error: "Failed to activate subscription" }, { status: 500 });
  }
}
