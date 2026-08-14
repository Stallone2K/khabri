import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, slugForRazorpayPlanId } from "@/lib/razorpay";
import { grantCredits, MONTHLY_GRANTS } from "@/lib/credits";

interface RzpSubscriptionEntity {
  id: string;
  plan_id: string;
  status: string;
  current_start: number | null;
  current_end: number | null;
}

/**
 * POST /api/webhooks/razorpay — Razorpay event sink.
 * Handles: subscription.activated, subscription.charged (renewals),
 * subscription.updated (scheduled plan changes), subscription.halted,
 * subscription.pending, subscription.cancelled.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: string;
  let sub: RzpSubscriptionEntity | null = null;
  let paymentId: string | null = null;
  try {
    const payload = JSON.parse(rawBody);
    event = String(payload.event || "");
    sub = payload.payload?.subscription?.entity ?? null;
    paymentId = payload.payload?.payment?.entity?.id ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!sub?.id) {
    return NextResponse.json({ received: true, skipped: "no subscription entity" });
  }

  const local = await prisma.subscription.findFirst({
    where: { razorpaySubscriptionId: sub.id },
    include: { plan: true },
  });
  if (!local) {
    // Not activated locally yet (verify endpoint handles first activation).
    console.warn(`[RZP-WEBHOOK] ${event} for unknown subscription ${sub.id}`);
    return NextResponse.json({ received: true, skipped: "unknown subscription" });
  }

  const periodData = {
    currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : undefined,
    currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : undefined,
  };

  try {
    switch (event) {
      case "subscription.activated":
      case "subscription.charged": {
        // Renewal (or first charge): refresh the period, grant monthly credits.
        const mapped = slugForRazorpayPlanId(sub.plan_id);
        await prisma.subscription.update({
          where: { id: local.id },
          data: { status: "ACTIVE", ...periodData },
        });

        const slug = mapped?.slug ?? local.plan.slug;
        const grant = MONTHLY_GRANTS[slug] ?? 0;
        // Idempotency: one grant per payment (or per billing period start).
        const refId = paymentId ?? `${sub.id}:${sub.current_start ?? ""}`;
        if (grant > 0) {
          const already = await prisma.creditLedger.findFirst({
            where: { userId: local.userId, refType: "Razorpay", refId },
          });
          if (!already) {
            await grantCredits(local.userId, grant, {
              reason: "monthly_grant",
              refType: "Razorpay",
              refId,
            });
          }
        }
        break;
      }

      case "subscription.updated": {
        // Plan change applied (immediate upgrades and cycle-end downgrades).
        const mapped = slugForRazorpayPlanId(sub.plan_id);
        if (mapped && mapped.slug !== local.plan.slug) {
          const newPlan = await prisma.plan.findUnique({ where: { slug: mapped.slug } });
          if (newPlan) {
            await prisma.subscription.update({
              where: { id: local.id },
              data: { planId: newPlan.id, razorpayPlanId: sub.plan_id, ...periodData },
            });

            // Upgrades grant the credit difference (idempotent per sub+period).
            const diff =
              (MONTHLY_GRANTS[mapped.slug] ?? 0) - (MONTHLY_GRANTS[local.plan.slug] ?? 0);
            const refId = `upgrade:${sub.id}:${sub.current_start ?? ""}`;
            if (diff > 0) {
              const already = await prisma.creditLedger.findFirst({
                where: { userId: local.userId, refType: "Razorpay", refId },
              });
              if (!already) {
                await grantCredits(local.userId, diff, {
                  reason: "plan_upgrade",
                  refType: "Razorpay",
                  refId,
                });
              }
            }
          }
        }
        break;
      }

      case "subscription.halted":
      case "subscription.pending":
        await prisma.subscription.update({
          where: { id: local.id },
          data: { status: "PAST_DUE" },
        });
        break;

      case "subscription.cancelled": {
        // Downgrade to free at cancellation.
        const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
        await prisma.subscription.update({
          where: { id: local.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            ...(freePlan ? { planId: freePlan.id } : {}),
          },
        });
        break;
      }

      default:
        return NextResponse.json({ received: true, skipped: event });
    }

    console.log(`[RZP-WEBHOOK] Processed ${event} for subscription ${sub.id}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[RZP-WEBHOOK] Failed processing ${event}:`, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
