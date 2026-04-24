import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";
import { SIGNAL_ENRICHER_PROMPT } from "@/lib/prompts";
import type { Signal } from "@prisma/client";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const BATCH_SIZE = 20;
const MODEL = "gemini-2.0-flash";
const TEMPERATURE = 0.1;
const INTER_BATCH_DELAY_MS = 500;

// Process-level mutex: prevent concurrent enrichment runs from hammering Gemini.
// Why: /api/cron/enrich, /api/cron/ingest, and /api/ingest all call enrichSignals.
// If two overlap, they grab the same un-enriched rows and double the Gemini RPM.
let enrichmentInFlight: Promise<EnrichmentStats> | null = null;

// ---------------------------------------------------------------------------
// TYPES — Gemini response shape
// ---------------------------------------------------------------------------

interface EnrichedEntity {
  name: string;
  type: string; // PERSON | ORG | COMPANY | COUNTRY | LOCATION
  salience: number;
}

interface EnrichedKeyword {
  keyword: string;
  weight: number;
}

interface EnrichedLocation {
  name: string;
  type: string; // CITY | STATE | COUNTRY | REGION
  countryCode?: string;
}

interface EnrichedSentiment {
  label: string; // POSITIVE | NEGATIVE | NEUTRAL | MIXED
  score: number;
}

interface EnrichedSignalResult {
  id: string;
  entities: EnrichedEntity[];
  keywords: EnrichedKeyword[];
  locations: EnrichedLocation[];
  sentiment: EnrichedSentiment;
}

export interface EnrichmentStats {
  enrichedCount: number;
  entitiesExtracted: number;
  keywordsExtracted: number;
  locationsExtracted: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Clamp a number to [min, max]. Guards against Gemini returning out-of-range values. */
function clamp(value: number | undefined | null, min: number, max: number): number {
  return Math.max(min, Math.min(max, value ?? 0));
}

/** Format signals into the numbered-list format the prompt expects. */
function formatSignalsForPrompt(signals: Signal[]): string {
  return signals
    .map((s, i) => `[${i + 1}|${s.id}] ${s.title}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// CORE: ENRICH A SINGLE BATCH
// ---------------------------------------------------------------------------

/**
 * Send a batch of signals to Gemini for entity/keyword/location/sentiment extraction.
 * Returns parsed results filtered to only include signals we actually sent.
 */
async function enrichBatch(signals: Signal[]): Promise<EnrichedSignalResult[]> {
  const signalText = formatSignalsForPrompt(signals);

  const prompt = `${SIGNAL_ENRICHER_PROMPT}\n\nSIGNALS TO ENRICH (${signals.length} total):\n${signalText}`;

  const results = await generateJSON<EnrichedSignalResult[]>(
    MODEL,
    prompt,
    TEMPERATURE,
  );

  // Validate: only keep results whose ID matches an input signal
  const signalIds = new Set(signals.map((s) => s.id));
  return results.filter((r) => signalIds.has(r.id));
}

// ---------------------------------------------------------------------------
// CORE: SAVE BATCH RESULTS TO DB
// ---------------------------------------------------------------------------

/**
 * Persist enrichment results inside a transaction.
 * If any part fails, the entire batch rolls back and those signals
 * remain isEnriched=false for retry on the next cron run.
 */
async function saveBatchResults(
  results: EnrichedSignalResult[],
): Promise<{ entities: number; keywords: number; locations: number }> {
  let entityCount = 0;
  let keywordCount = 0;
  let locationCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      // 1. Save entities
      if (result.entities?.length > 0) {
        const entityData = result.entities.map((e) => ({
          signalId: result.id,
          name: e.name.trim(),
          type: e.type,
          salience: clamp(e.salience, 0, 1),
        }));
        await tx.signalEntity.createMany({ data: entityData });
        entityCount += entityData.length;
      }

      // 2. Save keywords (lowercased, trimmed)
      if (result.keywords?.length > 0) {
        const keywordData = result.keywords.map((k) => ({
          signalId: result.id,
          keyword: k.keyword.toLowerCase().trim(),
          weight: clamp(k.weight, 0, 1),
        }));
        await tx.signalKeyword.createMany({ data: keywordData });
        keywordCount += keywordData.length;
      }

      // 3. Save locations
      if (result.locations?.length > 0) {
        const locationData = result.locations.map((l) => ({
          signalId: result.id,
          name: l.name.trim(),
          locationType: l.type,
          countryCode: l.countryCode?.toUpperCase() || null,
          lat: null,
          lng: null,
        }));
        await tx.signalLocation.createMany({ data: locationData });
        locationCount += locationData.length;
      }

      // 4. Update signal: mark enriched + save sentiment
      await tx.signal.update({
        where: { id: result.id },
        data: {
          isEnriched: true,
          enrichedAt: new Date(),
          sentiment: result.sentiment?.label || null,
          sentimentScore: result.sentiment
            ? clamp(result.sentiment.score, -1, 1)
            : null,
        },
      });
    }
  });

  return { entities: entityCount, keywords: keywordCount, locations: locationCount };
}

// ---------------------------------------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------------------------------------

/**
 * Enrich up to `maxSignals` un-enriched signals.
 * Processes in batches of 20, continues on per-batch failure.
 *
 * Called by: /api/cron/enrich (every 15 min)
 *
 * Concurrent callers share a single in-flight run via the `enrichmentInFlight` mutex.
 * Why: /api/cron/enrich, /api/cron/ingest, and /api/ingest all invoke this;
 * without the mutex overlapping callers grab the same rows and double Gemini RPM.
 */
export async function enrichSignals(
  maxSignals: number = 100,
): Promise<EnrichmentStats> {
  if (enrichmentInFlight) {
    console.log("[ENRICH] Run already in progress — joining existing run");
    return enrichmentInFlight;
  }
  enrichmentInFlight = runEnrichment(maxSignals).finally(() => {
    enrichmentInFlight = null;
  });
  return enrichmentInFlight;
}

async function runEnrichment(
  maxSignals: number,
): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    enrichedCount: 0,
    entitiesExtracted: 0,
    keywordsExtracted: 0,
    locationsExtracted: 0,
    errors: [],
  };

  // Fetch un-enriched signals (newest first — prioritize fresh data)
  const signals = await prisma.signal.findMany({
    where: { isEnriched: false },
    take: maxSignals,
    orderBy: { createdAt: "desc" },
  });

  if (signals.length === 0) {
    console.log("[ENRICH] No un-enriched signals found. Skipping.");
    return stats;
  }

  console.log(`[ENRICH] Found ${signals.length} un-enriched signals`);

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(signals.length / BATCH_SIZE);

    try {
      console.log(
        `[ENRICH] Processing batch ${batchNum}/${totalBatches} (${batch.length} signals)`,
      );

      // Call Gemini
      const results = await enrichBatch(batch);

      // Save to DB (transactional)
      const counts = await saveBatchResults(results);

      stats.enrichedCount += results.length;
      stats.entitiesExtracted += counts.entities;
      stats.keywordsExtracted += counts.keywords;
      stats.locationsExtracted += counts.locations;

      console.log(
        `[ENRICH] Batch ${batchNum} done: ${results.length} enriched, ` +
          `${counts.entities} entities, ${counts.keywords} keywords, ${counts.locations} locations`,
      );
    } catch (error: any) {
      const errorMsg = `Batch ${batchNum} failed: ${error.message || String(error)}`;
      console.error(`[ENRICH] ${errorMsg}`);
      stats.errors.push(errorMsg);
      // Continue with next batch — don't let one failure kill the run
    }

    if (batchNum < totalBatches) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
  }

  return stats;
}
