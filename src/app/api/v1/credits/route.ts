import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";
import { getPlanSlug } from "@/lib/credits";

/**
 * GET /api/v1/credits — read-only balance + recent ledger for API consumers.
 * Never debits (beyond the standard per-N-requests metering all v1 calls share).
 */
export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "analytics");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const [user, planSlug, recentLedger] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { creditBalance: true },
      }),
      getPlanSlug(auth.userId),
      prisma.creditLedger.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          delta: true,
          reason: true,
          refType: true,
          refId: true,
          createdAt: true,
        },
      }),
    ]);

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, {
      balance: user?.creditBalance ?? 0,
      plan: planSlug,
      unlimited: planSlug === "unlimited",
      recent_ledger: recentLedger,
    });
  } catch (error) {
    console.error("[v1/credits] Failed:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch credits", 500);
  }
}
