# Khabri v08.2026 — Geo Globe Plan

The vision: after onboarding niche selection, the `/dashboard` becomes a Bloomberg-terminal-styled,
green-on-black 3D globe. Signal density renders as green heatpoints. The user navigates, zooms to
any country/state/district, and sets an **ingestion radius**. Trends, topics, and infographics are
computed from signals inside that radius. Works for any region on Earth.

---

## 1. Architecture Overview

```
                        ┌─────────────────────────────────────────────┐
                        │              /dashboard (globe)             │
                        │  MapLibre GL globe · custom hacker style    │
                        │  heatmap layer · radius tool · trend panels │
                        └──────────────┬──────────────────────────────┘
                                       │ GeoJSON / MVT / REST
        ┌──────────────────────────────┼───────────────────────────────┐
        │                              │                               │
┌───────▼────────┐            ┌────────▼────────┐             ┌────────▼────────┐
│ /api/geo/heat  │            │ /api/geo/trends │             │ /api/geo/watch  │
│ H3 aggregates  │            │ radius-ranked   │             │ save radius,    │
│ for zoom level │            │ trends (cached) │             │ spawn ingestion │
└───────┬────────┘            └────────┬────────┘             └────────┬────────┘
        │                              │                               │
        └──────────────┬───────────────┴───────────────┬───────────────┘
                       │                               │
              ┌────────▼─────────┐            ┌────────▼─────────┐
              │ Postgres+PostGIS │            │ Coverage pyramid │
              │ GeoNames gazetteer│           │ 1. GDELT (global)│
              │ Signal → lat/lng │            │ 2. Curated RSS   │
              │ H3 cell buckets  │            │ 3. Google News   │
              └──────────────────┘            │    geo-queries   │
                                              └──────────────────┘
```

## 2. Technology Decisions

| Concern | Choice | Why / Alternatives |
|---|---|---|
| Globe rendering | **MapLibre GL JS** (v5, native globe projection) styled to look like a wireframe hacker globe | Free, no API key, real vector tiles → genuine zoom to state/district with actual boundaries. Pure three.js/globe.gl looks great but makes "zoom into a district and draw a radius" 10x harder. We get the aesthetic via a custom style: black ocean, dim green land strokes, phosphor-green heat layer, scanline/glow shaders on top. |
| Base tiles | OpenFreeMap public tiles (free, no key) initially; self-host Protomaps PMTiles later | Zero cost to start; self-hosting removes the external dependency when it matters. |
| Heat + points overlay | MapLibre heatmap/circle layers from server GeoJSON; deck.gl on top later for arcs/effects | Built-in, GPU-accelerated, trivially styled in green shades. |
| Radius tool | turf.js circle + MapLibre draw handlers | Store `centerLat, centerLng, radiusKm` per user watch. |
| Geo queries | **PostGIS** extension on the existing VPS Postgres 16 | `ST_DWithin` + GIST index answers "signals within radius" at millions-of-rows scale. No new infra. |
| Spatial aggregation | **H3** (h3-js / h3-pg) hexagon cells, res 3–6 by zoom | Heatmap = precomputed counts per cell per time window; radius = cover circle with cells → cache key. |
| Gazetteer | **GeoNames** import (countries, admin1, admin2, cities ≥ 500 pop ≈ 200k rows) | Free, hierarchical, multilingual aliases, lat/lng + population. Replaces the 447-row Location table. |
| Global news baseline | **GDELT** GKG/Events 15-min files (filtered) | Free, planet-wide, pre-geo-coded. Solves "world coverage" without maintaining 50k feeds. |
| Long-tail local news | Google News RSS geo/search feeds generated per radius | On-demand: coverage materializes where users actually look. |
| Rust | Not for v1. Adopt via **martin** (Rust tile server) in Phase 3; candidate for a future ingestion worker if Node becomes the bottleneck | Honest answer: PostGIS is the performance win; a Rust rewrite now would slow the product down. |

## 3. Schema Changes (khabri-v08.2026)

```prisma
model Location {            // GeoNames-backed, replaces current seed
  geonameId    Int      @unique
  name         String
  asciiName    String
  countryCode  String
  admin1Code   String?  // state
  admin2Code   String?  // district
  featureClass String   // A=admin, P=populated place
  population   Int
  lat          Float
  lng          Float
  aliases      String[]
  // + PostGIS geography(Point) column via raw migration, GIST index
}

model SignalLocation {      // existing — now actually resolved
  lat        Float?         // filled from gazetteer match
  lng        Float?
  h3Cell     String?        // res-5 cell, indexed
}

model UserGeoWatch {        // the "ingestion radius"
  id         String  @id @default(cuid())
  userId     String
  label      String         // "Home", "Delhi NCR", ...
  centerLat  Float
  centerLng  Float
  radiusKm   Int
  h3Cells    String[]       // covering cells, precomputed
  categories String[]       // niche filter from onboarding
  isActive   Boolean @default(true)
}

model GeoTrendCache {       // radius trends are expensive → cache by cell-set
  cellSetHash String        // hash of sorted covering cells + window
  window      String        // "6h" | "24h"
  trends      Json
  computedAt  DateTime
  @@unique([cellSetHash, window])
}

model GeoFeedWatch {        // on-demand ingestion spawned by user radii
  queryUrl    String        // generated Google News RSS URL
  placeName   String
  h3Cell      String
  refCount    Int           // active watches referencing it
  lastFetched DateTime?
}
```

