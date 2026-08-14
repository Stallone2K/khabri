# Khabri Monitor — Plan

Goal: the worldmonitor.app feel — an always-on situation room, not a report
generator. Dense, live, instant. Personal: tuned to the user's country,
regions, and niches.

## Non-negotiable principles

1. **The UI never awaits an LLM.** Gemini runs only inside background cycles
   (cron). Every user-facing read hits Postgres/cache and returns in <200ms.
2. **The screen moves on its own.** Panels auto-refresh (60s), ticker streams,
   "last updated" is always visible. No scan buttons in the primary UX.
3. **Failures are invisible.** A failed compute cycle means last cycle's data
   keeps showing with an honest timestamp — never a spinner, never an error
   panel. (Fallback chains + backoff already handle most weather.)
4. **One design language.** Terminal chrome — monospace numerals, 1px borders,
   severity colors, boxy — applied to every panel, not some.

## Performance budget

- First paint of /dashboard: < 1s (prod build)
- Any panel data read: < 200ms (DB/cache only)
- Region switch: instant (precomputed)
- Auto-refresh cadence: 60s panels, ticker continuous
- User-facing Gemini calls: **zero**

## Phases (each independently shippable)

### P0 — Engine inversion  ← the one that kills "slow"
Precompute regional rankings inside the existing 3h ingest cycle:
- country-level + all zones + top ~10 states by signal volume (+ every region
  any user has actually viewed, tracked via RegionTrendCache hits)
- ~12-18 Gemini calls per cycle on pinned models with fallback chain; cached
  into RegionTrendCache; UI only ever reads the cache (no compute-on-miss)
- Retire the scan button from primary UX (cron owns ingestion; keep a
  low-key manual trigger in a dev/ops corner)

### P1 — The Monitor screen
Recompose /dashboard as a dense grid (all pieces exist):
```
┌──────────────────────────────────────────────────────────────────┐
│ TICKER (streams, region-aware)                        UTC clock  │
├──────────────────────────────┬───────────────┬───────────────────┤
│ 2D WORLD MAP                 │ MY REGIONS    │ ANOMALY RAIL      │
│ heat cells + anomaly pulses  │ IN · WEST ·   │ severity-sorted,  │
│ (maplibre mercator, tile     │ GOA columns:  │ auto-resolve      │
│  proxy already built)        │ top trends,   │ countdowns        │
│ click cell → signals drawer  │ instant       │                   │
├──────────────────────────────┴───────────────┼───────────────────┤
│ SIGNAL FIREHOSE (latest, streams in)         │ MARKETS strip     │
└──────────────────────────────────────────────┴───────────────────┘
```
- 2D map, not the globe: closer to WM's feel, lighter, and the globe branch
  (v08.2026) remains the home of the 3D experience later
- Auto-refresh 60s; "new since last cycle" deltas per region column

### P2 — Deploy to prod
Prepared and rehearsed already: merge → additive migration SQL → gazetteer
seed → backfill → build → restart. Enrichment fix + model pinning ride along.
Crontab unchanged (precompute lives inside existing cron ingest).

### P3 — Liveness polish
SSE push for ticker/anomalies (endpoint exists in WIP), per-region trend
sparkline history (append-only RegionTrendCache history), region delta badges.

### P4 — Later
v08.2026 globe rides the same engine as an alternate view; monetization merge
(radius/region count as plan tiers).

## What we already have (nothing this week was wasted)
Gazetteer (285k places) · resolver at 92.8% · regional ranking engine +
cache · hardened Gemini layer (pinned models, backoff, fallback chains) ·
tile proxy + map styling · anomaly engine (window fixed) · enrichment fix ·
headless screenshot verification loop.

## Decisions (locked 2026-08-15)
1. **Monitor replaces /dashboard.** Chart/table fold into it or sub-pages.
2. **Precompute: country + all zones + top 10 states** by signal volume, plus
   any region a user views joins the rotation automatically.
3. **Single deploy: hold prod until the Monitor screen is done.** One big
   visible change, shipped when it feels right.
