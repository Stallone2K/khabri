import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { grantCredits, MONTHLY_GRANTS } from "@/lib/credits";

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let code: string;
  try {
    const body = await req.json();
    code = String(body.code || "").trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Redeem code is required" }, { status: 400 });
  }

  try {
    const redeemCode = await prisma.redeemCode.findUnique({ where: { code } });
    if (!redeemCode || !redeemCode.isActive) {
      return NextResponse.json({ error: "Invalid redeem code" }, { status: 404 });
    }
    if (redeemCode.expiresAt && redeemCode.expiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired" }, { status: 410 });
    }
    if (redeemCode.useCount >= redeemCode.maxUses) {
      return NextResponse.json({ error: "This code has reached its usage limit" }, { status: 410 });
    }

    const alreadyRedeemed = await prisma.redemption.findUnique({
      where: { redeemCodeId_userId: { redeemCodeId: redeemCode.id, userId } },
    });
    if (alreadyRedeemed) {
      return NextResponse.json({ error: "You have already redeemed this code" }, { status: 409 });
    }

    const plan = await prisma.plan.findUnique({ where: { slug: redeemCode.planSlug } });
    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found — run prisma/seed-plans.ts" },
        { status: 500 },
      );
    }

    await prisma.$transaction([
      prisma.redemption.create({
        data: { redeemCodeId: redeemCode.id, userId },
      }),
      prisma.redeemCode.update({
        where: { id: redeemCode.id },
        data: { useCount: { increment: 1 } },
      }),
      prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planId: plan.id,
          status: "ACTIVE",
          source: "REDEEM_CODE",
          redeemCodeId: redeemCode.id,
          currentPeriodEnd: null,
        },
        update: {
          planId: plan.id,
          status: "ACTIVE",
          source: "REDEEM_CODE",
          redeemCodeId: redeemCode.id,
          currentPeriodEnd: null,
          cancelledAt: null,
        },
      }),
    ]);

    // Grant the plan's monthly credit allotment immediately (unlimited plan
    // is never debited, so it needs no grant).
    const grant = MONTHLY_GRANTS[plan.slug] ?? 0;
    if (grant > 0) {
      await grantCredits(userId, grant, {
        reason: "redeem_grant",
        refType: "RedeemCode",
        refId: redeemCode.id,
      }).catch((e) => console.error("[REDEEM] Credit grant failed:", e));
    }

    return NextResponse.json({
      message: `Code redeemed — you're now on the ${plan.name} plan!`,
      plan: { slug: plan.slug, name: plan.name },
    });
  } catch (error) {
    console.error("[subscription/redeem] Failed:", error);
    return NextResponse.json({ error: "Failed to redeem code" }, { status: 500 });
  }
}
