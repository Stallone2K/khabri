import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { WEBHOOK_EVENT_TYPES } from "@/lib/webhook-events";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";

const MAX_WEBHOOKS_PER_USER = 5;

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks — Register a new webhook
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "webhooks");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const body = await req.json();
    const { url, events } = body as { url?: string; events?: string[] };

    // Validate URL
    if (!url || typeof url !== "string") {
      logV1Usage(auth, req, 400, startTime);
      return v1Error("VALIDATION_ERROR", "Missing 'url' field", 400, auth);
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        logV1Usage(auth, req, 400, startTime);
        return v1Error("VALIDATION_ERROR", "Webhook URL must use HTTPS", 400, auth);
      }
    } catch {
      logV1Usage(auth, req, 400, startTime);
      return v1Error("VALIDATION_ERROR", "Invalid URL", 400, auth);
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      logV1Usage(auth, req, 400, startTime);
      return v1Error(
        "VALIDATION_ERROR",
        `Missing 'events' array. Valid events: ${WEBHOOK_EVENT_TYPES.join(", ")}`,
        400,
        auth,
      );
    }

    const invalidEvents = events.filter(
      (e) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(e),
    );
    if (invalidEvents.length > 0) {
      logV1Usage(auth, req, 400, startTime);
      return v1Error(
        "VALIDATION_ERROR",
        `Invalid events: ${invalidEvents.join(", ")}. Valid: ${WEBHOOK_EVENT_TYPES.join(", ")}`,
        400,
        auth,
      );
    }

    // Check limit
    const activeCount = await prisma.webhook.count({
      where: { userId: auth.userId, isActive: true },
    });

    if (activeCount >= MAX_WEBHOOKS_PER_USER) {
      logV1Usage(auth, req, 400, startTime);
      return v1Error(
        "LIMIT_EXCEEDED",
        `Maximum ${MAX_WEBHOOKS_PER_USER} active webhooks per user`,
        400,
        auth,
      );
    }

    // Generate secret
    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    const webhook = await prisma.webhook.create({
      data: {
        userId: auth.userId,
        url,
        events,
        secret,
      },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });

    logV1Usage(auth, req, 201, startTime);
    return v1Success(auth, {
      ...webhook,
      secret, // Returned ONCE at creation time
    });
  } catch (error) {
    console.error("[V1/WEBHOOKS] POST error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to create webhook", 500, auth);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/webhooks — List user's webhooks
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "webhooks");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const webhooks = await prisma.webhook.findMany({
      where: { userId: auth.userId },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      totalDeliveries: w._count.deliveries,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, data);
  } catch (error) {
    console.error("[V1/WEBHOOKS] GET error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to list webhooks", 500, auth);
  }
}
