# UAT — Post-Deployment Changes

## #1: Dashboard Overview Cards Should Be User-Scoped (Not Global)

**Current Behavior:** The "Scanned" and "Velocity" cards in the Overview section show **global** signal counts (no `userId` filter), while "Critical Trends", "Market Temp", and "Engine Status" are user-scoped. This means a brand-new user sees `2848 Total Inputs (24H)` and `119 Signals/Hour` even though they've never run a scan.

**Expected Behavior:** All 5 overview cards must reflect only the **authenticated user's own data**. A new user who hasn't scanned should see `0` across the board.

**Files to Change:**

- `src/app/api/dashboard/stats/route.ts` — Add `userId` filter to the `signal.count` query (used by Scanned & Velocity cards)

---

## #2: Remove "Scan Feeds" Button From Empty Trends State

**Current Behavior:** When a new user has no trends, the Trends table shows an empty state with a "Scan Feeds" button (`<Play /> Scan Feeds`). This is confusing — it exposes internal pipeline terminology.

**Expected Behavior:** Replace the empty state with a simple centered message: **"Scan To Find New Trends"** — no button, no icon. Just informational text.

**Files to Change:**

- `src/components/dashboard/trend-table.tsx` — Update the `trends.length === 0` empty state block (~line 285-291)

---

## #3: Fix CRON Jobs for GCP (Not Vercel)

**Current Behavior:** Cron schedules are defined in `vercel.json`, which only works on Vercel. Since the app is deployed on **Google Cloud**, none of the cron jobs execute.

**Expected Behavior:** All cron jobs run on GCP every **3 hours** using **Google Cloud Scheduler** hitting the cron API routes with the `CRON_SECRET` bearer token.

**Cron Routes to Schedule (every 3 hours):**
| Route | Purpose |
|-------|---------|
| `/api/cron/ingest` | Fetch feeds, parse, rank with AI |
| `/api/cron/enrich` | Extract entities/keywords/locations |
| `/api/cron/anomaly` | Detect keyword/entity spikes |
| `/api/cron/trend-monitor` | Match signals to tracked narratives |
| `/api/cron/usage-aggregate` | Aggregate API usage stats |
| `/api/cron/webhook-deliver` | Retry pending webhook deliveries |
| `/api/cron/webhook-cleanup` | Clean up old delivery records |

**Implementation Options:**

1. **Google Cloud Scheduler + Cloud Run** — Create Cloud Scheduler jobs that POST to each cron route with the `Authorization: Bearer ${CRON_SECRET}` header every 3 hours
2. **In-app cron** — Use `node-cron` or similar library within the application process to trigger the routes internally (simpler but tied to app uptime)

**Files to Change:**

- `vercel.json` — Can be removed or kept for reference only
- New: GCP deployment config / Cloud Scheduler setup script (Terraform, gcloud CLI script, or documented manual steps)

---

## #4: API Must Work Independently of CRON / Engine Status

**Current Behavior:** The API scan functionality (via API keys with `khabri_` prefix) relies on the same pipeline that cron triggers. If the cron hasn't run (Engine Status = "Idle") or the user hasn't used the app in days, the API still works technically — but:

- The cron ingest uses a **"system user"** (first user in DB), so cron-generated trends don't belong to the API key's owner
- If no cron has run, there are no fresh signals for the API user to query

**Expected Behavior:** API-authenticated requests (`Bearer khabri_...`) should be fully self-sufficient:

- `POST /api/ingest` (or a dedicated API endpoint) must work for API key users regardless of cron status or last app usage
- Trends generated via API should belong to the **API key's owner**, not a system user
- The API should be able to trigger a full scan pipeline (fetch → ingest → rank → enrich) on demand

**Files to Change:**

- `src/app/api/ingest/route.ts` — Ensure API key auth works and trends are scoped to the key owner's userId
- `src/app/api/cron/ingest/route.ts` — Fix "system user" fallback to scope per-user or make cron generate for all active users
- `src/lib/api-auth.ts` — Verify API key auth grants access to ingest endpoints

---

## #5: Real-Time Ingestion (Eliminate Wait Time)

**Current Behavior:** Clicking scan triggers a synchronous pipeline that fetches 170+ RSS feeds, deduplicates, sends to Gemini AI for ranking, enriches, and returns — taking **30-60 seconds**. User stares at a loading toast the entire time.

**Expected Behavior:** Scanning should feel instant. User clicks "Discover" → trends start appearing within seconds, streaming in as they're processed.

**Proposed Architecture:**

### Option A: Server-Sent Events (SSE) + Background Processing

- User triggers scan → API returns immediately with a scan ID
- Backend processes feeds in background, pushes results via SSE as each batch completes
- Frontend subscribes to SSE stream and incrementally renders trends as they arrive
- No external infrastructure needed (works with Node.js streams)

### Option B: Redis + Pub/Sub

- Add Redis (e.g., Upstash Redis for serverless, or GCP Memorystore)
- User triggers scan → Job queued in Redis
- Worker processes feeds in batches, publishes results to Redis channel
- Frontend polls or uses SSE/WebSocket to receive updates
- Benefit: Decouples ingestion from request lifecycle, supports retries

### Option C: WebSocket (Socket.io / native WS)

- Persistent connection between client and server
- Real-time bidirectional updates as trends are processed
- Most responsive but requires WebSocket infrastructure on GCP

**Recommended: Option A (SSE)** — Simplest to implement, no new infrastructure, works well with Next.js API routes and GCP Cloud Run. Can upgrade to Redis later if scale demands it.

**Implementation Plan:**

1. Split the ingest pipeline into stages: fetch → parse → deduplicate → rank (batched) → enrich
2. Create an SSE endpoint (`GET /api/ingest/stream?scanId=xxx`) that streams results
3. Process feeds in small batches (10-20 feeds), rank immediately, push to stream
4. Frontend subscribes to stream on scan start, appends trends to table as they arrive
5. Show a progress indicator instead of a blocking toast

**Files to Change:**

- `src/app/api/ingest/route.ts` — Refactor to async background processing + SSE stream
- `src/components/dashboard/trend-table.tsx` — Subscribe to SSE, render trends incrementally
- `src/lib/ingestion/` — Break pipeline into streamable stages

---

## Priority Order

| #   | Change                      | Effort | Impact                                       |
| --- | --------------------------- | ------ | -------------------------------------------- |
| 1   | User-scoped dashboard stats | Low    | High — fixes misleading data for new users   |
| 2   | Remove "Scan Feeds" button  | Low    | Medium — better UX for empty state           |
| 3   | GCP CRON setup              | Medium | High — cron is completely broken on GCP      |
| 4   | API independence from CRON  | Medium | High — API users blocked without cron        |
| 5   | Real-time ingestion (SSE)   | High   | High — transforms UX from "wait" to "stream" |
