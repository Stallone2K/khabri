import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// COSTS & GRANTS (hybrid model: credits gate AI operations, plan count-limits
// gate everything else — see BACKLOG.md Phase 6E)
// ---------------------------------------------------------------------------

export const CREDIT_COSTS = {
  INGEST_SCAN: 5, // manual dashboard "Scan" — feed fetch + Gemini ranking
  NARRATIVE_DISCOVERY: 10, // multi-call Gemini narrative discovery
  EXPORT: 2, // project export (JSON/Markdown)
  API_CALLS_PER_CREDIT: 10, // v1 API: 1 credit debited every N requests
} as const;

export const SIGNUP_GRANT = 500;

/** Monthly credit allotment per plan slug. "unlimited" is never debited;
 * "enterprise" is custom (granted manually per contract). */
export const MONTHLY_GRANTS: Record<string, number> = {
  free: 0, // signup grant only
  pro: 5000,
  ultimate: 25000,
};

export interface LedgerMeta {
  reason: string;
  refType?: string;
  refId?: string;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Your credit balance is too low for this operation.");
    this.name = "InsufficientCreditsError";
  }
}

// ---------------------------------------------------------------------------
// CORE OPERATIONS — balance column and ledger row always move together in one
// transaction. The debit guard lives in the UPDATE's WHERE clause, so there is
// no read-then-write race under concurrency.
// ---------------------------------------------------------------------------

export async function debitCredits(
  userId: string,
  amount: number,
  meta: LedgerMeta,
): Promise<void> {
  if (amount <= 0) throw new Error("debitCredits requires a positive amount");

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId, creditBalance: { gte: amount } },
        data: { creditBalance: { decrement: amount } },
      }),
      prisma.creditLedger.create({
        data: {
          userId,
          delta: -amount,
          reason: meta.reason,
          refType: meta.refType,
          refId: meta.refId,
        },
      }),
    ]);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new InsufficientCreditsError();
    }
    throw err;
  }
}

export async function grantCredits(
  userId: string,
  amount: number,
  meta: LedgerMeta,
): Promise<void> {
  if (amount <= 0) throw new Error("grantCredits requires a positive amount");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
    }),
    prisma.creditLedger.create({
      data: {
        userId,
        delta: amount,
        reason: meta.reason,
        refType: meta.refType,
        refId: meta.refId,
      },
    }),
  ]);
}

export function refundCredits(
  userId: string,
  amount: number,
  meta: LedgerMeta,
): Promise<void> {
  return grantCredits(userId, amount, meta);
}

export async function getCreditBalance(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });
  return row?.creditBalance ?? 0;
}

// ---------------------------------------------------------------------------
// PLAN-AWARE CHARGING
// ---------------------------------------------------------------------------

/** Returns the user's plan slug, or "free" when no subscription exists. */
export async function getPlanSlug(userId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, plan: { select: { slug: true } } },
  });
  if (!sub || sub.status === "EXPIRED") return "free";
  return sub.plan.slug;
}

/**
 * Debit credits unless the user is on the unlimited plan.
 * Returns the amount actually charged (0 for unlimited) so callers know
 * whether a refund is owed on failure.
 * Throws InsufficientCreditsError when the balance can't cover it.
 */
export async function chargeCredits(
  userId: string,
  amount: number,
  meta: LedgerMeta,
): Promise<number> {
  const slug = await getPlanSlug(userId);
  if (slug === "unlimited") return 0;
  await debitCredits(userId, amount, meta);
  return amount;
}

/** Standard 402 body for insufficient-credit rejections. */
export function insufficientCreditsBody() {
  return {
    error: "INSUFFICIENT_CREDITS",
    message:
      "Your credit balance is too low for this operation. Upgrade your plan or wait for your monthly grant.",
  };
}
