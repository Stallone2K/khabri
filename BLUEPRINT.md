# KHABRI INTELLIGENCE PLATFORM - BLUEPRINT

## Context

Khabri is a **pure intelligence platform** (Bloomberg Terminal / WorldMonitor.app style). The app has been pivoted away from content generation — all blog/twitter/video prompts, the generate engine, summary engine, and editor UI have been stripped. The architecture is:

```
SIGNAL INGESTION → ENRICHMENT (AI) → ANOMALY DETECTION (Algo) → RANKING (AI) → INTELLIGENCE DISPLAY
                                                                                         ↓
                                                                          TREND TRACKING (Narrative Tree)
```

The Project system is being repurposed as **Tracked Trends** — when a trend is clicked, it becomes a tracked trend with a tree-structured narrative system. Each trend can branch into multiple AI-discovered narratives/angles, each with their own timeline of events. Sub-narratives can branch further, creating a tree-like tracking structure.

This blueprint covers: News & Intelligence, Geopolitical Monitoring, Scoring & Anomaly Detection, Financial Markets, Global Geo-Location Search, and Tracked Trend Narrative Trees.

---

## Phase 0: Foundation & Technical Debt (Week 1-2)

### 0.1 Unify Gemini SDK ✅
- Created shared `src/lib/gemini.ts` client with `generateJSON()` and `generateText()` helpers
- All routes now use the `@google/genai` SDK via the shared client

### 0.2 Shared Auth Helper ✅
- Created `src/lib/api-auth.ts` with `getAuthenticatedUserId()` and `verifyCronSecret()`

### 0.3 Remove Duplicate Pipeline ✅
- Deleted `src/app/api/pipeline/refresh/route.ts`

### 0.4 Background Job Infrastructure ✅
- Added `vercel.json` with cron configuration for ingest (15min), enrich (15min offset), rank (30min)
- All cron routes verify `CRON_SECRET` via Authorization header

### 0.5 Strip Content Generation ✅
- Deleted: `engine/generate/route.ts`, `engine/summary/route.ts`, `projects/create/route.ts`, `project-editor.tsx`
- Stripped `prompts.ts` to only keep `TREND_ENGINE_PROMPT` and `UNIFIED_RESEARCH_AGENT_PROMPT`
- Removed Editor tab from project page, auto-generate summary button from project-brief
- Renamed sidebar "Content" → "Tracked Trends", replaced content-type icons with generic trend icon
- Project header badge now shows status instead of content type

---

## Phase 1: Enhanced Ingestion Engine (Week 2-4)

### 1.1 Database Schema Additions
Add to [schema.prisma](prisma/schema.prisma):

| Model | Purpose |
|-------|---------|
| `SignalEntity` | Extracted entities (PERSON, ORG, COUNTRY, COMPANY) with salience scores |
| `SignalKeyword` | Extracted keywords with weights |
| `SignalLocation` | Geo-tagged locations per signal |
| `Location` | Master location table with hierarchy (City -> State -> Country -> Region) |
| `FeedCatalog` | Pre-populated registry of 170+ verified RSS feeds |
| `KeywordMonitor` | User-defined keyword alerts with color-coding |

Enhance existing `Source` model with: `language`, `region`, `reliability`, `lastFetchedAt`, `lastErrorAt`, `errorCount`, `fetchInterval`
Enhance existing `Signal` model with: `contentHash`, `category`, `language`, `sentiment`, `sourceReliability`, `isBreaking`

### 1.2 Modular Ingestion Architecture
Refactor the monolithic [ingest/route.ts](src/app/api/ingest/route.ts) (currently 7 hardcoded feeds, sequential processing) into:

```
src/lib/ingestion/
  feed-fetcher.ts        -- RSS parsing with circuit breaker (5 consecutive failures = disable, exponential backoff)
  signal-enricher.ts     -- Batch entity/keyword/location extraction via Gemini (20 signals per batch)
  deduplicator.ts        -- URL normalization + SHA-256 content hash + semantic similarity (>0.85 threshold)
  keyword-matcher.ts     -- Match signals against user keyword monitors
  feed-health.ts         -- Feed freshness tracking and health indicators
```

