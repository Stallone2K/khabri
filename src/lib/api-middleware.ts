import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey, type ApiScope } from "@/lib/api-keys";
import {
  checkRateLimit,
  getUnsyncedCount,
  markSynced,
} from "@/lib/rate-limiter";

const DB_SYNC_THRESHOLD = 10;

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

  // 6. Rate limit
  const rateCheck = checkRateLimit(apiKey.key, apiKey.rateLimit);
  if (!rateCheck.allowed) {
    logUsage(apiKey.id, req, 429, 0).catch(() => {});

    const response = NextResponse.json(
      {
        error: "Rate limit exceeded",
        limit: apiKey.rateLimit,
        retryAfter: rateCheck.retryAfterSeconds,
      },
      { status: 429 },
    );
    response.headers.set(
      "Retry-After",
      String(rateCheck.retryAfterSeconds),
    );
    response.headers.set("X-RateLimit-Limit", String(apiKey.rateLimit));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(rateCheck.resetMs / 1000)),
    );

    return { success: false, response };
  }

  // 7. Sync usage to DB periodically
  const unsyncedCount = getUnsyncedCount(apiKey.key);
  if (unsyncedCount >= DB_SYNC_THRESHOLD) {
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date(),
          requestCount: { increment: unsyncedCount },
        },
      })
      .then(() => markSynced(apiKey.key))
      .catch((err: unknown) =>
        console.error("[API-AUTH] Failed to sync usage:", err),
      );
  }

  return {
    success: true,
    userId: apiKey.userId,
    keyId: apiKey.id,
    keyHash: apiKey.key,
    rateLimit: apiKey.rateLimit,
    remaining: rateCheck.remaining,
    resetMs: rateCheck.resetMs,
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
 * Add rate limit headers to a successful response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetMs: number,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(resetMs / 1000)),
  );
  return response;
}