## 4. Pipeline Changes

1. **Enrichment must work** — geo-trends are downstream of location extraction. First act on
   `khabri-v2`: cherry-pick the shelved enrichment fix (`enrichment-fix-shelved` branch: drain
   loop, pinned `gemini-3.5-flash-lite`, age window, failure caps). Non-negotiable dependency.
2. **Location resolution v2**: match extracted place names against GeoNames (name + alias +
   admin-context disambiguation, prefer higher population), write lat/lng + h3Cell.
3. **GDELT ingester** (new cron, every 15–30 min): pull GKG file, filter to user niches +
   cells with active watches + global top events, insert as Signals with geo pre-attached.
4. **Geo watch fetcher** (new cron): for active GeoFeedWatch rows, fetch generated Google News
   RSS, dedupe into Signals.
5. **H3 aggregator** (new cron or triggered): maintain per-cell per-window signal counts →
   powers the heatmap instantly at any zoom.
6. **Radius trend ranking**: reuse the existing Gemini ranking prompt, fed with radius-filtered
   signals; cache in GeoTrendCache (cell-set hash) so two users watching Mumbai share one call.
   Anomaly detection gains a (cell, keyword) dimension — same Welford machinery.

## 5. Dashboard Layout (boxy terminal, globe-first)

```
┌────────────────────────────────────────────────────────────────────────┐
│ KHABRI ▓ TERMINAL          [SCANNED 60] [CRIT 2359] [VEL 3] [ENG 11h] │ ← thin stat strip
├──────────────────────────────────────────────┬─────────────────────────┤
│                                              │ ▓ RADIUS: DELHI 150km   │
│                                              │─────────────────────────│
│                                              │ #1 Parliament Curbs...  │
│              3D GLOBE                        │ #2 Fuel Shortages...    │
│      (green heatpoints, radius ring,         │ #3 Border Encounter...  │
│       zoom → country → state → district)     │ ...top N in radius      │
│                                              │─────────────────────────│
│  [+][-][⌂]              [SET RADIUS] [SAVE]  │ ▓ ANOMALIES IN RADIUS   │
│                                              │ ▲ "yamuna" z=3.1        │
├──────────────────────────────────────────────┴─────────────────────────┤
│ ░ NARRATIVE ACTIVITY (sparkline strip, expands to full chart)  ░ TICKER│
└────────────────────────────────────────────────────────────────────────┘
```

Monospace numerals, 1px borders, no rounded corners, phosphor-green accent on the existing
near-black theme. Current Overview widgets survive as the stat strip + collapsible bottom panel.

## 6. Phases

| Phase | Scope | Rough effort |
|---|---|---|
| **P0 — Geo foundation** | PostGIS on VPS + local dev DB; GeoNames import + new Location model; enrichment fix cherry-pick; resolution v2 writes lat/lng + h3; backfill recent signals | 1–2 weeks |
| **P1 — Globe MVP** | MapLibre globe on /dashboard with custom hacker style; heatmap from H3 aggregates of existing signals; radius draw + UserGeoWatch save; right-rail trends filtered by radius (existing data, India-strong) | 2–3 weeks |
| **P2 — World coverage** | GDELT ingester; Google News geo-watch spawning; coverage-quality indicator in UI ("this radius has 3 sources — add more?") | 2–4 weeks |
| **P3 — Perf + polish** | Self-hosted tiles via martin (Rust); GeoTrendCache; deck.gl effects; mobile; retention policy (30-day hot signals, keep H3 aggregates forever) | ongoing |
| **P4 — Monetize** | Radius count/size/refresh-rate as plan features (free: 1 radius 100km; pro: 5 radii 500km; ultimate: unlimited + priority ingestion) — plugs directly into the plans/credits system already on this branch | with P2/P3 |

## 7. Risks & Honest Constraints

- **Coverage will be uneven.** A district in Bihar or rural Kansas may have 2 sources; the UX must
  show coverage density honestly (source count per radius) rather than pretend uniformity.
- **GDELT volume**: full firehose is GBs/day — we filter (niches, watched cells, top events) or it
  swamps the 219MB database. Retention policy becomes mandatory in P2, not optional.
- **Gemini cost scales with radii.** Cell-set caching + lite-tier models + on-demand-only ranking
  keep it bounded; every radius trend call must go through GeoTrendCache.
- **VPS is single-node.** Fine through P2; if GDELT + tiles strain it, martin + a worker process
  are the first split, not a cloud migration.
- **Prod merge checklist unchanged**: Prisma migration (monetization tables + geo tables),
  PostGIS extension install, Razorpay env vars, credits-grant cron line.
