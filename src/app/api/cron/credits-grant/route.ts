import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/api-auth";
import { grantCredits, MONTHLY_GRANTS } from "@/lib/credits";

/**
 * Monthly credit grants for paid plans. Run daily (idempotent): a user is
 * granted only when their last "monthly_grant" ledger entry is 30+ days old
 * (or missing). Free plan gets nothing (signup grant only); unlimited plan is
 * never debited so it needs no grants.
 */
export async function POST(req: Request) {
  if (!verifyCronSecret(req) && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eligibleSlugs = Object.keys(MONTHLY_GRANTS).filter(
    (slug) => MONTHLY_GRANTS[slug] > 0,
  );

  // Razorpay subs are excluded — their grants arrive via the
  // subscription.charged webhook so billing and credits stay in lockstep.
  const subs = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      source: { not: "RAZORPAY" },
      plan: { slug: { in: eligibleSlugs } },
    },
    select: { userId: true, plan: { select: { slug: true, id: true } } },
  });

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let granted = 0;

  for (const sub of subs) {
    const lastGrant = await prisma.creditLedger.findFirst({
      where: { userId: sub.userId, reason: "monthly_grant" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastGrant && lastGrant.createdAt > cutoff) continue;

    try {
      await grantCredits(sub.userId, MONTHLY_GRANTS[sub.plan.slug], {
        reason: "monthly_grant",
        refType: "Plan",
        refId: sub.plan.id,
      });
      granted++;
    } catch (e) {
      console.error(`[CREDITS-GRANT] Failed for user ${sub.userId}:`, e);
    }
  }

  console.log(`[CREDITS-GRANT] Granted monthly credits to ${granted}/${subs.length} eligible users`);
  return NextResponse.json({ eligible: subs.length, granted });
}
