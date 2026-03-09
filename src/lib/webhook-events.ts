import crypto from "crypto";
import { EventEmitter } from "events";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENT_TYPES = [
  "trend.new",
  "trend.spike",
  "anomaly.detected",
  "narrative.event",
  "narrative.phase_change",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** Map event prefix → required API scope */
export const EVENT_SCOPE_MAP: Record<string, string> = {
  trend: "trends",
  anomaly: "anomalies",
  narrative: "narratives",
};

export function scopeForEvent(eventType: string): string | null {
  const prefix = eventType.split(".")[0];
  return EVENT_SCOPE_MAP[prefix] ?? null;
}

// ---------------------------------------------------------------------------
// Global EventEmitter (singleton like prisma.ts)
// ---------------------------------------------------------------------------

const globalForEvents = globalThis as unknown as { eventBus?: EventEmitter };

export const eventBus: EventEmitter =
  globalForEvents.eventBus ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.eventBus = eventBus;
}

eventBus.setMaxListeners(100);

// ---------------------------------------------------------------------------
// Emit Event
// ---------------------------------------------------------------------------

export interface WebhookEventPayload {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Emit an event: persist to WebhookEvent table + broadcast on in-memory bus.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function emitEvent(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  userId: string | null = null,
): Promise<void> {
  try {
    const id = `evt_${crypto.randomBytes(12).toString("hex")}`;
    const timestamp = new Date().toISOString();

    const payload: WebhookEventPayload = { id, event: eventType, timestamp, data };

    // Persist (fire-and-forget)
    prisma.webhookEvent
      .create({ data: { eventType, userId, payload: payload as unknown as Prisma.InputJsonValue } })
      .catch((err) => console.error("[WEBHOOK-EVENTS] DB persist error:", err));

    // Broadcast on in-memory bus
    eventBus.emit("webhook-event", { ...payload, userId });
  } catch (err) {
    console.error("[WEBHOOK-EVENTS] emitEvent error:", err);
  }
}

// ---------------------------------------------------------------------------
// HMAC Signing
// ---------------------------------------------------------------------------

export function signPayload(secret: string, body: string): string {
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hmac}`;
}
