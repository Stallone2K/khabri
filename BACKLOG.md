# KHABRI INTELLIGENCE PLATFORM — BACKLOG

> Last updated: 2026-03-05

## Architecture

```
SIGNAL INGESTION → ENRICHMENT (AI) → ANOMALY DETECTION (Algo) → RANKING (AI) → INTELLIGENCE DISPLAY
     │                    │                      │                        │                    │
  RSS/APIs          Gemini extracts        Welford's algo           Gemini scores        Dashboard
  170+ feeds        entities, keywords,    detects spikes,          0-100 per trend,     Trend Table,
  every 15 min      locations, sentiment   z-score thresholds       prioritizes what     World Brief,
                                                                    matters NOW          CII Map
                                                                                             │
                                                                                    TREND TRACKING
                                                                                    (Narrative Tree)
```

---

## COMPLETED

### Phase 0: Foundation & Technical Debt

- [x] **Unified Gemini SDK** — Created shared `src/lib/gemini.ts` client with `generateJSON()` and `generateText()` helpers. All routes use `@google/genai` SDK
- [x] **Shared Auth Helper** — Created `src/lib/api-auth.ts` with `getAuthenticatedUserId()` and `verifyCronSecret()`
- [x] **Removed Duplicate Pipeline** — Deleted `src/app/api/pipeline/refresh/route.ts`
- [x] **Background Job Infrastructure** — Added `vercel.json` with cron config (ingest 15min, enrich 15min offset, rank 30min)
- [x] **Stripped Content Generation** — Deleted: `engine/generate/route.ts`, `engine/summary/route.ts`, `projects/create/route.ts`, `project-editor.tsx`. Stripped prompts.ts to only `TREND_ENGINE_PROMPT` and `UNIFIED_RESEARCH_AGENT_PROMPT`
- [x] **UI Cleanup** — Sidebar: "Content" → "Tracked Trends", `Folder` → `Crosshair` icon. Removed Editor tab from project page. Badge shows status instead of type. Removed auto-generate summary button

### Phase 1: Signal Ingestion & Enrichment

#### 1A. Feed Infrastructure & Ingestion Pipeline

- [x] **FeedCatalog Model** — Added `FeedCatalog` model to schema (name, url, sourceLabel, category, region, language, isActive, lastFetchedAt, lastErrorAt, consecutiveErrors)
- [x] **Signal Model Enhanced** — Added `category` field to `Signal` model
- [x] **RankedTrend Model Enhanced** — Added `category` + `region` fields, `@@index([userId, createdAt])` + `@@index([userId, region, createdAt])` for query performance
- [x] **Feed Seed File** — Created `prisma/seed-feeds.ts` with 173 feeds across 16 categories (Google Trends, Reddit, Google News, Global News, India, Tech, Finance, Geopolitics, Crypto, Science, Sports, Entertainment, US Politics, Middle East, Asia-Pacific, Africa, LatAm)
- [x] **Ingestion Pipeline Rewrite** — `src/app/api/ingest/route.ts`: reads from FeedCatalog, batches of 20, `Promise.allSettled`, bulk dedup via `Set`, `createMany({ skipDuplicates: true })`, feed health tracking, circuit breaker (5+ consecutive errors → auto-skip)
- [x] **TREND_ENGINE_PROMPT Updated** — Intelligence analyst focus, 5 weighted scoring criteria (Pressure x3, Trigger x2.5, Narrative x2, Spread x1.5, Geopolitical Weight x1), Top 30 trends, 13 category assignment
- [x] **Trend History Preserved** — Removed `deleteMany` from ingest; trends now append so past runs remain accessible via pagination

#### 1B. Enrichment Pipeline

- [x] **Schema: Enrichment Models** — Added `SignalEntity`, `SignalKeyword`, `SignalLocation` models. Enhanced `Signal` with `isEnriched`, `enrichedAt`, `sentiment`, `sentimentScore` fields + `@@index([isEnriched, createdAt])`
- [x] **Enrichment Prompt** — Created `SIGNAL_ENRICHER_PROMPT` in `src/lib/prompts.ts` — batch NLP extraction (entities, keywords, locations, sentiment) with numbered ID mapping
- [x] **Signal Enricher Module** — `src/lib/ingestion/signal-enricher.ts`: batch processing (20 signals/batch), Gemini 2.0 Flash, transactional DB writes, per-batch error resilience
- [x] **Enrichment Cron Route** — `POST /api/cron/enrich`: processes up to 100 un-enriched signals per run, matches `vercel.json` schedule (every 15 min offset +5)
- [x] **Enrichment Chained in Ingest** — `enrichSignals(100)` runs automatically after trend ranking in the ingest pipeline. Full pipeline: Ingest → Rank → Enrich in one pass

#### 1C. Dashboard & Visualization

