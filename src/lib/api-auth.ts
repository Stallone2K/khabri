import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
