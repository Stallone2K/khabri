import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getRazorpay,
  getRazorpayPlanId,
  isRazorpayConfigured,
} from "@/lib/razorpay";

const PURCHASABLE = ["pro", "ultimate"];

/**
 * POST /api/subscription/checkout — { planSlug, yearly }
 *
 * No existing Razorpay subscription → creates one and returns
 * { subscriptionId, keyId } for the client checkout modal.
 *
 * Existing Razorpay subscription → plan change:
 *   upgrade   → switched immediately (Razorpay prorates the charge),
 *               local plan updated, credit difference granted now
 *   downgrade → scheduled for cycle end (webhook applies the switch)
 */
export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured yet. Use a redeem code, or try again later." },
      { status: 503 },
    );
  }

  let planSlug: string;
  let yearly: boolean;
  try {
    const body = await req.json();
    planSlug = String(body.planSlug || "");
    yearly = Boolean(body.yearly);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!PURCHASABLE.includes(planSlug)) {
    return NextResponse.json({ error: "This plan cannot be purchased online" }, { status: 400 });
  }

  const razorpayPlanId = getRazorpayPlanId(planSlug, yearly);
  if (!razorpayPlanId) {
    return NextResponse.json(
      { error: `Razorpay plan id for ${planSlug} (${yearly ? "yearly" : "monthly"}) is not configured` },
      { status: 503 },
    );
  }

  const targetPlan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!targetPlan) {
    return NextResponse.json({ error: "Plan not found — run prisma/seed-plans.ts" }, { status: 500 });
  }

  try {
    const razorpay = getRazorpay();
    const existing = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    // Razorpay can't modify a domestic-card mandate subscription in place
    // ("Can't update subscription when card mandate is applicable"), so every
    // plan change is a REPLACEMENT: a fresh subscription is authorized here,
    // and /api/subscription/verify cancels the old one + credits unused days.
    if (
      existing &&
      existing.source === "RAZORPAY" &&
      existing.status === "ACTIVE" &&
      !existing.cancelledAt &&
      existing.plan.slug === planSlug
    ) {
      return NextResponse.json({ error: "You are already on this plan" }, { status: 409 });
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: yearly ? 10 : 120,
      quantity: 1,
      customer_notify: 1,
      notes: { userId, planSlug, yearly: String(yearly) },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      planSlug,
      yearly,
    });
  } catch (error) {
    console.error("[subscription/checkout] Failed:", error);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
