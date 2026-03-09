export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/api-keys";
import {
  eventBus,
  scopeForEvent,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventPayload,
} from "@/lib/webhook-events";
import { startWebhookDispatcher } from "@/lib/webhook-dispatch";

// Ensure the dispatcher listener is attached
startWebhookDispatcher();

const HEARTBEAT_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// GET /api/v1/stream — Server-Sent Events
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  // Manual API key auth (can't use v1 helpers — response is a stream, not JSON)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer khabri_")) {
    return new Response(
      JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "API key required" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const rawKey = authHeader.slice(7);
  const hashedKey = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { key: hashedKey },
    select: {
      id: true,
      userId: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
    },
  });

  if (
    !apiKey ||
    !apiKey.isActive ||
    (apiKey.expiresAt && apiKey.expiresAt < new Date())
  ) {
    return new Response(
      JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "Invalid or expired API key" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse requested events
  const { searchParams } = new URL(req.url);
  const eventsParam = searchParams.get("events");

  let requestedEvents: string[];
  if (eventsParam) {
    requestedEvents = eventsParam.split(",").filter((e) =>
      (WEBHOOK_EVENT_TYPES as readonly string[]).includes(e.trim()),
    );
    if (requestedEvents.length === 0) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: `No valid events. Available: ${WEBHOOK_EVENT_TYPES.join(", ")}`,
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  } else {
    // Default: all events the key has scopes for
    requestedEvents = WEBHOOK_EVENT_TYPES.filter((e) => {
      const scope = scopeForEvent(e);
      return scope && apiKey.scopes.includes(scope);
    });
  }

  // Validate scopes for requested events
  for (const event of requestedEvents) {
    const scope = scopeForEvent(event);
    if (scope && !apiKey.scopes.includes(scope)) {
      return new Response(
        JSON.stringify({
          error: {
            code: "FORBIDDEN",
            message: `API key missing scope '${scope}' for event '${event}'`,
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const userId = apiKey.userId;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(eventName: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      // Send connected event
      send("connected", {
        events: requestedEvents,
        message: "Streaming started",
      });

      // Heartbeat
      const heartbeat = setInterval(() => {
        try {
          send("heartbeat", { timestamp: new Date().toISOString() });
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Event listener
      function onEvent(event: WebhookEventPayload & { userId: string | null }) {
        // Filter: only requested event types
        if (!requestedEvents.includes(event.event)) return;

        // User scoping: global events (userId=null) go to all; user events only to matching user
        if (event.userId && event.userId !== userId) return;

        const { userId: _, ...payload } = event;
        send(event.event, payload);
      }

      eventBus.on("webhook-event", onEvent);

      // Cleanup on abort
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        eventBus.off("webhook-event", onEvent);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
