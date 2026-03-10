import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey, type ApiScope } from "@/lib/api-keys";

export interface ApiAuthResult {
  success: true;
  userId: string;
  keyId: string;
  keyHash: string;
  rateLimit: number;
  remaining: number;
  resetMs: number;
}

export interface ApiAuthError {
  success: false;
  response: NextResponse;
}

export type ApiAuthOutcome = ApiAuthResult | ApiAuthError;

/**
 * Authenticate an API request via Bearer token.
 *
 * Usage:
 * ```
 * const auth = await authenticateApiKey(req, "trends");
 * if (!auth.success) return auth.response;
 * // auth.userId, auth.keyId available
 * ```
 */
export async function authenticateApiKey(
  req: Request,
  requiredScope?: ApiScope,
): Promise<ApiAuthOutcome> {
  // 1. Extract Bearer token
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer khabri_")) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error:
            "Missing or invalid API key. Expected: Authorization: Bearer khabri_...",
        },
        { status: 401 },
      ),
    };
  }

  const rawKey = authHeader.replace("Bearer ", "").trim();
  const hashedKey = hashApiKey(rawKey);

  // 2. Look up in DB
  const apiKey = await prisma.apiKey.findUnique({
    where: { key: hashedKey },
    select: {
      id: true,
      userId: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      expiresAt: true,
      key: true,
    },
  });

  if (!apiKey) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 },
      ),
    };
  }

  // 3. Check active
  if (!apiKey.isActive) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "API key has been revoked" },
        { status: 401 },
      ),
    };
  }

  // 4. Check expiration
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "API key has expired" },
        { status: 401 },
      ),
    };
  }

  // 5. Check scope
  if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Insufficient scope",
          required: requiredScope,
          granted: apiKey.scopes,
        },
        { status: 403 },
      ),
    };
  }

  // 6. Rate limiting disabled — will be re-added with pricing tiers (see BACKLOG.md)

  // 7. Sync usage to DB periodically
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        requestCount: { increment: 1 },
      },
    })
    .catch((err: unknown) =>
      console.error("[API-AUTH] Failed to sync usage:", err),
    );

  return {
    success: true,
    userId: apiKey.userId,
    keyId: apiKey.id,
    keyHash: apiKey.key,
    rateLimit: 0,
    remaining: 0,
    resetMs: 0,
  };
}

/**
 * Log a single API request. Called fire-and-forget.
 */
export async function logUsage(
  keyId: string,
  req: Request,
  statusCode: number,
  responseTimeMs: number,
): Promise<void> {
  try {
    const url = new URL(req.url);
    await prisma.apiUsageLog.create({
      data: {
        keyId,
        endpoint: url.pathname,
        method: req.method,
        statusCode,
        responseTimeMs,
      },
    });
  } catch (err) {
    console.error("[API-USAGE] Failed to log:", err);
  }
}

/**
 * Rate limit headers — currently a no-op (rate limiting disabled).
 * Will be re-enabled with pricing tiers (see BACKLOG.md).
 */
export function addRateLimitHeaders(
  response: NextResponse,
  _limit: number,
  _remaining: number,
  _resetMs: number,
): NextResponse {
  return response;
}
