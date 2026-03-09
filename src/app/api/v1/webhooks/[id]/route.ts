import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";

// ---------------------------------------------------------------------------
// GET /api/v1/webhooks/[id] — Webhook details + recent deliveries
// ---------------------------------------------------------------------------

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "webhooks");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { id } = await params;

    const webhook = await prisma.webhook.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deliveries: {
          select: {
            id: true,
            eventType: true,
            status: true,
            attempts: true,
            statusCode: true,
            error: true,
            createdAt: true,
            lastAttemptAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!webhook || webhook.userId !== auth.userId) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", "Webhook not found", 404, auth);
    }

    const { userId: _, ...data } = webhook;

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, data);
  } catch (error) {
    console.error("[V1/WEBHOOKS/ID] GET error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch webhook", 500, auth);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/webhooks/[id] — Soft-revoke (deactivate)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "webhooks");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { id } = await params;

    const webhook = await prisma.webhook.findUnique({
      where: { id },
      select: { id: true, userId: true, isActive: true },
    });

    if (!webhook || webhook.userId !== auth.userId) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", "Webhook not found", 404, auth);
    }

    if (!webhook.isActive) {
      logV1Usage(auth, req, 400, startTime);
      return v1Error("ALREADY_INACTIVE", "Webhook is already deactivated", 400, auth);
    }

    await prisma.webhook.update({
      where: { id },
      data: { isActive: false },
    });

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, { id, deactivated: true });
  } catch (error) {
    console.error("[V1/WEBHOOKS/ID] DELETE error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to deactivate webhook", 500, auth);
  }
}
