import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  eventBus,
  signPayload,
  type WebhookEventPayload,
} from "@/lib/webhook-events";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000]; // 1min, 5min, 30min
const DELIVERY_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Listen for events and dispatch to webhooks
// ---------------------------------------------------------------------------

let listenerAttached = false;

export function startWebhookDispatcher(): void {
  if (listenerAttached) return;
  listenerAttached = true;

  eventBus.on(
    "webhook-event",
    (event: WebhookEventPayload & { userId: string | null }) => {
      dispatchEvent(event, event.userId).catch((err) =>
        console.error("[WEBHOOK-DISPATCH] dispatch error:", err),
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Dispatch Event to matching webhooks
// ---------------------------------------------------------------------------

async function dispatchEvent(
  event: WebhookEventPayload,
  userId: string | null,
): Promise<void> {
  // Find matching webhooks
  const where: Record<string, unknown> = {
    isActive: true,
    events: { has: event.event },
  };
  if (userId) where.userId = userId;

  const webhooks = await prisma.webhook.findMany({
    where,
    select: { id: true, url: true, secret: true },
  });

  if (webhooks.length === 0) return;

  // Create delivery records and attempt inline
  for (const webhook of webhooks) {
    try {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType: event.event,
          payload: event as unknown as Prisma.InputJsonValue,
          status: "PENDING",
        },
      });

      // Fire-and-forget inline delivery
      attemptDelivery(delivery.id, webhook.url, webhook.secret, event).catch(
        (err) =>
          console.error(
            `[WEBHOOK-DISPATCH] inline delivery error for ${delivery.id}:`,
            err,
          ),
      );
    } catch (err) {
      console.error(
        `[WEBHOOK-DISPATCH] Failed to create delivery for webhook ${webhook.id}:`,
        err,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Attempt a single delivery
// ---------------------------------------------------------------------------

export async function attemptDelivery(
  deliveryId: string,
  url: string,
  secret: string,
  event: WebhookEventPayload,
): Promise<void> {
  const body = JSON.stringify(event);
  const signature = signPayload(secret, body);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      DELIVERY_TIMEOUT_MS,
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Khabri-Signature": signature,
        "X-Khabri-Event": event.event,
        "X-Khabri-Delivery": deliveryId,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await res.text().catch(() => "");

    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SUCCESS",
          statusCode: res.status,
          responseBody: responseBody.slice(0, 1000),
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          nextRetryAt: null,
        },
      });
    } else {
      await handleFailure(deliveryId, res.status, responseBody.slice(0, 1000));
    }
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown delivery error";
    await handleFailure(deliveryId, null, errorMsg);
  }
}

// ---------------------------------------------------------------------------
// Handle failed delivery — schedule retry or mark FAILED
// ---------------------------------------------------------------------------

async function handleFailure(
  deliveryId: string,
  statusCode: number | null,
  error: string,
): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { attempts: true },
  });

  const currentAttempt = (delivery?.attempts ?? 0) + 1;

  if (currentAttempt >= MAX_ATTEMPTS) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        statusCode,
        error,
        attempts: currentAttempt,
        lastAttemptAt: new Date(),
        nextRetryAt: null,
      },
    });
  } else {
    const delayMs = RETRY_DELAYS_MS[currentAttempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        statusCode,
        error,
        attempts: currentAttempt,
        lastAttemptAt: new Date(),
        nextRetryAt: new Date(Date.now() + delayMs),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Retry pending deliveries (called by cron)
// ---------------------------------------------------------------------------

export async function retryPendingDeliveries(): Promise<number> {
  const now = new Date();

  const pending = await prisma.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: now },
    },
    include: {
      webhook: { select: { url: true, secret: true, isActive: true } },
    },
    take: 50,
    orderBy: { nextRetryAt: "asc" },
  });

  let retried = 0;

  for (const delivery of pending) {
    if (!delivery.webhook.isActive) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", error: "Webhook deactivated" },
      });
      continue;
    }

    const event = delivery.payload as unknown as WebhookEventPayload;
    await attemptDelivery(
      delivery.id,
      delivery.webhook.url,
      delivery.webhook.secret,
      event,
    );
    retried++;
  }

  return retried;
}