Key improvements:
- Concurrent fetch in batches of 10 with 500ms delay between batches
- Circuit breaker per feed (disable after 5 consecutive failures, exponential backoff for retry)
- Semantic deduplication via content hashing (SHA-256 of cleaned, sorted, stop-word-removed title)
- Gemini batch enrichment: extract entities, keywords, locations, category, sentiment, breaking flag for 20 signals at once

### 1.3 New API Routes
- `POST /api/cron/ingest` -- Scheduled batch ingestion (every 15 min)
- `POST /api/cron/enrich` -- Batch enrichment of un-enriched signals (every 15 min, offset 5)
- `POST /api/cron/rank` -- Rank signals into trends (every 30 min)
- `GET /api/feeds/health` -- Feed health dashboard data
- `POST /api/feeds/discover` -- AI-powered feed discovery for topic/region
- `GET /api/signals` -- Enhanced signal listing with category/location/time filters
- `POST /api/keywords` -- CRUD for keyword monitors
- `GET /api/keywords/matches` -- Signals matching user monitors

### 1.4 New UI Components
- `breaking-banner.tsx` -- Priority breaking news banner at dashboard top
- `keyword-monitor-panel.tsx` -- Keyword monitor management + live matches
- `feed-health-panel.tsx` -- Feed health indicators
- `signal-feed.tsx` -- Real-time signal feed with category filters
- `src/app/dashboard/signals/page.tsx` -- Signal browser
- `src/app/dashboard/keywords/page.tsx` -- Keyword monitor management

### 1.5 Feed Catalog Seeding
Create `prisma/seed-feeds.ts` with 170+ feeds:
- Global News (Reuters, AP, BBC, Al Jazeera) ~15
- India News (NDTV, Hindu, TOI, Economic Times, LiveMint) ~20
- US Politics (NYT, WaPo, Politico, The Hill, Axios) ~15
- Technology (TechCrunch, Ars Technica, The Verge, HN) ~15
- Finance (Bloomberg, CNBC, FT, MarketWatch) ~15
- Geopolitics (Foreign Affairs, War on the Rocks, IISS) ~10
- Crypto (CoinDesk, The Block, Decrypt) ~8
- Reddit subs (r/worldnews, r/india, r/technology, etc.) ~20
- Regional India (state-specific feeds) ~15
- Regional Global (key country feeds) ~20
- Sports, Science, Entertainment ~20

---

## Phase 2: Intelligence Engine & Anomaly Detection (Week 4-7)

### 2.1 Database Schema Additions

| Model | Purpose |
|-------|---------|
| `KeywordTimeSeries` | Hourly keyword counts with Welford's algorithm state (mean, m2, sampleCount) |
| `AnomalyEvent` | Detected anomalies with z-score, severity (ELEVATED/HIGH/CRITICAL), resolution status |
| `CountryInstabilityScore` | Daily CII per location with 7 component scores + composite + trend |
| `WorldBrief` | AI-synthesized intelligence summaries (HOURLY/DAILY/WEEKLY, global or regional) |
| `AIForecast` | AI predictions with confidence, timeframe, reasoning, outcome tracking |
| `FocalPoint` | Entity convergence detections (multiple entities appearing together across signals) |

### 2.2 Core Algorithms