- [x] **Trend Table** — Category column with 13 colored badges (POLITICS, GEOPOLITICS, TECH, FINANCE, CRYPTO, SCIENCE, MILITARY, CLIMATE, HEALTH, SPORTS, ENTERTAINMENT, BUSINESS, SOCIETY), pagination controls (prev/next + page numbers), relative timestamps, total count, column sorting, "Track Trend" action
- [x] **Trends List API** — `GET /api/trends/list` with `page`, `pageSize`, `region` params. Returns `{ trends, pagination }`, ordered by `[createdAt desc, rank asc]`
- [x] **Trend Graph API** — `GET /api/trends/graph` with `hours` (3/6/12/24) and `region` params. Hourly narrative activity chart with hybrid matching (enriched keywords + title fallback), stop-word filtering
- [x] **Trend Chart Component** — `src/components/dashboard/trend-chart.tsx`: interactive Recharts line chart, time range selector (3h/6h/12h/24h), clickable legend to isolate trends, region filtering
- [x] **Trend Ticker API** — `GET /api/trends/ticker` with `region` param. Top 10 trends from latest batch only with momentum calculation (up/down/neutral based on recent vs past score comparison)
- [x] **Trend Ticker Component** — `src/components/dashboard/trend-ticker.tsx`: `react-fast-marquee` scrolling ticker, rank + topic + score + momentum arrows, region filtering
- [x] **Dashboard Stats API** — `GET /api/dashboard/stats`: signals processed (24h), critical trends (score >= 80), active projects, average score ("market temp"), trend velocity (signals/hour)
- [x] **Dashboard Stats Component** — Stats cards at top of dashboard (Signal Radar, Critical Alerts, Active Investigations, Market Temp)
- [x] **Refresh Button** — "Refresh" in trend table header triggers full `/api/ingest` pipeline inline

#### 1D. Geographic Classification (Domestic/International)

- [x] **User Location Schema** — Added `countryCode` (ISO 3166-1 alpha-2) and `countryName` fields to `User` model
- [x] **User Location API** — `GET/POST /api/user/location`: read and save user's detected country
- [x] **Browser Geolocation Hook** — `src/hooks/use-user-country.ts`: auto-detects country via browser Geolocation API + BigDataCloud free reverse geocoding (no API key). Saves to user profile so it only prompts once
- [x] **Parameterized Trend Prompt** — `buildTrendEnginePrompt(countryCode)` generates prompt with geographic classification section. AI tags each trend as DOMESTIC or INTERNATIONAL relative to user's country. 60+ country name mappings
- [x] **Region Filter in All APIs** — `region` query param supported in `/trends/list`, `/trends/graph`, `/trends/ticker`. Filters by DOMESTIC, INTERNATIONAL, or ALL (default)
- [x] **Region Dropdown UI** — Select dropdown in TrendTable header: "All Trends", "Domestic ({countryName})", "International". Filters propagate to table, chart, and ticker simultaneously

---

## TODO

### Phase 2: Intelligence Engine & Anomaly Detection (Partial)

#### 2A. Anomaly Detection System

> **Status: COMPLETE**

- [x] **Schema: Anomaly Models** — Added `AnomalyBaseline` (Welford state: dimension, key, mean, m2, sampleCount, lastValue) and `AnomalyEvent` (type, key, label, zScore, currentValue, baselineMean, baselineStdDev, severity, isResolved, autoResolvesAt, metadata). Global tables (no userId — signals are global)
- [x] **Welford's Algorithm** — `src/lib/algorithms/anomaly-detection.ts`: `welfordUpdate()`, `welfordStdDev()`, `computeAnomaly()` with thresholds (ELEVATED z>=1.5, HIGH z>=2.0, CRITICAL z>=3.0), cold start guard (MIN_SAMPLES=12)
- [x] **3-Dimension Detection** — Keyword frequency spikes, entity mention surges, geographic concentration. All computed via raw SQL aggregations on existing enrichment tables (SignalKeyword, SignalEntity, SignalLocation). Sentiment detection deferred to future phase
- [x] **Anomaly Cron Route** — `POST /api/cron/anomaly`: runs hourly (0 \* \* \* \*), parallel aggregation (3 dimensions) → Welford comparison → AnomalyEvent creation/update → baseline upsert → auto-resolve expired anomalies (ELEVATED: 6h, HIGH: 12h, CRITICAL: 24h)
- [x] **Anomaly API Routes** — `GET /api/intelligence/anomalies` (filterable by type, severity, active), `GET /api/intelligence/trending` (top spiking items with 24h sparkline data)
- [x] **Trending Panel** — `src/components/dashboard/trending-panel.tsx`: grid of top spiking items with severity badge, z-score, signals/hr, SVG sparkline. Shown on dashboard between stats and chart
- [x] **Anomaly Badges on TrendTable** — Flame icon next to trends whose keywords/entities are anomalous (cross-referenced via topic word matching against all active anomalies). Color-coded by severity, rich tooltip shows anomaly type + severity + z-score
- [x] **Ticker Integration** — CRITICAL anomalies prepended to the scrolling ticker with red "SPIKE" badge
- [x] ~~**Intelligence Page**~~ — Removed. Anomaly data shown on main dashboard via TrendingPanel card and trend table badges instead of a separate page
- [x] ~~**Sidebar Link**~~ — Removed. No separate intelligence page needed

#### 2B. Sentiment Anomaly Detection (Deferred)

> **Priority: LOW** — Algorithm and query exist but excluded from cron until more data accumulates

- [ ] **Sentiment Shift Detection** — `computeSentimentSince()` already implemented in `anomaly-detection.ts`. Re-enable in cron when sentiment data is rich enough to produce meaningful anomalies

