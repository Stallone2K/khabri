import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api-auth";
import { enrichSignals } from "@/lib/ingestion/signal-enricher";
import { resolveSignalLocations } from "@/lib/ingestion/location-resolver";

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
    // 2. RUN ENRICHMENT (max 100 signals per invocation)
    // =========================================================================
    console.log("[CRON/ENRICH] Starting enrichment run...");
    const stats = await enrichSignals(100);

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

    return NextResponse.json({
      success: true,
      ...stats,
      locationResolution: resolverStats,
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
