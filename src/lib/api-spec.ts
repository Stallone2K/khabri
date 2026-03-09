// OpenAPI 3.1 Specification for the Khabri Intelligence API
// Covers all 23 versioned /api/v1/* endpoints

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Khabri Intelligence API",
    version: "1.0.0",
    description: `Real-time intelligence platform API providing access to trend analysis, signal monitoring, anomaly detection, narrative tracking, geographic intelligence, and analytics.

## Authentication

All endpoints require a Bearer token. Include your API key in the Authorization header:

\`\`\`
Authorization: Bearer khabri_your_api_key
\`\`\`

API keys are scoped — you must have the appropriate scope for each endpoint group:

| Scope | Endpoints |
|-------|-----------|
| \`trends\` | /v1/trends/* |
| \`signals\` | /v1/signals/* |
| \`anomalies\` | /v1/anomalies/* |
| \`narratives\` | /v1/narratives/* |
| \`geo\` | /v1/geo/* |
| \`analytics\` | /v1/analytics/* |
| \`webhooks\` | /v1/webhooks/*, /v1/stream |

## Rate Limiting

Rate limits are per API key using a sliding window (1 minute). Default: 100 requests/minute (configurable per key, max 10,000).

Every response includes rate limit headers:
- \`X-RateLimit-Limit\` — Maximum requests per window
- \`X-RateLimit-Remaining\` — Remaining requests in current window
- \`X-RateLimit-Reset\` — Unix timestamp (seconds) when the window resets

When rate limited, you receive HTTP 429.

## Error Format

All errors follow this structure:
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
\`\`\`

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid parameters |
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 403 | FORBIDDEN | Insufficient scope |
| 404 | NOT_FOUND | Resource not found |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

## Pagination

Paginated endpoints accept \`page\` (1-based) and \`page_size\` (default 25, max 100) query parameters. Responses include a \`meta\` object with \`total\`, \`page\`, \`pageSize\`, and \`hasMore\`.

## Server-Sent Events

The \`/v1/stream\` endpoint provides real-time events via SSE. Connect with EventSource or any SSE client. Events include a heartbeat every 30 seconds.`,
  },
  servers: [
    { url: "https://khabri.stallone.co.in/api/v1", description: "Production" },
    { url: "http://localhost:3000/api/v1", description: "Development" },
  ],
  security: [{ BearerAuth: [] }],
  tags: [
    { name: "Trends", description: "Ranked trend analysis and tracking" },
    { name: "Signals", description: "Signal monitoring with enrichment data" },
    { name: "Anomalies", description: "Anomaly detection and trending spikes" },
    { name: "Narratives", description: "Narrative tree tracking and stakeholder analysis" },
    { name: "Geo", description: "Geographic intelligence and hotspot analysis" },
    { name: "Analytics", description: "Signal volume, category, and sentiment analytics" },
    { name: "Webhooks", description: "Webhook registration and delivery management" },
    { name: "Stream", description: "Real-time Server-Sent Events" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "khabri_xxxxxxxxxx",
        description: "API key with khabri_ prefix. Obtain from the Developer Portal.",
      },
    },
    parameters: {
      page: { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 }, description: "Page number (1-based)" },
      pageSize: { name: "page_size", in: "query", schema: { type: "integer", default: 25, minimum: 1, maximum: 100 }, description: "Items per page (also accepts `limit`)" },
      hours: { name: "hours", in: "query", schema: { type: "integer", default: 24, minimum: 1, maximum: 72 }, description: "Time window in hours" },
    },
    schemas: {
      // --- Trends ---
      Trend: {
        type: "object",
        properties: {
          id: { type: "string" },
          rank: { type: "integer" },
          topic: { type: "string" },
          score: { type: "integer" },
          reason: { type: "string" },
          category: { type: "string", nullable: true },
          region: { type: "string", nullable: true, enum: ["DOMESTIC", "INTERNATIONAL"] },
          originalUrl: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      TrendWithMomentum: {
        type: "object",
        properties: {
          id: { type: "string" },
          rank: { type: "integer" },
          topic: { type: "string" },
          score: { type: "integer" },
          change: { type: "string", enum: ["up", "down", "neutral"] },
          volume: { type: "integer" },
        },
      },
      // --- Signals ---
      Signal: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          source: { type: "string" },
          category: { type: "string", nullable: true },
          sentiment: { type: "string", nullable: true, enum: ["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"] },
          sentimentScore: { type: "number", nullable: true, minimum: -1, maximum: 1 },
          publishedAt: { type: "string", format: "date-time" },
          isEnriched: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          entities: { type: "array", items: { $ref: "#/components/schemas/SignalEntity" } },
          keywords: { type: "array", items: { $ref: "#/components/schemas/SignalKeyword" } },
          locations: { type: "array", items: { $ref: "#/components/schemas/SignalLocation" } },
        },
      },
      SignalDetail: {
        allOf: [
          { $ref: "#/components/schemas/Signal" },
          { type: "object", properties: { enrichedAt: { type: "string", format: "date-time", nullable: true } } },
        ],
      },
      SignalEntity: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["PERSON", "ORG", "COMPANY", "COUNTRY", "LOCATION"] },
          salience: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      SignalKeyword: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          weight: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      SignalLocation: {
        type: "object",
        properties: {
          name: { type: "string" },
          locationType: { type: "string", enum: ["CITY", "STATE", "COUNTRY", "REGION"] },
          countryCode: { type: "string", nullable: true },
          lat: { type: "number", nullable: true },
          lng: { type: "number", nullable: true },
        },
      },
      // --- Anomalies ---
      AnomalyEvent: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["KEYWORD_SPIKE", "ENTITY_SURGE", "SENTIMENT_SHIFT", "GEO_CONCENTRATION"] },
          key: { type: "string" },
          label: { type: "string" },
          zScore: { type: "number" },
          currentValue: { type: "number" },
          baselineMean: { type: "number" },
          baselineStdDev: { type: "number" },
          severity: { type: "string", enum: ["ELEVATED", "HIGH", "CRITICAL"] },
          isResolved: { type: "boolean" },
          metadata: { type: "object", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      TrendingAnomaly: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          dimension: { type: "string", enum: ["KEYWORD", "ENTITY", "COUNTRY", "SENTIMENT"] },
          zScore: { type: "number" },
          severity: { type: "string" },
          currentValue: { type: "number" },
          baselineMean: { type: "number" },
          sparkline: { type: "array", items: { type: "number" }, description: "24-hour hourly data points" },
        },
      },
      // --- Narratives ---
      NarrativeNode: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string", nullable: true },
          keywords: { type: "array", items: { type: "string" } },
          status: { type: "string" },
          signalCount: { type: "integer" },
          lastSignalAt: { type: "string", format: "date-time", nullable: true },
          arcPhase: { type: "string", nullable: true, enum: ["EMERGENCE", "ESCALATION", "PEAK", "RESOLUTION"] },
          projectId: { type: "string" },
          childCount: { type: "integer" },
          eventCount: { type: "integer" },
          stakeholderCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      NarrativeTree: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string", nullable: true },
          keywords: { type: "array", items: { type: "string" } },
          status: { type: "string" },
          signalCount: { type: "integer" },
          lastSignalAt: { type: "string", format: "date-time", nullable: true },
          arcPhase: { type: "string", nullable: true },
          events: { type: "array", items: { $ref: "#/components/schemas/NarrativeEvent" } },
          stakeholders: { type: "array", items: { $ref: "#/components/schemas/Stakeholder" } },
          children: { type: "array", items: { $ref: "#/components/schemas/NarrativeTree" } },
        },
      },
      NarrativeEvent: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string", nullable: true },
          sourceUrl: { type: "string", nullable: true },
          impactScore: { type: "number", nullable: true },
          sentiment: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Stakeholder: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["PERSON", "ORG", "COMPANY", "COUNTRY"] },
          role: { type: "string", nullable: true, enum: ["PROTAGONIST", "ANTAGONIST", "REGULATOR", "OBSERVER"] },
          sentiment: { type: "number", nullable: true, minimum: -1, maximum: 1 },
          mentionCount: { type: "integer" },
          lastSeenAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      NarrativeTimeline: {
        type: "object",
        properties: {
          nodeId: { type: "string" },
          phase: { type: "string", nullable: true },
          dataPoints: { type: "array", items: { type: "object", properties: { timestamp: { type: "string", format: "date-time" }, value: { type: "number" } } } },
        },
      },
      // --- Geo ---
      GeoHotspot: {
        type: "object",
        properties: {
          countryCode: { type: "string" },
          name: { type: "string" },
          signalCount: { type: "integer" },
          topCategory: { type: "string", nullable: true },
          dominantSentiment: { type: "string", nullable: true },
        },
      },
      GeoSearchResult: {
        type: "object",
        properties: {
          location: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, type: { type: "string" }, countryCode: { type: "string", nullable: true } } },
          scope: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, type: { type: "string" } } },
          ancestors: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, countryCode: { type: "string", nullable: true } } } },
          signals: { type: "array", items: { $ref: "#/components/schemas/GeoSignal" } },
          signalCount: { type: "integer" },
          briefing: { type: "string", nullable: true },
        },
      },
      CountryIntel: {
        type: "object",
        properties: {
          country: { type: "object", properties: { code: { type: "string" }, name: { type: "string" } } },
          signalCount: { type: "integer" },
          signals: { type: "array", items: { $ref: "#/components/schemas/GeoSignal" } },
          categories: { type: "object", additionalProperties: { type: "integer" } },
          sentimentBreakdown: { type: "object", additionalProperties: { type: "integer" } },
          briefing: { type: "string", nullable: true },
        },
      },
      GeoSignal: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          source: { type: "string" },
          category: { type: "string", nullable: true },
          sentiment: { type: "string", nullable: true },
          sentimentScore: { type: "number", nullable: true },
          publishedAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      // --- Analytics ---
      VolumeData: {
        type: "object",
        properties: {
          interval: { type: "string", enum: ["hour", "day"] },
          dataPoints: { type: "array", items: { type: "object", properties: { timestamp: { type: "string", format: "date-time" }, count: { type: "integer" } } } },
          total: { type: "integer" },
        },
      },
      CategoryData: {
        type: "object",
        properties: {
          categories: { type: "array", items: { type: "object", properties: { name: { type: "string" }, count: { type: "integer" }, percentage: { type: "number" } } } },
          total: { type: "integer" },
          uncategorized: { type: "integer" },
        },
      },
      SentimentData: {
        type: "object",
        properties: {
          interval: { type: "string", enum: ["hour", "day"] },
          dataPoints: { type: "array", items: { type: "object", properties: { timestamp: { type: "string", format: "date-time" }, positive: { type: "integer" }, negative: { type: "integer" }, neutral: { type: "integer" }, mixed: { type: "integer" }, avgScore: { type: "number" } } } },
          overall: { type: "object", properties: { positive: { type: "integer" }, negative: { type: "integer" }, neutral: { type: "integer" }, mixed: { type: "integer" }, avgScore: { type: "number" } } },
        },
      },
      // --- Webhooks ---
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          events: { type: "array", items: { type: "string", enum: ["trend.new", "trend.spike", "anomaly.detected", "narrative.event", "narrative.phase_change"] } },
          isActive: { type: "boolean" },
          totalDeliveries: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      WebhookCreated: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          events: { type: "array", items: { type: "string" } },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          secret: { type: "string", description: "HMAC signing secret. Returned ONCE at creation — store it securely." },
        },
      },
      WebhookDetail: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          events: { type: "array", items: { type: "string" } },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          deliveries: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } },
        },
      },
      WebhookDelivery: {
        type: "object",
        properties: {
          id: { type: "string" },
          eventType: { type: "string" },
          status: { type: "string", enum: ["PENDING", "SUCCESS", "FAILED"] },
          attempts: { type: "integer" },
          statusCode: { type: "integer", nullable: true },
          error: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          lastAttemptAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      // --- Common ---
      ApiError: {
        type: "object",
        properties: {
          error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } },
        },
      },
      RateLimitMeta: {
        type: "object",
        properties: {
          limit: { type: "integer" },
          remaining: { type: "integer" },
          reset: { type: "integer", description: "Seconds until rate limit resets" },
        },
      },
    },
    responses: {
      Unauthorized: { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
      Forbidden: { description: "Insufficient scope", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
      NotFound: { description: "Resource not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
      InternalError: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
    },
  },
  paths: {
    // ===== TRENDS =====
    "/trends": {
      get: {
        operationId: "listTrends",
        summary: "List ranked trends",
        tags: ["Trends"],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
          { name: "category", in: "query", schema: { type: "string" }, description: "Filter by category" },
          { name: "region", in: "query", schema: { type: "string", enum: ["DOMESTIC", "INTERNATIONAL"] }, description: "Filter by region" },
          { name: "min_score", in: "query", schema: { type: "integer" }, description: "Minimum score threshold" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["rank", "score", "created_at"], default: "rank" }, description: "Sort order" },
        ],
        responses: {
          200: { description: "Paginated list of trends", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Trend" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/trends/top": {
      get: {
        operationId: "getTopTrends",
        summary: "Get top trending topics with momentum",
        tags: ["Trends"],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 10, minimum: 1, maximum: 30 }, description: "Number of top trends" },
          { name: "region", in: "query", schema: { type: "string", enum: ["DOMESTIC", "INTERNATIONAL"] } },
        ],
        responses: {
          200: { description: "Top trends with momentum data", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/TrendWithMomentum" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/trends/{id}": {
      get: {
        operationId: "getTrendById",
        summary: "Get a single trend",
        tags: ["Trends"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Trend details", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Trend" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    // ===== SIGNALS =====
    "/signals": {
      get: {
        operationId: "listSignals",
        summary: "List signals with enrichment data",
        tags: ["Signals"],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "sentiment", in: "query", schema: { type: "string", enum: ["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"] } },
          { name: "source", in: "query", schema: { type: "string" }, description: "Filter by source (partial match)" },
          { name: "since", in: "query", schema: { type: "string", format: "date-time" }, description: "Show signals after this date" },
          { name: "enriched", in: "query", schema: { type: "string", enum: ["true", "false"] }, description: "Filter by enrichment status" },
        ],
        responses: {
          200: { description: "Paginated signals with enrichment", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Signal" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/signals/search": {
      get: {
        operationId: "searchSignals",
        summary: "Search signals by text, entity, or location",
        description: "At least one of `q`, `entity`, `location`, or `country` is required.",
        tags: ["Signals"],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
          { name: "q", in: "query", schema: { type: "string" }, description: "Full-text search on title" },
          { name: "entity", in: "query", schema: { type: "string" }, description: "Entity name (partial match)" },
          { name: "entity_type", in: "query", schema: { type: "string" }, description: "Entity type filter (requires entity)" },
          { name: "location", in: "query", schema: { type: "string" }, description: "Location name (partial match)" },
          { name: "country", in: "query", schema: { type: "string" }, description: "ISO 3166-1 alpha-2 country code" },
        ],
        responses: {
          200: { description: "Matching signals", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Signal" } }, meta: { type: "object" } } } } } },
          400: { description: "Missing search parameter", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/signals/{id}": {
      get: {
        operationId: "getSignalById",
        summary: "Get a single signal with full enrichment",
        tags: ["Signals"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Signal details", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/SignalDetail" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    // ===== ANOMALIES =====
    "/anomalies": {
      get: {
        operationId: "listAnomalies",
        summary: "List detected anomalies with severity summary",
        tags: ["Anomalies"],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
          { name: "type", in: "query", schema: { type: "string", enum: ["KEYWORD_SPIKE", "ENTITY_SURGE", "SENTIMENT_SHIFT", "GEO_CONCENTRATION"] } },
          { name: "severity", in: "query", schema: { type: "string", enum: ["CRITICAL", "HIGH", "ELEVATED"] } },
          { name: "active", in: "query", schema: { type: "string", enum: ["true", "false"], default: "true" }, description: "Filter by resolved status" },
        ],
        responses: {
          200: { description: "Anomalies with severity summary", content: { "application/json": { schema: { type: "object", properties: { data: { type: "object", properties: { anomalies: { type: "array", items: { $ref: "#/components/schemas/AnomalyEvent" } }, summary: { type: "object", properties: { total: { type: "integer" }, critical: { type: "integer" }, high: { type: "integer" }, elevated: { type: "integer" } } } } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/anomalies/trending": {
      get: {
        operationId: "getTrendingAnomalies",
        summary: "Get trending anomalies with 24h sparklines",
        tags: ["Anomalies"],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 10, minimum: 1, maximum: 20 } },
          { name: "type", in: "query", schema: { type: "string", enum: ["keyword", "entity"] } },
        ],
        responses: {
          200: { description: "Trending anomalies", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/TrendingAnomaly" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    // ===== NARRATIVES =====
    "/narratives": {
      get: {
        operationId: "listNarratives",
        summary: "List root narratives across projects",
        tags: ["Narratives"],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
          { name: "status", in: "query", schema: { type: "string" }, description: "Filter by narrative status" },
          { name: "arc_phase", in: "query", schema: { type: "string", enum: ["EMERGENCE", "ESCALATION", "PEAK", "RESOLUTION"] } },
        ],
        responses: {
          200: { description: "Paginated narratives", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/NarrativeNode" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/narratives/{id}": {
      get: {
        operationId: "getNarrativeTree",
        summary: "Get full narrative tree with events and stakeholders",
        tags: ["Narratives"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Narrative tree", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/NarrativeTree" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/narratives/{id}/timeline": {
      get: {
        operationId: "getNarrativeTimeline",
        summary: "Get narrative arc timeline data",
        tags: ["Narratives"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Timeline with arc phase", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/NarrativeTimeline" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/narratives/{id}/stakeholders": {
      get: {
        operationId: "getNarrativeStakeholders",
        summary: "List stakeholders across the narrative subtree",
        tags: ["Narratives"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["PERSON", "ORG", "COMPANY", "COUNTRY"] } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["mentions", "sentiment", "name"], default: "mentions" } },
        ],
        responses: {
          200: { description: "Stakeholders list", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Stakeholder" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    // ===== GEO =====
    "/geo/search": {
      get: {
        operationId: "geoSearch",
        summary: "Search signals by geographic location",
        tags: ["Geo"],
        parameters: [
          { name: "location", in: "query", required: true, schema: { type: "string" }, description: "Location name or alias" },
          { name: "radius", in: "query", schema: { type: "string", enum: ["CITY", "STATE", "COUNTRY", "REGION"] }, description: "Resolution level to expand search to" },
        ],
        responses: {
          200: { description: "Geo search results with AI briefing", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/GeoSearchResult" }, meta: { type: "object" } } } } } },
          400: { description: "Missing location parameter", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/geo/hotspots": {
      get: {
        operationId: "getGeoHotspots",
        summary: "Get top signal-dense countries",
        tags: ["Geo"],
        parameters: [
          { $ref: "#/components/parameters/hours" },
          { name: "limit", in: "query", schema: { type: "integer", default: 10, minimum: 1, maximum: 20 } },
        ],
        responses: {
          200: { description: "Geographic hotspots", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/GeoHotspot" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/geo/{countryCode}": {
      get: {
        operationId: "getCountryIntel",
        summary: "Get country-level intelligence summary",
        tags: ["Geo"],
        parameters: [
          { name: "countryCode", in: "path", required: true, schema: { type: "string" }, description: "ISO 3166-1 alpha-2 code (e.g., US, IN)" },
          { $ref: "#/components/parameters/hours" },
        ],
        responses: {
          200: { description: "Country intelligence with AI briefing", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/CountryIntel" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    // ===== ANALYTICS =====
    "/analytics/volume": {
      get: {
        operationId: "getSignalVolume",
        summary: "Get signal volume time-series",
        tags: ["Analytics"],
        parameters: [
          { $ref: "#/components/parameters/hours" },
          { name: "interval", in: "query", schema: { type: "string", enum: ["hour", "day"], default: "hour" } },
        ],
        responses: {
          200: { description: "Volume data", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/VolumeData" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/analytics/categories": {
      get: {
        operationId: "getCategoryDistribution",
        summary: "Get category distribution",
        tags: ["Analytics"],
        parameters: [{ $ref: "#/components/parameters/hours" }],
        responses: {
          200: { description: "Category breakdown", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/CategoryData" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/analytics/sentiment": {
      get: {
        operationId: "getSentimentAnalysis",
        summary: "Get sentiment time-series and overall breakdown",
        tags: ["Analytics"],
        parameters: [
          { $ref: "#/components/parameters/hours" },
          { name: "interval", in: "query", schema: { type: "string", enum: ["hour", "day"], default: "hour" } },
        ],
        responses: {
          200: { description: "Sentiment data", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/SentimentData" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    // ===== WEBHOOKS =====
    "/webhooks": {
      post: {
        operationId: "createWebhook",
        summary: "Register a new webhook",
        description: "Max 5 active webhooks per user. The `secret` is returned ONCE at creation.",
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "events"],
                properties: {
                  url: { type: "string", format: "uri", description: "HTTPS URL to receive webhook payloads" },
                  events: { type: "array", items: { type: "string", enum: ["trend.new", "trend.spike", "anomaly.detected", "narrative.event", "narrative.phase_change"] }, description: "Event types to subscribe to" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Webhook created with secret", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/WebhookCreated" }, meta: { type: "object" } } } } } },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      get: {
        operationId: "listWebhooks",
        summary: "List your webhooks",
        tags: ["Webhooks"],
        responses: {
          200: { description: "List of webhooks", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Webhook" } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/webhooks/{id}": {
      get: {
        operationId: "getWebhookById",
        summary: "Get webhook details with recent deliveries",
        tags: ["Webhooks"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Webhook with last 20 deliveries", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/WebhookDetail" }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
      delete: {
        operationId: "deleteWebhook",
        summary: "Deactivate a webhook",
        tags: ["Webhooks"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Webhook deactivated", content: { "application/json": { schema: { type: "object", properties: { data: { type: "object", properties: { id: { type: "string" }, deactivated: { type: "boolean" } } }, meta: { type: "object" } } } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          500: { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    // ===== STREAM =====
    "/stream": {
      get: {
        operationId: "streamEvents",
        summary: "Real-time event stream (Server-Sent Events)",
        description: "Connect with EventSource. Receives heartbeats every 30s. Events are filtered by your API key scopes.",
        tags: ["Stream"],
        parameters: [
          { name: "events", in: "query", schema: { type: "string" }, description: "Comma-separated event types (e.g., `trend.new,anomaly.detected`). Defaults to all events your key has scope for." },
        ],
        responses: {
          200: { description: "SSE stream", content: { "text/event-stream": { schema: { type: "string" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
  },
} as const;