**A. Spike Detection (Welford's Online Algorithm)**
Location: `src/lib/algorithms/anomaly-detection.ts`
- Maintains streaming mean and variance per keyword using Welford's algorithm
- 90-day rolling window without storing all data points
- Z-score thresholds: ELEVATED (1.5), HIGH (2.0), CRITICAL (3.0)
- Runs hourly via `/api/cron/anomaly`
- Flow: Count keyword occurrences in last hour -> Load Welford state -> Compute z-score -> Create AnomalyEvent if significant -> Update Welford state

**B. Country Instability Index (CII)**
Location: `src/lib/algorithms/instability-index.ts`
- 7 weighted component scores (0-100 each):
  - News Volume (0.15) -- Signal count spike vs 30-day baseline
  - Sentiment (0.20) -- Negative sentiment ratio
  - Conflict (0.20) -- Conflict-keyword signal ratio
  - Protest (0.15) -- Protest/unrest signal ratio
  - Economic (0.15) -- Economic instability signal ratio
  - Governance (0.10) -- Governance failure signal ratio
  - External Pressure (0.05) -- Sanctions, diplomatic tension signals
- Composite: Weighted sum, capped at 100
- Levels: STABLE (0-20), WATCH (21-40), ELEVATED (41-60), HIGH (61-80), CRITICAL (81-100)
- Trend detection: Compare last 3 days -> RISING/STABLE/FALLING
- Runs daily via `/api/cron/cii`

**C. Regional Convergence Scoring**
Location: `src/lib/algorithms/convergence.ts`
- Groups active anomalies by geographic region
- Score = (anomaly_count * 15) + (country_count * 10) + (sum_z_scores * 5), capped at 100
- Detects when multiple anomalous keywords cluster in the same region

**D. Focal Point Detection**
Location: `src/lib/algorithms/focal-point.ts`
- Counts entity co-occurrences across signals within a time window
- When 3+ entities converge across 5+ signals -> creates FocalPoint
- AI generates summary of the convergence

### 2.3 World Brief Generation
- Runs every 6 hours via `/api/cron/world-brief`
- Gathers all signals from the last 6 hours, grouped by category
- Gemini generates structured markdown: Critical Developments, Top Stories, Regional Highlights, Emerging Patterns, AI Assessment
- Stored in `WorldBrief` model, accessible via `/api/intelligence/brief`

### 2.4 AI Forecasting
- Runs daily via `/api/cron/forecast`
- Analyzes top trending topics + anomalies + CII data
- Generates predictions with confidence scores and timeframes (24h, 7d, 30d)
- Tracks outcomes (CORRECT/WRONG/PENDING) for calibration
- Prompts stored in `src/lib/prompts/intelligence-prompts.ts`

### 2.5 New API Routes
- `POST /api/cron/anomaly` -- Hourly anomaly detection
- `POST /api/cron/cii` -- Daily CII computation
- `POST /api/cron/world-brief` -- 6-hourly world brief
- `POST /api/cron/forecast` -- Daily AI forecast
- `POST /api/cron/focal-points` -- 2-hourly focal point detection
- `GET /api/intelligence/anomalies` -- Active anomaly events
- `GET /api/intelligence/trending` -- Trending keywords with spike data
- `GET /api/intelligence/cii` -- All country instability scores
- `GET /api/intelligence/cii/[code]` -- Single country CII detail + history
- `GET /api/intelligence/brief` -- Latest world brief
- `GET /api/intelligence/forecasts` -- AI forecasts
- `GET /api/intelligence/focal-points` -- Detected focal points
- `GET /api/intelligence/convergence` -- Regional convergence data

### 2.6 New UI Pages & Components
- `src/app/dashboard/intelligence/page.tsx` -- Main intelligence dashboard
- `src/app/dashboard/intelligence/country/[code]/page.tsx` -- Country dossier page with CII history, signals, stakeholders
- `src/app/dashboard/intelligence/brief/page.tsx` -- World brief viewer
- Components: `anomaly-panel.tsx`, `trending-keywords.tsx`, `cii-world-map.tsx` (react-simple-maps), `cii-table.tsx`, `world-brief-card.tsx`, `forecast-panel.tsx`, `focal-point-graph.tsx`, `convergence-radar.tsx`

---

## Phase 3: Geo-Location Search & Financial Intelligence (Week 7-10)

### 3.1 Geo-Location Architecture

**Location Hierarchy Seeding** (`prisma/seed-locations.ts`):
- All 195 countries with ISO codes and lat/lng
- All Indian states, US states, Chinese provinces, EU countries as sub-regions
- Major cities worldwide (population > 500k)
- Geographic macro-regions (South Asia, Middle East, East Africa, etc.)

**Location Extraction Pipeline** (extends Phase 1 enrichment):
- Match extracted location names to Location table via fuzzy matching
- Hierarchical propagation: "Mumbai" auto-tags Maharashtra + India
- Source-based default: feeds tagged `region: "IN"` default to India

**Geo-Search API** (`GET /api/geo/search?location=Mumbai&radius=city|state|country`):
1. Resolve location name to Location record
2. Get all child location IDs based on radius
3. Fetch signals tagged with those locations
4. Generate instant "What's happening in [Location]" AI briefing
5. Return signals + briefing + CII (if country-level)

### 3.2 Financial Markets Schema

| Model | Purpose |
|-------|---------|
| `MarketDataPoint` | Price data for indices, crypto, commodities, forex with 24h change |
| `PredictionMarket` | Polymarket questions with probabilities and volume |
| `MacroRadarSignal` | 7 macro indicators with BULLISH/BEARISH/NEUTRAL signals |

### 3.3 External API Integrations

| API | Purpose | Rate Limit |
|-----|---------|------------|
| CoinGecko | Crypto prices (BTC, ETH, SOL, XRP) | 30/min free |
| Yahoo Finance | Stock indices (NIFTY50, S&P500, FTSE, etc.) | Unofficial |
| Polymarket CLOB | Prediction markets | Public |
| ACLED | Conflict event data | Requires key |
| GDELT | Global events database | Public |
| US State Dept | Travel advisories | Public RSS |

### 3.4 Macro Radar Algorithm
Location: `src/lib/algorithms/macro-radar.ts`
- 7 signals: VIX, Yield Spread, DXY, Gold Change, Oil Change, BTC Momentum, Fear & Greed
- Each signal classified as BULLISH/NEUTRAL/BEARISH based on thresholds
- Weighted composite produces verdict: STRONG_BUY / BUY / NEUTRAL / CASH / STRONG_CASH
- Visualized as spider chart

### 3.5 New API Routes
- `GET /api/geo/search` -- Location-based trend search
- `GET /api/geo/heatmap` -- Location heat map data
- `GET /api/geo/brief/[location]` -- Instant location briefing
- `GET /api/markets/overview` -- All market data summary
- `GET /api/markets/crypto` -- Crypto prices
- `GET /api/markets/indices` -- Stock indices
- `GET /api/markets/commodities` -- Commodity prices
- `GET /api/markets/predictions` -- Polymarket data
- `GET /api/markets/macro-radar` -- 7-signal radar + verdict
- `POST /api/cron/market-data` -- Fetch market data (every 5 min)
- `POST /api/cron/prediction-markets` -- Fetch prediction data (every 30 min)

### 3.6 New UI Pages & Components
- `src/app/dashboard/geo/page.tsx` -- Geo search with autocomplete + heat map
- `src/app/dashboard/geo/[location]/page.tsx` -- Location detail with signals + brief
- `src/app/dashboard/markets/page.tsx` -- Financial markets dashboard
- Components: `location-search.tsx`, `location-heatmap.tsx`, `location-brief.tsx`, `location-signal-feed.tsx`, `market-ticker.tsx`, `crypto-panel.tsx`, `indices-panel.tsx`, `macro-radar.tsx` (spider chart), `prediction-markets.tsx`, `fear-greed-gauge.tsx`

---

## Phase 4: Tracked Trends & Narrative Trees (Week 10-14)

### 4.1 Database Schema

| Model | Purpose |
|-------|---------|
| `TrackedTrend` (replaces Project) | Root trend with keywords, entities, locations to monitor + status + current brief |
| `NarrativeNode` | Tree node: each represents a narrative angle/sub-narrative. Has parentId for tree structure, AI-discovered title, summary, and tracking keywords |
| `NarrativeEvent` | Timeline entries per narrative node with impact score (0-100), sentiment, key event flag |
| `NarrativeStakeholder` | Tracked stakeholders with role (Protagonist/Antagonist/Regulator), sentiment, mention count |
| `Alert` | Cross-feature notification system (ANOMALY, TREND, KEYWORD, CII, BREAKING) with severity levels |

The **Narrative Tree** is the core differentiator:
- Root: The original trend (e.g., "India-Pakistan Tensions")
- Children: AI-discovered narrative angles (e.g., "Military Buildup", "Diplomatic Channels", "Economic Impact")
- Grandchildren: Sub-narratives that branch further (e.g., under "Economic Impact" → "Stock Market Reaction", "Trade Disruption")
- Each node has its own timeline of events and can be independently tracked

### 4.2 Narrative Discovery Engine
- When a trend is first tracked, AI research discovers 3-5 narrative angles
- Each angle becomes a `NarrativeNode` child of the root trend
- AI generates tracking keywords per narrative for background monitoring
- Users can manually add/remove narrative branches

### 4.3 Background Trend Monitor
- Runs every 30 minutes via `/api/cron/trend-monitor`
- For each active tracked trend and its narrative nodes:
  1. Query new signals matching tracking keywords/entities/locations since last check
  2. AI analyzes new signals for significance relative to each narrative
  3. Creates `NarrativeEvent` entries for significant developments
  4. If impact score > 70 -> creates `Alert` (HIGH/CRITICAL)
  5. Every 6 hours -> regenerates the trend brief + checks for new emerging narratives
- Stakeholder updates: tracks mention frequency and sentiment shifts per stakeholder

### 4.4 Narrative Arc Computation
- Aggregates NarrativeEvents by day to compute narrative arc data per node
- Timeline metrics: daily sentiment average, event count, impact peak
- AI detects narrative phases: Emergence, Escalation, Peak, Resolution
- Visualized as dual-axis chart (sentiment line + impact bars)

### 4.5 Export System
- `GET /api/trends/[id]/export?format=pdf|json|markdown`
- Markdown: Full trend with narrative tree, timelines, stakeholders
- JSON: Full structured data for programmatic use
- PDF: Server-rendered via `@react-pdf/renderer`

### 4.6 New API Routes
- `POST /api/trends/track` -- Create tracked trend from a signal/trend
- `GET /api/trends/tracked` -- List user tracked trends
- `GET /api/trends/tracked/[id]` -- Full trend with narrative tree
- `PATCH /api/trends/tracked/[id]` -- Update tracking config
- `DELETE /api/trends/tracked/[id]` -- Delete tracked trend
- `GET /api/trends/tracked/[id]/narratives` -- Full narrative tree
- `POST /api/trends/tracked/[id]/narratives` -- Add narrative branch
- `GET /api/trends/tracked/[id]/narratives/[nodeId]/events` -- Timeline for a narrative node
- `GET /api/trends/tracked/[id]/stakeholders` -- Stakeholder map
- `GET /api/trends/tracked/[id]/export` -- Export
- `GET /api/alerts` -- User alerts
- `PATCH /api/alerts/[id]/read` -- Mark alert read
- `POST /api/alerts/read-all` -- Mark all read
- `POST /api/cron/trend-monitor` -- Scheduled monitoring

### 4.7 New UI Pages & Components
- `src/app/dashboard/project/[id]/page.tsx` -- Trend detail (repurposed from project page) with tabs: Brief, Narrative Tree, Timeline, Stakeholders
- `src/app/dashboard/alerts/page.tsx` -- Alert center
- Components: `narrative-tree.tsx` (interactive tree visualization with expand/collapse), `narrative-node-card.tsx`, `narrative-timeline.tsx`, `narrative-stakeholder-map.tsx`, `narrative-arc-chart.tsx`, `trend-brief.tsx`, `alert-bell.tsx` (header notification bell), `alert-list.tsx`

---

## Phase 5: Polish, Performance & Navigation (Week 14-16)

### 5.1 Sidebar Restructure
Update [app-sidebar.tsx](src/components/dashboard/app-sidebar.tsx):
```
Overview (existing dashboard)
Signals (Phase 1)
Intelligence (Phase 2)
  - World Brief
  - Anomalies
  - Country Risk
  - Focal Points
  - Forecasts
Geo Search (Phase 3)
Markets (Phase 3)
  - Overview
  - Macro Radar
  - Predictions
Tracked Trends (existing, repurposed)
  - Narrative Tree (Phase 4)
Feeds (existing, enhanced)
Keywords (Phase 1)
Alerts (Phase 4)
Settings
```

### 5.2 Enhanced Ticker
Update [trend-ticker.tsx](src/components/dashboard/trend-ticker.tsx) to multi-section:
- Section 1: Breaking alerts (red)
- Section 2: Top trends with momentum arrows
- Section 3: Market data (indices, crypto)
- Section 4: CII alerts for watched countries

### 5.3 Performance Optimizations
- Replace N+1 queries in [trends/graph/route.ts](src/app/api/trends/graph/route.ts) with single aggregation
- Replace sequential dedup loop in [ingest/route.ts](src/app/api/ingest/route.ts) with bulk `createMany({ skipDuplicates: true })`
- Use Next.js `unstable_cache` for hot API responses (30-60s TTL)
- Archive signals older than 90 days to `SignalArchive` table
- Prune `KeywordTimeSeries` entries older than 90 days

### 5.4 Data Archival Cron
- `POST /api/cron/cleanup` -- Daily at 03:00 UTC
- Move old signals to archive, prune time series, resolve stale anomalies

---

## Complete Cron Schedule

| Route | Frequency | Purpose | Phase |
|-------|-----------|---------|-------|
| `/api/cron/ingest` | Every 15 min | Fetch all RSS feeds | 1 |
| `/api/cron/enrich` | Every 15 min (offset +5) | Entity/keyword/location extraction | 1 |
| `/api/cron/rank` | Every 30 min | Rank signals into trends | 1 |
| `/api/cron/anomaly` | Every hour | Welford anomaly detection | 2 |
| `/api/cron/cii` | Daily 00:00 UTC | Country instability index | 2 |
| `/api/cron/world-brief` | Every 6 hours | AI world brief | 2 |
| `/api/cron/forecast` | Daily 06:00 UTC | AI forecasts | 2 |
| `/api/cron/focal-points` | Every 2 hours | Entity convergence | 2 |
| `/api/cron/market-data` | Every 5 min | Financial market data | 3 |
| `/api/cron/prediction-markets` | Every 30 min | Polymarket data | 3 |
| `/api/cron/trend-monitor` | Every 30 min | Monitor tracked trends & discover new narratives | 4 |
| `/api/cron/cleanup` | Daily 03:00 UTC | Archive old data | 5 |

---

## New Package Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `p-limit` | Concurrency control for feed fetching | 1 |
| `react-simple-maps` | World map with CII coloring | 2 |
| `@nivo/radar` | Spider chart for macro radar | 3 |
| `@react-pdf/renderer` | PDF export for dossiers | 4 |

---

## Verification Plan

After each phase:
1. Run `npx prisma migrate dev` to verify schema changes
2. Run `npx prisma generate` to verify client generation
3. Run `npm run build` to verify no TypeScript errors
4. Test each new API route via curl/Postman
5. Verify UI components render correctly in browser
6. Test cron routes with manual POST + CRON_SECRET header
7. Verify data flows: ingest -> enrich -> rank -> display on dashboard

End-to-end test after all phases:
1. Trigger ingestion -> verify 170+ feeds fetched with circuit breakers
2. Verify enrichment -> entities, keywords, locations extracted
3. Verify anomaly detection -> trending keywords with spike badges
4. Verify CII -> world map with country risk coloring
5. Search "Mumbai, India" -> verify geo-location results + AI briefing
6. Track a trend -> verify narrative tree discovery + background monitoring creates events + alerts
7. Check markets page -> verify live crypto/index/commodity prices
8. Export tracked trend as PDF -> verify formatted output with narrative tree
