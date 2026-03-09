import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api-middleware";
import type { ApiScope } from "@/lib/api-keys";

/**
 * Get the authenticated user's ID from the session.
 * In development mode, falls back to the first user in the database.
 * Returns null if no user is found.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  // Dev mode fallback
  if (process.env.NODE_ENV === "development") {
    const firstUser = await prisma.user.findFirst();
    return firstUser?.id || null;
  }

  return null;
}

/**
 * Verify that a request is from a Vercel Cron job.
 * Checks the Authorization header against CRON_SECRET.
 */
export function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ---------------------------------------------------------------------------
// DUAL-MODE AUTH (Session OR API Key)
// ---------------------------------------------------------------------------

export interface DualAuthResult {
  userId: string;
  authMode: "session" | "apikey";
  keyId?: string;
  keyHash?: string;
  rateLimit?: number;
  remaining?: number;
  resetMs?: number;
}

/**
 * Authenticate via API key (if Bearer khabri_... header) or session.
 * API key auth does NOT fall back to session on failure.
 * Returns null if neither method succeeds.
 */
export async function authenticateRequest(
  req: Request,
  requiredScope?: ApiScope,
): Promise<DualAuthResult | null> {
  const authHeader = req.headers.get("authorization");

  // API key path
  if (authHeader?.startsWith("Bearer khabri_")) {
    const result = await authenticateApiKey(req, requiredScope);
    if (result.success) {
      return {
        userId: result.userId,
        authMode: "apikey",
        keyId: result.keyId,
        keyHash: result.keyHash,
        rateLimit: result.rateLimit,
        remaining: result.remaining,
        resetMs: result.resetMs,
      };
    }
    return null;
  }

  // Session path
  const userId = await getAuthenticatedUserId();
  if (userId) {
    return { userId, authMode: "session" };
  }

  return null;
}