#### 2C. Remaining Intelligence Features

> **Priority: HIGH** — CII, World Brief, Forecasts, Focal Points

- [ ] **Schema: World Brief & Forecasts** — Add `WorldBrief` model (AI-synthesized summaries, HOURLY/DAILY/WEEKLY), `AIForecast` model (predictions with confidence + outcome tracking)
- [ ] **Schema: CII & Focal Points** — Add `CountryInstabilityScore` (daily per country, 7 component scores + composite + trend), `FocalPoint` (entity convergence detections)
- [ ] **CII Algorithm** — `src/lib/algorithms/instability-index.ts`: 7 weighted components (News Volume, Sentiment, Conflict, Protest, Economic, Governance, External Pressure), composite scoring, trend detection (RISING/STABLE/FALLING)
- [ ] **Regional Convergence** — `src/lib/algorithms/convergence.ts`: group anomalies by region, compute convergence score
- [ ] **Focal Point Detection** — `src/lib/algorithms/focal-point.ts`: entity co-occurrence across signals, AI summary generation
- [ ] **World Brief Cron** — `POST /api/cron/world-brief`: every 6 hours, gather signals → Gemini synthesis → structured markdown
- [ ] **AI Forecast Cron** — `POST /api/cron/forecast`: daily, analyze trends + anomalies + CII → predictions with confidence
- [ ] **Remaining API Routes** — `/cii`, `/cii/[code]`, `/brief`, `/forecasts`, `/focal-points`, `/convergence`
- [ ] **Intelligence Page Expansion** — CII world map, world brief card, forecast panel, focal point graph

### Phase 3: Geo-Location Search & Financial Markets

#### 3A. Location Hierarchy & Geo-Search

> **Status: COMPLETE**

- [x] **Location Hierarchy Schema** — Added `Location` model (self-referencing tree: REGION → COUNTRY → STATE → CITY, with aliases, countryCode, lat/lng). Added `locationId` FK on `SignalLocation` for canonical resolution. `@@unique([name, type, parentId])` prevents duplicates
- [x] **Location Seed Data** — `prisma/seed-locations.ts`: 8 regions, 193 countries (full ISO 3166), 86 states (US 50 + India 36), 160 cities with aliases and coordinates. Total: 447 locations. Idempotent re-runs via upsert
- [x] **Location Resolution** — `src/lib/ingestion/location-resolver.ts`: 3-pass resolution (exact name+type → alias match → country code fallback) via raw SQL. Runs after enrichment in enrich cron. Resolves `SignalLocation.locationId` to canonical `Location` records
- [x] **Geo-Search API** — `GET /api/geo/search?location=Mumbai&radius=city|state|country|region`: resolves query to Location (name + alias match), walks up tree to target radius, gets all descendant IDs via recursive CTE, queries signals through `SignalLocation.locationId`, generates AI geographic briefing via Gemini 2.0 Flash
- [x] **Geo Briefing Prompt** — `buildGeoBriefingPrompt()` in `src/lib/prompts.ts`: synthesizes signal headlines into geographic intelligence briefing (key developments, dominant themes, risk & outlook)

#### 3B. Financial Markets (TODO)

- [ ] **Financial Markets Schema** — Add `MarketDataPoint`, `PredictionMarket`, `MacroRadarSignal` models
- [ ] **External API Integrations** — CoinGecko (crypto), Yahoo Finance (indices), Polymarket (predictions)
- [ ] **Macro Radar Algorithm** — `src/lib/algorithms/macro-radar.ts`: 7 signals (VIX, Yield Spread, DXY, Gold, Oil, BTC, Fear & Greed), weighted composite verdict
- [ ] **Market Cron Routes** — `/api/cron/market-data` (5min), `/api/cron/prediction-markets` (30min)
- [ ] **Geo UI** — `src/app/dashboard/geo/page.tsx`, location search, heatmap, location brief
- [ ] **Markets UI** — `src/app/dashboard/markets/page.tsx`, crypto panel, indices, macro radar spider chart, prediction markets

### Phase 4: Tracked Trends & Narrative Trees

#### 4A. Narrative Tree Core

> **Status: COMPLETE**

