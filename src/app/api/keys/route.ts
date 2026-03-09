import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey, validateScopes, VALID_SCOPES } from "@/lib/api-keys";

const MAX_KEYS_PER_USER = 10;

/**
 * POST /api/keys — Create a new API key.
 * Returns the raw key ONCE in the response.
 */
export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, scopes, rateLimit, expiresAt } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or fewer" },
        { status: 400 },
      );
    }

    const keyScopes =
      scopes && Array.isArray(scopes) ? scopes : [...VALID_SCOPES];
    if (!validateScopes(keyScopes)) {
      return NextResponse.json(
        { error: "Invalid scopes", validScopes: VALID_SCOPES },
        { status: 400 },
      );
    }

    const existingCount = await prisma.apiKey.count({
      where: { userId, isActive: true },
    });
    if (existingCount >= MAX_KEYS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_KEYS_PER_USER} active keys allowed` },
        { status: 400 },
      );
    }

    const { rawKey, hashedKey, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name: name.trim(),
        key: hashedKey,
        prefix,
        scopes: keyScopes,
        rateLimit:
          typeof rateLimit === "number"
            ? Math.min(Math.max(rateLimit, 1), 10000)
            : 100,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        rateLimit: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ...apiKey,
        rawKey,
        warning: "Save this key now. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API-KEYS] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/keys — List all API keys for the authenticated user.
 * Returns prefix only, never the hash.
 */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        rateLimit: true,
        requestCount: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("[API-KEYS] List error:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 },
    );
  }
}
