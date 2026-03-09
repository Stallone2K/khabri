import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validateScopes, VALID_SCOPES } from "@/lib/api-keys";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/keys/[id] — Permanently delete an API key and its usage logs.
 */
export async function DELETE(req: Request, { params }: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const key = await prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Key deleted" });
  } catch (error) {
    console.error("[API-KEYS] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete key" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/keys/[id] — Update name, scopes, or rate limit.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const key = await prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, scopes, rateLimit } = body;

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      data.name = name.trim();
    }

    if (scopes !== undefined) {
      if (!Array.isArray(scopes) || !validateScopes(scopes)) {
        return NextResponse.json(
          { error: "Invalid scopes", validScopes: VALID_SCOPES },
          { status: 400 },
        );
      }
      data.scopes = scopes;
    }

    if (rateLimit !== undefined) {
      if (
        typeof rateLimit !== "number" ||
        rateLimit < 1 ||
        rateLimit > 10000
      ) {
        return NextResponse.json(
          { error: "Rate limit must be between 1 and 10000" },
          { status: 400 },
        );
      }
      data.rateLimit = rateLimit;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        rateLimit: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API-KEYS] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update key" },
      { status: 500 },
    );
  }
}