- [x] **Schema: Narrative Models** — Added `NarrativeNode` (self-referencing tree: projectId, parentId, title, summary, keywords, status, signalCount, lastSignalAt) and `NarrativeEvent` (nodeId, title, summary, sourceUrl, impactScore, sentiment). Updated `Project` with `narrativeNodes` relation. Project status updated: DRAFT → DISCOVERING → TRACKING → DORMANT
- [x] **Narrative Discovery Engine** — `src/lib/narrative-discovery.ts`: queries recent signals matching topic keywords (last 24h from SignalKeyword), sends to Gemini 2.0 Flash to discover 3-5 distinct narrative angles with tracking keywords. Auto-triggers on tracked trend creation
- [x] **Narrative API Routes** — `POST /api/projects/[id]/discover` (trigger AI discovery), `GET /api/projects/[id]/narratives` (full tree with events), `POST /api/projects/[id]/narratives` (manual add), `PATCH/DELETE /api/projects/[id]/narratives/[nodeId]` (edit/delete nodes). Root node protection (can't delete root)
- [x] **Narrative Tree UI** — `src/components/project/narrative-tree.tsx`: full tree visualization with root card + child narrative cards connected by CSS lines. Each card shows: title, status badge (Active/Dormant/Resolved), summary, signal count, last activity, keywords, expandable events timeline. Supports: inline editing, status changes, manual narrative add form, AI re-discover
- [x] **Project Page Rewrite** — Replaced old Brief/Research tabs with NarrativeTreeView. Deleted `project-brief.tsx`, `project-research.tsx`, `project-header.tsx`
- [x] **Auto-Discover on Creation** — When a TRACKED_TREND project is created (from trend table or sidebar "+"), narrative discovery runs in the background (non-blocking). Project status: DISCOVERING → TRACKING
- [x] **Background Trend Monitor Cron** — `POST /api/cron/trend-monitor` (every 30min at :10/:40): for each active tracked trend, collects keywords from narrative nodes, queries SignalKeyword for new matches, creates NarrativeEvent entries, increments signal count. Deduplicates by source URL

#### 4B. Narrative Intelligence

> **Status: COMPLETE**

- [x] **Schema: NarrativeStakeholder + arcPhase** — Added `NarrativeStakeholder` model (name, type, role, sentiment, mentionCount per node) with `@@unique([nodeId, name, type])`. Added `arcPhase` field to `NarrativeNode` (EMERGENCE | ESCALATION | PEAK | RESOLUTION)
- [x] **AI Significance Analysis** — `src/lib/narrative-analysis.ts`: Gemini 2.0 Flash assesses signal relevance, impact (0-100), sentiment, and generates 1-sentence summary. Filters keyword-coincidence noise. Integrated into trend-monitor cron Phase 2
- [x] **NarrativeStakeholder Extraction** — `src/lib/narrative-stakeholders.ts`: auto-extracts high-salience entities from `SignalEntity` when events are created. Upserts stakeholder records with mention counts. API: `GET /api/projects/[id]/stakeholders`. UI: colored pills in narrative info panel (PERSON=blue, ORG=purple, COMPANY=amber, COUNTRY=emerald)
- [x] **Auto Sub-Narrative Discovery** — `src/lib/narrative-split.ts`: when a node accumulates 5+ events with no children (depth < 2), Gemini identifies 2-3 distinct sub-threads and creates child NarrativeNode records. Integrated into trend-monitor cron Phase 4
- [x] **Narrative Arc Computation** — `src/lib/narrative-arc.ts`: aggregates events by day (event count, avg sentiment, peak impact). AI classifies lifecycle phase (EMERGENCE → ESCALATION → PEAK → RESOLUTION) when 3+ days of data exist. API: `GET /api/projects/[id]/narratives/[nodeId]/arc`. Phase badge shown in tree UI
- [x] **Narrative Timeline UI** — `src/components/project/narrative-timeline.tsx`: recharts ComposedChart with bar (event count) + line (sentiment) per day. Toggled from node dropdown menu. 160px collapsible chart
- [x] **Export System** — `GET /api/projects/[id]/export?format=json|markdown`: full project export with narrative tree, events, stakeholders, arc data. JSON (structured) and Markdown (formatted report). Download button in project header

#### 4C. Remaining Narrative Features

> **Priority: LOW** — Deferred features

- [ ] **Alert System** — `GET /api/alerts`, `PATCH /api/alerts/[id]/read`, `POST /api/alerts/read-all`. Cross-feature notifications with severity levels

### Phase 5: Production Deployment

> **Priority: CRITICAL** — Get Khabri live on Vercel with all crons running, env vars configured, and production DB active.

#### 5A. Pre-Deployment Fixes

- [x] **TypeScript Build Check** — `npx tsc --noEmit` passes, `next build` completes without errors
- [x] **Remove Debug Logs** — Stripped `console.log("[NarrativeTree]...")` debug statements from client components. Server-side logs kept for production monitoring
- [x] **Environment Variables Audit** — 7 required env vars: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GEMINI_API_KEY`, `CRON_SECRET`
- [x] **Google OAuth Redirect URIs** — Add production domain to Google Cloud Console: `https://<domain>/api/auth/callback/google`
- [x] **Prisma Generate in Build** — Already in `package.json` build script: `prisma generate && next build`

#### 5B. Vercel Deployment

- [x] **Install Vercel CLI** — `npm i -g vercel`
- [ ] **Link Project** — `vercel link` to create/connect Vercel project
- [ ] **Set Environment Variables** — Add all env vars to Vercel project settings (Dashboard → Settings → Environment Variables). Set `NEXTAUTH_URL` to production URL
- [ ] **Connect Neon DB** — Verify `DATABASE_URL` points to production Neon instance (already using Neon pooler). Consider separate preview/production DB if needed
- [ ] **Deploy** — `vercel --prod` for first production deployment
- [ ] **Verify Crons** — Confirm `vercel.json` crons are registered (Vercel Dashboard → Crons tab). Crons require Vercel Pro plan or higher
- [ ] **Custom Domain** — Add custom domain via Vercel Dashboard → Domains (optional, can use `.vercel.app` initially)

#### 5C. Production Hardening

- [ ] **Cron Auth** — Verify all cron routes check `CRON_SECRET` header (Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically)
- [ ] **Error Monitoring** — Consider adding Vercel's built-in logging or Sentry for error tracking
- [ ] **DB Connection Pooling** — Already using Neon pooler URL (DONE). Verify connection limits under load
- [ ] **Function Timeouts** — Vercel Hobby: 10s, Pro: 60s. Crons that call Gemini (trend-monitor, ingest) may need Pro plan for 60s timeout
- [ ] **Rate Limit Gemini** — Ensure cron pipelines don't exceed Gemini API free tier limits (15 RPM for Flash). Add delays between batches if needed
- [ ] **Seed Production Data** — Run `npm run seed:feeds` and `npm run seed:locations` against production DB
- [ ] **First Ingest Run** — Manually trigger `POST /api/ingest` once to populate initial signals and trends
- [ ] **Smoke Test** — Login → Dashboard loads trends → Track a trend → Narrative tree populates → Cron creates events

#### 5D. Post-Launch

- [ ] **Monitor Cron Logs** — Watch first 24h of cron runs for failures (Vercel Dashboard → Logs)
- [ ] **Anomaly Baseline Warmup** — First 12h: baselines accumulate, no anomalies flagged (expected)
- [ ] **DNS & SSL** — Vercel auto-provisions SSL. If custom domain, verify DNS propagation
- [ ] **Backup Strategy** — Neon has point-in-time recovery. Verify it's enabled on the Neon dashboard

---

### Phase 6: Public API & Developer Documentation

> **Priority: HIGH** — Expose Khabri's intelligence as a developer-friendly REST API with API key auth, rate limiting, and interactive docs.

#### 6A. API Key Authentication & Rate Limiting

> **Status: COMPLETE**

- [x] **Schema: ApiKey Model** — `ApiKey` model (id, userId, name, key (SHA-256 hashed), prefix (first 8 chars for display), scopes[], rateLimit, requestCount, lastUsedAt, expiresAt, isActive, createdAt/updatedAt). `@@index([key])` + `@@index([userId])` for fast lookup. Also added `ApiUsageLog` (per-request) and `ApiUsageDailyStat` (daily aggregation) models
- [x] **API Key Management** — `POST /api/keys` (create key, return raw key once, max 10 per user), `GET /api/keys` (list user's keys with prefix only), `DELETE /api/keys/[id]` (soft-revoke via isActive=false), `PATCH /api/keys/[id]` (update name/scopes/rate limit)
- [x] **API Key Utilities** — `src/lib/api-keys.ts`: `generateApiKey()` produces `khabri_<32hex>` format keys, `hashApiKey()` SHA-256, `validateScopes()` against 6 valid scopes (trends, signals, anomalies, narratives, geo, analytics)
- [x] **API Auth Middleware** — `src/lib/api-middleware.ts`: `authenticateApiKey()` validates `Authorization: Bearer khabri_...` header, checks active/expired/scope/rate-limit, returns standardized errors (401/403/429). `logUsage()` fire-and-forget per-request logging. `addRateLimitHeaders()` adds X-RateLimit-* headers
- [x] **Dual-Mode Auth** — `authenticateRequest()` in `src/lib/api-auth.ts`: tries API key auth if Bearer header present, otherwise falls back to session auth. No session fallback when API key is explicitly provided but invalid
- [x] **Rate Limiting** — In-memory sliding window via `src/lib/rate-limiter.ts` (Map-based, safe for single-VM PM2). Default 100 req/min, configurable per key (1-10000). `429 Too Many Requests` with `Retry-After` and `X-RateLimit-*` headers. DB sync of requestCount every 10 requests
- [x] **Usage Tracking** — `ApiUsageLog` records every API key request (endpoint, method, statusCode, responseTimeMs). `POST /api/cron/usage-aggregate` (daily 01:00 UTC) aggregates into `ApiUsageDailyStat` and deletes raw logs >30 days
- [x] **Route Retrofit** — 8 read-only routes upgraded to dual auth: `trends/list`, `trends/ticker`, `trends/graph`, `intelligence/anomalies`, `intelligence/trending`, `dashboard/stats`, `geo/search`, `articles`. Mutation routes remain session-only

#### 6B. Public Intelligence API ✅

- [x] **Trends API** — `GET /api/v1/trends` (paginated, filterable by category/region/score/sort), `GET /api/v1/trends/top` (top N trending topics with momentum: change direction + volume), `GET /api/v1/trends/[id]` (single trend with full context including reason)
- [x] **Signals API** — `GET /api/v1/signals` (raw signals with entity/keyword/location enrichment, filterable by category/sentiment/source/since/enriched), `GET /api/v1/signals/search` (multi-dimensional search: full-text q, entity name/type, location/country), `GET /api/v1/signals/[id]` (single signal with full enrichment data)
- [x] **Anomalies API** — `GET /api/v1/anomalies` (active anomaly spikes with severity/type filters + severity summary counts), `GET /api/v1/anomalies/trending` (top spiking items with 24h sparkline data)
- [x] **Narratives API** — `GET /api/v1/narratives` (list root narratives across user's projects with child/event/stakeholder counts), `GET /api/v1/narratives/[id]` (full narrative tree with events/stakeholders/arc, ownership verified), `GET /api/v1/narratives/[id]/timeline` (arc data points via computeNarrativeArc), `GET /api/v1/narratives/[id]/stakeholders` (aggregated across subtree via recursive CTE, sortable/filterable)
- [x] **Geo Intelligence API** — `GET /api/v1/geo/search` (location search with hierarchy walk + AI briefing), `GET /api/v1/geo/hotspots` (top signal-dense countries with category/sentiment via SQL MODE()), `GET /api/v1/geo/[countryCode]` (country intelligence: signals + category/sentiment breakdown + AI briefing)
- [x] **Analytics API** — `GET /api/v1/analytics/volume` (signal volume time-series, hourly/daily interval), `GET /api/v1/analytics/categories` (category distribution with percentages), `GET /api/v1/analytics/sentiment` (sentiment time-series with per-bucket and overall breakdown)
- [x] **Standardized Response Format** — All v1 endpoints return `{ data, meta: { total?, page?, pageSize?, hasMore?, rateLimit: { limit, remaining, reset } } }`. Errors: `{ error: { code, message }, meta? }`. Shared utilities in `src/lib/api-v1.ts`: `authenticateV1()` (API-key only, no session), `v1Success()`, `v1Error()`, `logV1Usage()`, `parsePagination()`

#### 6C. Webhooks & Streaming ✅

- [x] **Webhook Registration** — `POST /api/v1/webhooks` (register URL + events, generates `whsec_` secret), `GET /api/v1/webhooks` (list), `GET /api/v1/webhooks/[id]` (details + last 20 deliveries), `DELETE /api/v1/webhooks/[id]` (soft-revoke). Events: `trend.new`, `trend.spike`, `anomaly.detected`, `narrative.event`, `narrative.phase_change`. Max 5 active webhooks per user. HTTPS-only URLs. New `webhooks` API scope
- [x] **Webhook Delivery** — DB-backed delivery queue with inline fire-and-forget + retry cron (every 5 min). 3 attempts with exponential backoff (1m, 5m, 30m). HMAC-SHA256 signing via `X-Khabri-Signature` header. Delivery logs with status/statusCode/error tracking. 7-day retention with daily cleanup cron. Event emission integrated into ingest (`trend.new`, `trend.spike`), anomaly (`anomaly.detected`), and trend-monitor (`narrative.event`, `narrative.phase_change`) crons
- [x] **SSE Streaming** — `GET /api/v1/stream` (Server-Sent Events). Filter by `?events=trend.new,anomaly.detected`. Validates API key scopes per event type. In-memory EventEmitter singleton for real-time broadcast. 30s heartbeat. User-scoped events (trends, narratives) + global events (anomalies). Auto-cleanup on client disconnect

#### 6D. Interactive API Documentation ✅

- [x] **OpenAPI 3.1 Spec** — `src/lib/api-spec.ts`: Complete OpenAPI 3.1 specification covering all 23 v1 endpoints. Organized by 8 tags (Trends, Signals, Anomalies, Narratives, Geo, Analytics, Webhooks, Stream). Includes ~20 reusable schemas, reusable parameters, auth scheme, and error responses
- [x] **API Docs Page** — `src/app/docs/page.tsx`: Interactive Scalar-powered API reference at `/docs`. Dark mode (Kepler theme), try-it-out, auto-generated code examples (curl/JS/Python/Go), schema visualization, search. Publicly accessible (no auth required). Layout at `src/app/docs/layout.tsx`
- [x] **Developer Portal Page** — `src/app/dashboard/developer/page.tsx`: Three-tab portal (Keys / Usage / Quick Start). **API Key Manager** (`src/components/dashboard/developer/api-key-manager.tsx`): create/list/revoke keys with scope toggles, rate limit config, one-time raw key display with copy button. **Usage Charts** (`src/components/dashboard/developer/usage-charts.tsx`): Recharts line chart for daily requests/errors, stat cards (total/error rate/avg response), top endpoints table. Fetches from new `GET /api/keys/usage?days=30` endpoint
- [x] **SDK Stubs** — **Quick Start Guide** (`src/components/dashboard/developer/quick-start-guide.tsx`): Tabbed code examples (curl/JavaScript/Python) for 4 common operations: listing trends, searching signals, streaming events, registering webhooks. Copy button on each block. Link to full docs
- [x] **Rate Limit & Error Reference** — Embedded in the OpenAPI spec's `info.description` as rich markdown: Authentication section (scopes table, Bearer format), Rate Limiting section (sliding window, headers, 429 behavior), Error Format section (status codes table, JSON structure), Pagination section, SSE section. Rendered by Scalar as the intro page

### Phase 6E: Rate Limiting & Pricing Tiers (Deferred)

> **Priority: MEDIUM** — Re-enable rate limiting when pricing/subscription tiers are introduced.

- [ ] **User Tier Model** — Add `tier` field to User model (`free`, `pro`, `enterprise`) with per-tier rate limits, key caps, and monthly quotas
- [ ] **Tier-Based Rate Limiting** — Re-enable in-memory sliding window rate limiter (`src/lib/rate-limiter.ts` still exists). Enforce per-key limits based on user tier. Pro/Enterprise users get unlimited or higher limits
- [ ] **Rate Limit Headers** — Re-enable `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` response headers in `addRateLimitHeaders()`
- [ ] **Rate Limit in API Responses** — Re-add `rateLimit` field to v1 API `meta` responses
- [ ] **Tier Enforcement on Key Creation** — Clamp `rateLimit` and max active keys based on user tier during `POST /api/keys`
- [ ] **Pricing Integration** — Stripe/payment integration for tier upgrades
- [ ] **Admin Route for Tier Management** — Endpoint to assign/change user tiers

### Phase 7: Polish, Performance & Navigation

> **Priority: LOW** — Final optimization and UX improvements.

- [ ] **Sidebar Restructure** — Overview, Signals, Intelligence (sub-menu), Geo Search, Markets (sub-menu), Tracked Trends, Feeds, Keywords, Alerts, Settings
- [ ] **Enhanced Ticker** — Multi-section: breaking alerts (red), top trends with momentum arrows, market data, CII alerts
- [ ] **Performance** — Replace N+1 queries with aggregations, `unstable_cache` for hot API responses (30-60s TTL)
- [ ] **Data Archival Cron** — `POST /api/cron/cleanup` (daily 03:00 UTC): archive signals >90 days, prune time series, resolve stale anomalies
- [ ] **Category Customization** — User settings to filter categories by interest (e.g., finance person hides sports/entertainment)

---

## KNOWN ISSUES / NOTES

- **Prisma uses `db push`** (not migrations) — no migration history, use `npx prisma db push` for schema changes
- **Some RSS feeds fail** — Circuit breaker skips feeds with 5+ consecutive errors. Failed feeds logged but don't crash pipeline
- **AI category assignment** — Gemini assigns categories per trend. Categories are not yet user-filterable (planned for Phase 7)
- **Trend dedup is URL-based** — No semantic dedup yet (planned: SHA-256 content hash + semantic similarity >0.85 threshold)
- **Google Trends feeds have custom fields** — `ht:approx_traffic` and `ht:news_item` parsed via rss-parser custom fields
- **Region classification requires pipeline re-run** — Existing trends have `region: null`. Only trends generated after geolocation setup will have DOMESTIC/INTERNATIONAL tags
- **Anomaly detection cold start** — Needs 12+ hourly observations before flagging spikes. First ~12 hours after deployment, baselines accumulate silently (no anomalies created). This prevents false positives

---

## CRON SCHEDULE (Target)

| Route                               | Frequency                        | Purpose                                                                                      | Phase | Status                       |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- | ----- | ---------------------------- |
| `POST /api/ingest`                  | Manual + cron `/api/cron/ingest` | Fetch 170+ RSS feeds → rank → enrich                                                         | 1     | LIVE                         |
| `POST /api/cron/enrich`             | Every 15 min (offset +5)         | Entity/keyword/location extraction + location resolution                                     | 1+3   | LIVE                         |
| `POST /api/cron/rank`               | Every 30 min                     | Rank signals into trends                                                                     | 1     | BUNDLED (runs inside ingest) |
| `POST /api/cron/anomaly`            | Every hour (`0 * * * *`)         | Welford anomaly detection (4 dimensions)                                                     | 2     | LIVE                         |
| `POST /api/cron/cii`                | Daily 00:00 UTC                  | Country instability index                                                                    | 2     | TODO                         |
| `POST /api/cron/world-brief`        | Every 6 hours                    | AI world brief                                                                               | 2     | TODO                         |
| `POST /api/cron/forecast`           | Daily 06:00 UTC                  | AI forecasts                                                                                 | 2     | TODO                         |
| `POST /api/cron/focal-points`       | Every 2 hours                    | Entity convergence                                                                           | 2     | TODO                         |
| `POST /api/cron/market-data`        | Every 5 min                      | Financial market data                                                                        | 3     | TODO                         |
| `POST /api/cron/prediction-markets` | Every 30 min                     | Polymarket data                                                                              | 3     | TODO                         |
| `POST /api/cron/trend-monitor`      | Every 30 min (`:10/:40`)         | 5-phase pipeline: signal match → AI significance → stakeholders → sub-narratives → arc phase | 4     | LIVE                         |
| `POST /api/cron/usage-aggregate`    | Daily 01:00 UTC                  | Aggregate API usage logs → daily stats, delete raw logs >30 days                             | 6     | LIVE                         |
| `POST /api/cron/cleanup`            | Daily 03:00 UTC                  | Archive old data                                                                             | 7     | TODO                         |

---

## LIVE API ROUTES

| Method                | Route                                        | Purpose                                                   | Phase |
| --------------------- | -------------------------------------------- | --------------------------------------------------------- | ----- |
| POST                  | `/api/ingest`                                | Full pipeline: fetch feeds → rank trends → enrich signals | 1     |
| POST                  | `/api/cron/enrich`                           | Batch enrichment of un-enriched signals                   | 1     |
| GET                   | `/api/trends/list`                           | Paginated trend list with region filter                   | 1     |
| GET                   | `/api/trends/graph`                          | Hourly trend activity chart data with region filter       | 1     |
| GET                   | `/api/trends/ticker`                         | Top 10 trends with momentum from latest batch             | 1     |
| GET                   | `/api/dashboard/stats`                       | Dashboard metrics (signals, critical, velocity)           | 1     |
| GET/POST              | `/api/user/location`                         | Read/save user country (geolocation)                      | 1     |
| POST                  | `/api/engine/research`                       | Deep research with Google Search grounding                | 1     |
| POST                  | `/api/cron/anomaly`                          | Hourly anomaly detection (4 dimensions, Welford's)        | 2     |
| GET                   | `/api/intelligence/anomalies`                | Active anomalies (filterable by type, severity)           | 2     |
| GET                   | `/api/intelligence/trending`                 | Top spiking items with 24h sparkline data                 | 2     |
| GET                   | `/api/geo/search`                            | Location search with hierarchy + AI briefing              | 3     |
| POST                  | `/api/cron/trend-monitor`                    | AI-enriched trend monitor (5-phase pipeline)              | 4     |
| GET                   | `/api/projects/[id]/stakeholders`            | Project stakeholders (all nodes)                          | 4     |
| GET                   | `/api/projects/[id]/narratives/[nodeId]/arc` | Narrative arc data (daily aggregates + phase)             | 4     |
| GET                   | `/api/projects/[id]/export`                  | Export project (JSON or Markdown)                         | 4     |
| GET                   | `/api/projects`                              | List tracked trends / projects                            | 0     |
| POST                  | `/api/projects`                              | Create project                                            | 0     |
| GET/PATCH/DELETE      | `/api/projects/[id]`                         | CRUD for single project                                   | 0     |
| POST                  | `/api/projects/[id]/duplicate`               | Clone a project                                           | 0     |
| GET                   | `/api/articles`                              | List articles from user sources                           | 0     |
| GET/POST/DELETE/PATCH | `/api/sources`                               | Manage RSS sources                                        | 0     |
| GET                   | `/api/sources/stats`                         | Source statistics with metadata extraction                | 0     |
| POST                  | `/api/keys`                                  | Create API key (returns raw key once)                     | 6     |
| GET                   | `/api/keys`                                  | List user's API keys (prefix only)                        | 6     |
| DELETE                | `/api/keys/[id]`                             | Revoke API key                                            | 6     |
| PATCH                 | `/api/keys/[id]`                             | Update API key name/scopes/rate limit                     | 6     |
| POST                  | `/api/cron/usage-aggregate`                  | Daily API usage aggregation + log cleanup                 | 6     |
| GET                   | `/api/v1/trends`                             | Paginated trends (category/region/score/sort filters)     | 6     |
| GET                   | `/api/v1/trends/top`                         | Top N trending topics with momentum                       | 6     |
| GET                   | `/api/v1/trends/[id]`                        | Single trend with full context                            | 6     |
| GET                   | `/api/v1/signals`                            | Signals with enrichment (entity/keyword/location)         | 6     |
| GET                   | `/api/v1/signals/search`                     | Multi-dimensional signal search                           | 6     |
| GET                   | `/api/v1/signals/[id]`                       | Single signal with enrichment data                        | 6     |
| GET                   | `/api/v1/anomalies`                          | Active anomalies with severity summary                    | 6     |
| GET                   | `/api/v1/anomalies/trending`                 | Top anomalies with 24h sparklines                         | 6     |
| GET                   | `/api/v1/narratives`                         | List root narratives across projects                      | 6     |
| GET                   | `/api/v1/narratives/[id]`                    | Full narrative tree with events/stakeholders              | 6     |
| GET                   | `/api/v1/narratives/[id]/timeline`           | Narrative arc data for visualization                      | 6     |
| GET                   | `/api/v1/narratives/[id]/stakeholders`       | Narrative stakeholders (subtree aggregated)               | 6     |
| GET                   | `/api/v1/geo/search`                         | Location search with AI briefing                          | 6     |
| GET                   | `/api/v1/geo/hotspots`                       | Top signal-dense regions                                  | 6     |
| GET                   | `/api/v1/geo/[countryCode]`                  | Country-level intelligence summary                        | 6     |
| GET                   | `/api/v1/analytics/volume`                   | Signal volume time-series                                 | 6     |
| GET                   | `/api/v1/analytics/categories`               | Category distribution                                    | 6     |
| GET                   | `/api/v1/analytics/sentiment`                | Sentiment time-series + overall breakdown                 | 6     |
| POST                  | `/api/v1/webhooks`                           | Register webhook (URL + events, returns secret once)      | 6     |
| GET                   | `/api/v1/webhooks`                           | List user's webhooks                                      | 6     |
| GET                   | `/api/v1/webhooks/[id]`                      | Webhook details + last 20 deliveries                      | 6     |
| DELETE                | `/api/v1/webhooks/[id]`                      | Soft-revoke webhook                                       | 6     |
| GET                   | `/api/v1/stream`                             | SSE streaming (real-time events via EventSource)          | 6     |
| POST                  | `/api/cron/webhook-deliver`                  | Retry pending webhook deliveries (every 5 min)            | 6     |
| POST                  | `/api/cron/webhook-cleanup`                  | Prune old deliveries + events (daily, 7-day retention)    | 6     |
| GET                   | `/api/keys/usage`                            | API usage analytics (daily stats, top endpoints)          | 6     |
