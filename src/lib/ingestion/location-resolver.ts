import { prisma } from "@/lib/prisma";

// =============================================================================
// TYPES
// =============================================================================

export interface ResolverStats {
  resolved: number;
  byName: number;
  byAlias: number;
  byCountryCode: number;
  unresolved: number;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Resolve unlinked SignalLocations against the GeoNames-backed gazetteer.
 *
 * Pass 1 — name/asciiName match, disambiguated by: same country as the signal
 *          mention > matching location type > highest population.
 * Pass 2 — alias match (alternate names, multilingual) with same ranking.
 * Pass 3 — country-code fallback for COUNTRY mentions.
 * Pass 4 — copy lat/lng from the linked gazetteer row.
 *
 * Called by: /api/cron/enrich (after enrichSignals), scripts/backfill-geo.ts
 */
export async function resolveSignalLocations(
  limit: number = 500,
): Promise<ResolverStats> {
  const stats: ResolverStats = {
    resolved: 0,
    byName: 0,
    byAlias: 0,
    byCountryCode: 0,
    unresolved: 0,
  };

  try {
    // -------------------------------------------------------------------------
    // PASS 1: name / asciiName match, population-weighted (uses LOWER indexes)
    // -------------------------------------------------------------------------
    const pass1 = await prisma.$executeRaw`
      UPDATE "SignalLocation" sl
      SET "locationId" = pick.loc_id
      FROM (
        SELECT DISTINCT ON (sl2."id") sl2."id" AS sl_id, l."id" AS loc_id
        FROM (
          SELECT "id", "name", "locationType", "countryCode"
          FROM "SignalLocation"
          WHERE "locationId" IS NULL
          LIMIT ${limit}
        ) sl2
        JOIN "Location" l
          ON LOWER(l."name") = LOWER(sl2."name")
          OR LOWER(l."asciiName") = LOWER(sl2."name")
        ORDER BY sl2."id",
          (sl2."countryCode" IS NOT NULL AND l."countryCode" = sl2."countryCode") DESC,
          (l."type" = sl2."locationType") DESC,
          l."population" DESC
      ) pick
      WHERE sl."id" = pick.sl_id
    `;
    stats.byName = Number(pass1);

    // -------------------------------------------------------------------------
    // PASS 2: alias match (alternate/multilingual names on gazetteer rows)
    // -------------------------------------------------------------------------
    const pass2 = await prisma.$executeRaw`
      UPDATE "SignalLocation" sl
      SET "locationId" = pick.loc_id
      FROM (
        SELECT DISTINCT ON (sl2."id") sl2."id" AS sl_id, l."id" AS loc_id
        FROM (
          SELECT "id", "name", "countryCode"
          FROM "SignalLocation"
          WHERE "locationId" IS NULL
          LIMIT ${limit}
        ) sl2
        JOIN "Location" l ON l."aliases" && ARRAY[sl2."name"]
        ORDER BY sl2."id",
          (sl2."countryCode" IS NOT NULL AND l."countryCode" = sl2."countryCode") DESC,
          l."population" DESC
      ) pick
      WHERE sl."id" = pick.sl_id
    `;
    stats.byAlias = Number(pass2);

    // -------------------------------------------------------------------------
    // PASS 3: country-code fallback for COUNTRY mentions
    // -------------------------------------------------------------------------
    const pass3 = await prisma.$executeRaw`
      UPDATE "SignalLocation" sl
      SET "locationId" = l."id"
      FROM "Location" l
      WHERE sl."locationId" IS NULL
        AND sl."locationType" = 'COUNTRY'
        AND sl."countryCode" IS NOT NULL
        AND sl."countryCode" = l."countryCode"
        AND l."type" = 'COUNTRY'
    `;
    stats.byCountryCode = Number(pass3);

    stats.resolved = stats.byName + stats.byAlias + stats.byCountryCode;

    // -------------------------------------------------------------------------
    // PASS 4: coordinates from gazetteer
    // -------------------------------------------------------------------------
    await prisma.$executeRaw`
      UPDATE "SignalLocation" sl
      SET lat = l.lat, lng = l.lng
      FROM "Location" l
      WHERE sl."locationId" = l."id"
        AND sl.lat IS NULL
        AND l.lat IS NOT NULL
    `;

    stats.unresolved = await prisma.signalLocation.count({
      where: { locationId: null },
    });

    console.log(
      `[RESOLVE] ${stats.resolved} resolved (name: ${stats.byName}, alias: ${stats.byAlias}, ` +
        `cc: ${stats.byCountryCode}), ${stats.unresolved} unresolved`,
    );
  } catch (error: unknown) {
    console.error("[RESOLVE] Location resolution failed:", error);
    throw error;
  }

  return stats;
}
