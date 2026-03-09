import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  logUsage,
  addRateLimitHeaders,
  type ApiAuthResult,
  type ApiAuthError,
} from "@/lib/api-middleware";
import type { ApiScope } from "@/lib/api-keys";

// ---------------------------------------------------------------------------
// Auth (API-key only — no session fallback for v1 endpoints)
// ---------------------------------------------------------------------------

export async function authenticateV1(
  req: Request,
  scope: ApiScope,
): Promise<ApiAuthResult | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer khabri_")) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message:
            "API key required. Use: Authorization: Bearer khabri_...",
        },
      },
      { status: 401 },
    );
  }

  const result = await authenticateApiKey(req, scope);
  if (result.success) return result;
  return (result as ApiAuthError).response;
}

// ---------------------------------------------------------------------------
// Response Builders
// ---------------------------------------------------------------------------

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
}

export function v1Success<T>(
  auth: ApiAuthResult,
  data: T,
  pagination?: PaginationInfo,
): NextResponse {
  const rateLimitMeta = {
    limit: auth.rateLimit,
    remaining: auth.remaining,
    reset: Math.ceil(auth.resetMs / 1000),
  };

  const meta: Record<string, unknown> = { rateLimit: rateLimitMeta };
  if (pagination) {
    meta.total = pagination.total;
    meta.page = pagination.page;
    meta.pageSize = pagination.pageSize;
    meta.hasMore = pagination.page * pagination.pageSize < pagination.total;
  }

  const response = NextResponse.json({ data, meta });
  addRateLimitHeaders(response, auth.rateLimit, auth.remaining, auth.resetMs);
  return response;
}

export function v1Error(
  code: string,
  message: string,
  status: number,
  auth?: ApiAuthResult,
): NextResponse {
  const body: Record<string, unknown> = { error: { code, message } };
  if (auth) {
    body.meta = {
      rateLimit: {
        limit: auth.rateLimit,
        remaining: auth.remaining,
        reset: Math.ceil(auth.resetMs / 1000),
      },
    };
  }
  return NextResponse.json(body, { status });
}

// ---------------------------------------------------------------------------
// Usage Logging
// ---------------------------------------------------------------------------

export function logV1Usage(
  auth: ApiAuthResult,
  req: Request,
  statusCode: number,
  startTime: number,
): void {
  logUsage(auth.keyId, req, statusCode, Date.now() - startTime).catch(
    () => {},
  );
}

// ---------------------------------------------------------------------------
// Pagination Helpers
// ---------------------------------------------------------------------------

export function parsePagination(
  searchParams: URLSearchParams,
  defaults = { page: 1, pageSize: 25, maxPageSize: 100 },
) {
  const page = Math.max(
    1,
    parseInt(searchParams.get("page") || String(defaults.page)),
  );
  const pageSize = Math.min(
    defaults.maxPageSize,
    Math.max(
      1,
      parseInt(
        searchParams.get("page_size") ||
          searchParams.get("limit") ||
          String(defaults.pageSize),
      ),
    ),
  );
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

// ---------------------------------------------------------------------------
// Type guard for auth result
// ---------------------------------------------------------------------------

export function isAuthResult(
  result: ApiAuthResult | NextResponse,
): result is ApiAuthResult {
  return "success" in result && (result as ApiAuthResult).success === true;
}
