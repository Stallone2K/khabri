#!/usr/bin/env node

/**
 * Khabri API Test Suite — Full Coverage
 *
 * Tests ALL APIs: 23 v1 endpoints, key management, internal dashboard APIs, and cron jobs.
 *
 * Usage:
 *   # With pre-existing API key (tests v1 endpoints only):
 *   API_KEY="khabri_..." node scripts/test-api.mjs
 *
 *   # With session cookie (tests everything — key mgmt, internal APIs, v1 endpoints):
 *   SESSION_COOKIE="next-auth.session-token=abc" node scripts/test-api.mjs
 *
 *   # Against production:
 *   BASE_URL="https://khabri.app" API_KEY="khabri_..." node scripts/test-api.mjs
 *
 *   # Include cron job tests (requires CRON_SECRET):
 *   CRON_SECRET="your_secret" SESSION_COOKIE="..." node scripts/test-api.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SESSION_COOKIE = process.env.SESSION_COOKIE || "";
const PROVIDED_API_KEY = process.env.API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let skipped = 0;
let apiKey = PROVIDED_API_KEY;
let createdKeyId = "";

// IDs captured from list endpoints to use in detail endpoints
const ids = {
  trend: null,
  signal: null,
  anomaly: null,
  narrative: null,
  webhook: null,
  project: null,
  narrativeNode: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...options.headers };

  if (options.auth === "session" && SESSION_COOKIE) {
    headers["Cookie"] = SESSION_COOKIE;
  } else if (options.auth === "apikey" && apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (options.auth === "invalid") {
    headers["Authorization"] = "Bearer khabri_invalid_key_12345";
  } else if (options.auth === "cron" && CRON_SECRET) {
    headers["Authorization"] = `Bearer ${CRON_SECRET}`;
  }
  // auth === "none" → no auth header

  if (options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
  }

  const fetchOpts = {
    method: options.method || "GET",
    headers,
    signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
  };

  if (options.body) {
    fetchOpts.body =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOpts);
  const contentType = res.headers.get("content-type") || "";

  let data = null;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else if (contentType.includes("text/event-stream")) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      const { value } = await reader.read();
      if (value) text = decoder.decode(value);
    } catch {
      // timeout is fine for SSE
    } finally {
      reader.cancel().catch(() => {});
    }
    data = { __sse: true, chunk: text };
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers, contentType };
}

function test(name, fn) {
  return { name, fn };
}

async function runTest(t) {
  try {
    await t.fn();
    passed++;
    console.log(`  ${green("✓")} ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`  ${red("✗")} ${t.name}`);
    console.log(`    ${dim(err.message)}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  ${yellow("○")} ${name} ${dim(`(skipped: ${reason})`)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(res, expected) {
  assert(
    res.status === expected,
    `Expected status ${expected}, got ${res.status}`,
  );
}

function assertStatusOneOf(res, ...codes) {
  assert(
    codes.includes(res.status),
    `Expected status ${codes.join("|")}, got ${res.status}`,
  );
}

function assertHas(obj, key, label) {
  assert(
    obj && obj[key] !== undefined && obj[key] !== null,
    `Missing "${key}" in ${label || "response"}`,
  );
}

function assertArray(obj, key, label) {
  assert(
    obj && Array.isArray(obj[key]),
    `Expected "${key}" to be an array in ${label || "response"}`,
  );
}

function assertIsArray(val, label) {
  assert(Array.isArray(val), `Expected ${label || "value"} to be an array`);
}

// =========================================================================
// TEST SECTIONS
// =========================================================================

// ---------------------------------------------------------------------------
// 1. KEY MANAGEMENT (Session Auth)
// ---------------------------------------------------------------------------

function keyManagementTests() {
  if (!SESSION_COOKIE) return [];

  const tests = [
    test("POST /api/keys — Create test API key", async () => {
      const res = await request("/api/keys", {
        method: "POST",
        auth: "session",
        body: {
          name: "Test Key (auto-test)",
          scopes: ["trends", "signals", "anomalies", "narratives", "geo", "analytics", "webhooks"],
        },
      });
      assertStatus(res, 201);
      assertHas(res.data, "rawKey", "create key response");
      assertHas(res.data, "id", "create key response");
      assertHas(res.data, "prefix", "create key response");
      if (!PROVIDED_API_KEY) {
        apiKey = res.data.rawKey;
      }
      createdKeyId = res.data.id;
    }),

    test("GET /api/keys — List keys", async () => {
      const res = await request("/api/keys", { auth: "session" });
      assertStatus(res, 200);
      assertArray(res.data, "keys", "list keys response");
      const found = res.data.keys.some((k) => k.id === createdKeyId);
      assert(found, "Created key not found in list");
    }),

    test("PATCH /api/keys/{id} — Update key name", async () => {
      if (!createdKeyId) return skip("PATCH /api/keys/{id}", "no key created");
      const res = await request(`/api/keys/${createdKeyId}`, {
        method: "PATCH",
        auth: "session",
        body: { name: "Renamed Test Key" },
      });
      assertStatus(res, 200);
      assert(res.data.name === "Renamed Test Key", "Name not updated");
    }),

    test("GET /api/keys/usage — Usage analytics", async () => {
      const res = await request("/api/keys/usage?days=7", { auth: "session" });
      assertStatus(res, 200);
      assertHas(res.data, "summary", "usage response");
      assertHas(res.data.summary, "totalRequests", "usage summary");
    }),
  ];

  return tests;
}

// ---------------------------------------------------------------------------
// 2. AUTH & ERROR HANDLING
// ---------------------------------------------------------------------------

function authTests() {
  return [
    test("GET /v1/trends — 401 with no auth", async () => {
      const res = await request("/api/v1/trends", { auth: "none" });
      assertStatus(res, 401);
      assertHas(res.data, "error", "401 response");
      assertHas(res.data.error, "code", "error object");
    }),

    test("GET /v1/trends — 401 with invalid key", async () => {
      const res = await request("/api/v1/trends", { auth: "invalid" });
      assertStatus(res, 401);
      assertHas(res.data, "error", "401 response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 3. V1 PUBLIC API — TRENDS
// ---------------------------------------------------------------------------

function trendsTests() {
  return [
    test("GET /v1/trends (200, paginated)", async () => {
      const res = await request("/api/v1/trends?page=1&page_size=5", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "trends response");
      assertHas(res.data, "meta", "trends response");
      if (Array.isArray(res.data.data) && res.data.data.length > 0) {
        ids.trend = res.data.data[0].id;
      }
    }),

    test("GET /v1/trends/top (200)", async () => {
      const res = await request("/api/v1/trends/top?limit=5", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "top trends response");
    }),

    test("GET /v1/trends/{id} (200)", async () => {
      if (!ids.trend) return skip("GET /v1/trends/{id}", "no trend ID from list");
      const res = await request(`/api/v1/trends/${ids.trend}`, {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "trend detail response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 4. V1 PUBLIC API — SIGNALS
// ---------------------------------------------------------------------------

function signalsTests() {
  return [
    test("GET /v1/signals (200, paginated)", async () => {
      const res = await request("/api/v1/signals?page=1&page_size=5", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "signals response");
      if (Array.isArray(res.data.data) && res.data.data.length > 0) {
        ids.signal = res.data.data[0].id;
      }
    }),

    test("GET /v1/signals/search?q=test (200)", async () => {
      const res = await request("/api/v1/signals/search?q=test", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "signal search response");
    }),

    test("GET /v1/signals/{id} (200)", async () => {
      if (!ids.signal) return skip("GET /v1/signals/{id}", "no signal ID from list");
      const res = await request(`/api/v1/signals/${ids.signal}`, {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "signal detail response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 5. V1 PUBLIC API — ANOMALIES
// ---------------------------------------------------------------------------

function anomaliesTests() {
  return [
    test("GET /v1/anomalies (200, paginated)", async () => {
      const res = await request("/api/v1/anomalies?page=1&page_size=5", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "anomalies response");
    }),

    test("GET /v1/anomalies/trending (200)", async () => {
      const res = await request("/api/v1/anomalies/trending?limit=5", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "trending anomalies response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 6. V1 PUBLIC API — NARRATIVES
// ---------------------------------------------------------------------------

function narrativesTests() {
  return [
    test("GET /v1/narratives (200, paginated)", async () => {
      const res = await request("/api/v1/narratives?page=1&page_size=5", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "narratives response");
      if (Array.isArray(res.data.data) && res.data.data.length > 0) {
        ids.narrative = res.data.data[0].id;
      }
    }),

    test("GET /v1/narratives/{id} (200)", async () => {
      if (!ids.narrative) return skip("GET /v1/narratives/{id}", "no narrative ID from list");
      const res = await request(`/api/v1/narratives/${ids.narrative}`, {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "narrative detail response");
    }),

    test("GET /v1/narratives/{id}/timeline (200)", async () => {
      if (!ids.narrative) return skip("GET /v1/narratives/{id}/timeline", "no narrative ID");
      const res = await request(
        `/api/v1/narratives/${ids.narrative}/timeline`,
        { auth: "apikey" },
      );
      assertStatus(res, 200);
      assertHas(res.data, "data", "narrative timeline response");
    }),

    test("GET /v1/narratives/{id}/stakeholders (200)", async () => {
      if (!ids.narrative) return skip("GET /v1/narratives/{id}/stakeholders", "no narrative ID");
      const res = await request(
        `/api/v1/narratives/${ids.narrative}/stakeholders`,
        { auth: "apikey" },
      );
      assertStatus(res, 200);
      assertHas(res.data, "data", "narrative stakeholders response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 7. V1 PUBLIC API — GEO
// ---------------------------------------------------------------------------

function geoTests() {
  return [
    test("GET /v1/geo/hotspots (200)", async () => {
      const res = await request("/api/v1/geo/hotspots?hours=24&limit=5", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "geo hotspots response");
    }),

    test("GET /v1/geo/search?location=India (200)", async () => {
      const res = await request("/api/v1/geo/search?location=India", {
        auth: "apikey",
        timeout: 15000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "geo search response");
    }),

    test("GET /v1/geo/IN (200)", async () => {
      const res = await request("/api/v1/geo/IN?hours=24", {
        auth: "apikey",
        timeout: 15000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "country intel response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 8. V1 PUBLIC API — ANALYTICS
// ---------------------------------------------------------------------------

function analyticsTests() {
  return [
    test("GET /v1/analytics/volume (200)", async () => {
      const res = await request("/api/v1/analytics/volume?hours=24", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "analytics volume response");
    }),

    test("GET /v1/analytics/categories (200)", async () => {
      const res = await request("/api/v1/analytics/categories?hours=24", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "analytics categories response");
    }),

    test("GET /v1/analytics/sentiment (200)", async () => {
      const res = await request("/api/v1/analytics/sentiment?hours=24", {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "analytics sentiment response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 9. V1 PUBLIC API — WEBHOOKS
// ---------------------------------------------------------------------------

function webhooksTests() {
  return [
    test("POST /v1/webhooks — Create webhook", async () => {
      const res = await request("/api/v1/webhooks", {
        method: "POST",
        auth: "apikey",
        body: {
          url: "https://example.com/test-webhook",
          events: ["trend.new"],
        },
      });
      assertStatusOneOf(res, 200, 201);
      assertHas(res.data, "data", "create webhook response");
      assertHas(res.data.data, "id", "webhook object");
      assertHas(res.data.data, "secret", "webhook object (secret)");
      ids.webhook = res.data.data.id;
    }),

    test("GET /v1/webhooks — List webhooks (200)", async () => {
      const res = await request("/api/v1/webhooks", { auth: "apikey" });
      assertStatus(res, 200);
      assertHas(res.data, "data", "list webhooks response");
      assert(Array.isArray(res.data.data), "Expected data to be an array");
    }),

    test("GET /v1/webhooks/{id} (200)", async () => {
      if (!ids.webhook) return skip("GET /v1/webhooks/{id}", "no webhook ID");
      const res = await request(`/api/v1/webhooks/${ids.webhook}`, {
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "webhook detail response");
      assert(res.data.data.id === ids.webhook, `ID mismatch`);
    }),

    test("DELETE /v1/webhooks/{id} — Deactivate (200)", async () => {
      if (!ids.webhook) return skip("DELETE /v1/webhooks/{id}", "no webhook ID");
      const res = await request(`/api/v1/webhooks/${ids.webhook}`, {
        method: "DELETE",
        auth: "apikey",
      });
      assertStatus(res, 200);
      assertHas(res.data, "data", "delete webhook response");
      assert(res.data.data.deactivated === true, "Expected deactivated: true");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 10. V1 PUBLIC API — STREAM (SSE)
// ---------------------------------------------------------------------------

function streamTests() {
  return [
    test("GET /v1/stream — SSE connection (200, text/event-stream)", async () => {
      const res = await request("/api/v1/stream?events=trend.new", {
        auth: "apikey",
        timeout: 5000,
      });
      assertStatus(res, 200);
      assert(
        res.contentType.includes("text/event-stream"),
        `Expected text/event-stream, got ${res.contentType}`,
      );
      if (res.data.__sse && res.data.chunk) {
        assert(
          res.data.chunk.includes("connected"),
          "Expected 'connected' event in SSE stream",
        );
      }
    }),
  ];
}

// ---------------------------------------------------------------------------
// 11. INTERNAL — DASHBOARD STATS (Session/Dual Auth)
// ---------------------------------------------------------------------------

function dashboardTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/dashboard/stats (200)", async () => {
      const res = await request("/api/dashboard/stats", { auth: "session" });
      assertStatus(res, 200);
      assertHas(res.data, "signalsProcessed", "dashboard stats");
      assertHas(res.data, "criticalTrends", "dashboard stats");
      assertHas(res.data, "trendVelocity", "dashboard stats");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 12. INTERNAL — ARTICLES (Session/Dual Auth)
// ---------------------------------------------------------------------------

function articlesTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/articles (200)", async () => {
      const res = await request("/api/articles", { auth: "session" });
      assertStatus(res, 200);
      assertIsArray(res.data, "articles response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 13. INTERNAL — INTELLIGENCE (Session/Dual Auth)
// ---------------------------------------------------------------------------

function intelligenceTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/intelligence/anomalies (200)", async () => {
      const res = await request("/api/intelligence/anomalies", { auth: "session" });
      assertStatus(res, 200);
      assertHas(res.data, "anomalies", "anomalies response");
      assertHas(res.data, "counts", "anomalies response");
    }),

    test("GET /api/intelligence/trending (200)", async () => {
      const res = await request("/api/intelligence/trending?limit=5", { auth: "session" });
      assertStatus(res, 200);
      assertHas(res.data, "items", "trending response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 14. INTERNAL — TRENDS (Session/Dual Auth)
// ---------------------------------------------------------------------------

function internalTrendsTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/trends/list (200)", async () => {
      const res = await request("/api/trends/list?page=1", { auth: "session" });
      assertStatus(res, 200);
      assertHas(res.data, "trends", "trends list response");
      assertHas(res.data, "pagination", "trends list response");
    }),

    test("GET /api/trends/ticker (200)", async () => {
      const res = await request("/api/trends/ticker", { auth: "session" });
      assertStatus(res, 200);
      assertIsArray(res.data, "ticker response");
    }),

    test("GET /api/trends/graph (200)", async () => {
      const res = await request("/api/trends/graph?hours=24", {
        auth: "session",
        timeout: 15000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "chartData", "graph response");
      assertHas(res.data, "trends", "graph response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 15. INTERNAL — GEO SEARCH (Session/Dual Auth)
// ---------------------------------------------------------------------------

function internalGeoTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/geo/search?location=India (200)", async () => {
      const res = await request("/api/geo/search?location=India", {
        auth: "session",
        timeout: 15000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "location", "geo search response");
      assertHas(res.data, "signals", "geo search response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 16. INTERNAL — USER LOCATION (Session Auth)
// ---------------------------------------------------------------------------

function userLocationTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/user/location (200)", async () => {
      const res = await request("/api/user/location", { auth: "session" });
      assertStatus(res, 200);
      // countryCode may be null if not set, but the response should exist
      assert(
        res.data && typeof res.data === "object",
        "Expected JSON object response",
      );
    }),
  ];
}

// ---------------------------------------------------------------------------
// 17. INTERNAL — SOURCES (Session Auth)
// ---------------------------------------------------------------------------

function sourcesTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/sources (200)", async () => {
      const res = await request("/api/sources", { auth: "session" });
      assertStatus(res, 200);
      assertIsArray(res.data, "sources response");
    }),

    test("GET /api/sources/stats (200)", async () => {
      const res = await request("/api/sources/stats", { auth: "session" });
      assertStatus(res, 200);
      assertIsArray(res.data, "sources stats response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 18. INTERNAL — PROJECTS (Session Auth)
// ---------------------------------------------------------------------------

function projectsTests() {
  if (!SESSION_COOKIE) return [];

  return [
    test("GET /api/projects — List projects (200)", async () => {
      const res = await request("/api/projects", { auth: "session" });
      assertStatus(res, 200);
      assertIsArray(res.data, "projects response");
      if (res.data.length > 0) {
        ids.project = res.data[0].id;
      }
    }),

    test("GET /api/projects/{id} (200)", async () => {
      if (!ids.project) return skip("GET /api/projects/{id}", "no project found");
      const res = await request(`/api/projects/${ids.project}`, { auth: "session" });
      assertStatus(res, 200);
      assertHas(res.data, "id", "project detail response");
    }),

    test("GET /api/projects/{id}/narratives (200)", async () => {
      if (!ids.project) return skip("GET /api/projects/{id}/narratives", "no project found");
      const res = await request(`/api/projects/${ids.project}/narratives`, {
        auth: "session",
      });
      assertStatus(res, 200);
      // Response could be { root: ... } or similar
      assert(res.data && typeof res.data === "object", "Expected object response");
    }),

    test("GET /api/projects/{id}/stakeholders (200)", async () => {
      if (!ids.project) return skip("GET /api/projects/{id}/stakeholders", "no project found");
      const res = await request(`/api/projects/${ids.project}/stakeholders`, {
        auth: "session",
      });
      assertStatus(res, 200);
      assertHas(res.data, "stakeholders", "stakeholders response");
    }),

    test("GET /api/projects/{id}/export (200)", async () => {
      if (!ids.project) return skip("GET /api/projects/{id}/export", "no project found");
      const res = await request(`/api/projects/${ids.project}/export`, {
        auth: "session",
      });
      // Export returns a file stream (200) or could be JSON
      assertStatusOneOf(res, 200, 404);
    }),
  ];
}

// ---------------------------------------------------------------------------
// 19. CRON JOBS (Cron Secret Auth)
// ---------------------------------------------------------------------------

function cronTests() {
  if (!CRON_SECRET) return [];

  return [
    test("POST /api/cron/enrich (200)", async () => {
      const res = await request("/api/cron/enrich", {
        method: "POST",
        auth: "cron",
        timeout: 60000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "success", "enrich cron response");
    }),

    test("POST /api/cron/anomaly (200)", async () => {
      const res = await request("/api/cron/anomaly", {
        method: "POST",
        auth: "cron",
        timeout: 60000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "success", "anomaly cron response");
    }),

    test("POST /api/cron/trend-monitor (200)", async () => {
      const res = await request("/api/cron/trend-monitor", {
        method: "POST",
        auth: "cron",
        timeout: 60000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "success", "trend-monitor cron response");
    }),

    test("POST /api/cron/usage-aggregate (200)", async () => {
      const res = await request("/api/cron/usage-aggregate", {
        method: "POST",
        auth: "cron",
        timeout: 30000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "success", "usage-aggregate cron response");
    }),

    test("POST /api/cron/webhook-deliver (200)", async () => {
      const res = await request("/api/cron/webhook-deliver", {
        method: "POST",
        auth: "cron",
        timeout: 30000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "success", "webhook-deliver cron response");
    }),

    test("POST /api/cron/webhook-cleanup (200)", async () => {
      const res = await request("/api/cron/webhook-cleanup", {
        method: "POST",
        auth: "cron",
        timeout: 30000,
      });
      assertStatus(res, 200);
      assertHas(res.data, "success", "webhook-cleanup cron response");
    }),
  ];
}

// ---------------------------------------------------------------------------
// 20. CLEANUP
// ---------------------------------------------------------------------------

function cleanupTests() {
  if (!createdKeyId || !SESSION_COOKIE) return [];

  return [
    test("DELETE /api/keys/{id} — Remove test key", async () => {
      const res = await request(`/api/keys/${createdKeyId}`, {
        method: "DELETE",
        auth: "session",
      });
      assertStatus(res, 200);
      assert(res.data.success === true, "Expected success: true");
    }),
  ];
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runSection(label, tests) {
  if (tests.length === 0) return;
  console.log(`\n${cyan(`[${label}]`)}`);
  for (const t of tests) {
    await runTest(t);
  }
}

async function main() {
  console.log(bold("\nKhabri API Test Suite — Full Coverage"));
  console.log("=".repeat(50));
  console.log(`Base URL: ${dim(BASE_URL)}`);
  console.log(
    `Auth: ${dim(
      [
        PROVIDED_API_KEY ? "API key" : "",
        SESSION_COOKIE ? "Session cookie" : "",
        CRON_SECRET ? "Cron secret" : "",
      ]
        .filter(Boolean)
        .join(" + ") || "None — provide API_KEY or SESSION_COOKIE",
    )}`,
  );

  if (!apiKey && !SESSION_COOKIE) {
    console.error(
      red("\nError: Provide API_KEY or SESSION_COOKIE env variable."),
    );
    process.exit(1);
  }

  // === KEY MANAGEMENT ===
  const keyMgmt = keyManagementTests();
  if (keyMgmt.length > 0) {
    await runSection("KEY MANAGEMENT", keyMgmt);
    if (!apiKey) {
      console.error(red("\nSetup failed — cannot continue without API key."));
      process.exit(1);
    }
  }

  // === AUTH ERRORS ===
  await runSection("AUTH", authTests());

  // === V1 PUBLIC API (23 endpoints) ===
  await runSection("V1 TRENDS", trendsTests());
  await runSection("V1 SIGNALS", signalsTests());
  await runSection("V1 ANOMALIES", anomaliesTests());
  await runSection("V1 NARRATIVES", narrativesTests());
  await runSection("V1 GEO", geoTests());
  await runSection("V1 ANALYTICS", analyticsTests());
  await runSection("V1 WEBHOOKS", webhooksTests());
  await runSection("V1 STREAM", streamTests());

  // === INTERNAL DASHBOARD APIs ===
  await runSection("DASHBOARD STATS", dashboardTests());
  await runSection("ARTICLES", articlesTests());
  await runSection("INTELLIGENCE", intelligenceTests());
  await runSection("INTERNAL TRENDS", internalTrendsTests());
  await runSection("INTERNAL GEO", internalGeoTests());
  await runSection("USER LOCATION", userLocationTests());
  await runSection("SOURCES", sourcesTests());
  await runSection("PROJECTS", projectsTests());

  // === CRON JOBS ===
  await runSection("CRON JOBS", cronTests());

  // === CLEANUP ===
  await runSection("CLEANUP", cleanupTests());

  // Summary
  const total = passed + failed;
  console.log(`\n${"=".repeat(50)}`);
  console.log(
    `Results: ${green(`${passed} passed`)}, ${
      failed > 0 ? red(`${failed} failed`) : `${failed} failed`
    }${skipped > 0 ? `, ${yellow(`${skipped} skipped`)}` : ""} ${dim(
      `(${total} total)`,
    )}`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
