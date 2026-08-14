import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api-auth";
import { enrichSignals } from "@/lib/ingestion/signal-enricher";
import { resolveSignalLocations } from "@/lib/ingestion/location-resolver";
import { precomputeRegions } from "@/lib/regional-trends";
export async function POST(req: Request) {
  // =========================================================================
  // 1. AUTHENTICATION — Cron secret or dev mode
  // =========================================================================
  const isCron = verifyCronSecret(req);
  const isDev = process.env.NODE_ENV === "development";

  if (!isCron && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // =========================================================================
    // 2. RUN ENRICHMENT
    // Cap of 2000/run: steady state needs ~400 per 3h cron cycle, the headroom
    // lets a backlog drain within a few cycles without an unbounded run.
    // =========================================================================
    console.log("[CRON/ENRICH] Starting enrichment run...");
    const stats = await enrichSignals(2000);

    console.log(
      `[CRON/ENRICH] Complete: ${stats.enrichedCount} enriched, ` +
        `${stats.entitiesExtracted} entities, ${stats.keywordsExtracted} keywords, ` +
        `${stats.locationsExtracted} locations, ${stats.errors.length} errors`,
    );

    // =========================================================================
    // 3. RESOLVE LOCATIONS — Link SignalLocations to canonical Location records
    // =========================================================================
    console.log("[CRON/ENRICH] Running location resolution...");
    const resolverStats = await resolveSignalLocations(500);

    // =========================================================================
    // 4. PRECOMPUTE REGIONAL RANKINGS (MONITOR-PLAN P0)
    // Runs here — after enrichment + resolution — so rankings always see the
    // freshest geo-tagged signals. The UI only ever reads the cache.
    // =========================================================================
    console.log("[CRON/ENRICH] Precomputing regional rankings...");
    const precomputeStats = await precomputeRegions().catch((e: any) => {
      console.error("[CRON/ENRICH] Precompute failed:", e?.message ?? e);
      return { computed: 0, failed: -1, skipped: 0 };
    });

    return NextResponse.json({
      success: true,
      ...stats,
      locationResolution: resolverStats,
      precompute: precomputeStats,
    });
  } catch (error: any) {
    console.error("[CRON/ENRICH] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Enrichment pipeline failed",
        details: error.message || String(error),
      },
      { status: 500 },
    );
  }
}
