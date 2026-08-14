import { prisma } from "@/lib/prisma";
import { latLngToCell } from "h3-js";

// =============================================================================
// TYPES
// =============================================================================

export interface ResolverStats {
  resolved: number;
  byName: number;
  byAlias: number;
  byCountryCode: number;
  h3Tagged: number;
  unresolved: number;
}

/** H3 resolution used across the globe pipeline (heatmap buckets, radius cover). */
export const H3_RESOLUTION = 5;

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
 * Pass 4 — copy lat/lng from the linked gazetteer row and compute the H3 cell
 *          (in JS, res 5) for every newly-coordinated row.
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
    h3Tagged: 0,
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
    // PASS 4: coordinates from gazetteer + H3 cell
    // -------------------------------------------------------------------------
    await prisma.$executeRaw`
      UPDATE "SignalLocation" sl
      SET lat = l.lat, lng = l.lng
      FROM "Location" l
      WHERE sl."locationId" = l."id"
        AND sl.lat IS NULL
        AND l.lat IS NOT NULL
    `;

    const needsH3 = await prisma.signalLocation.findMany({
      where: { lat: { not: null }, lng: { not: null }, h3Cell: null },
      select: { id: true, lat: true, lng: true },
      take: limit * 4,
    });
    for (let i = 0; i < needsH3.length; i += 200) {
      const chunk = needsH3.slice(i, i + 200);
      await prisma.$transaction(
        chunk.map((row) =>
          prisma.signalLocation.update({
            where: { id: row.id },
            data: { h3Cell: latLngToCell(row.lat!, row.lng!, H3_RESOLUTION) },
          }),
        ),
      );
    }
    stats.h3Tagged = needsH3.length;

    stats.unresolved = await prisma.signalLocation.count({
      where: { locationId: null },
    });

    console.log(
      `[RESOLVE] ${stats.resolved} resolved (name: ${stats.byName}, alias: ${stats.byAlias}, ` +
        `cc: ${stats.byCountryCode}), ${stats.h3Tagged} h3-tagged, ${stats.unresolved} unresolved`,
    );
  } catch (error: unknown) {
    console.error("[RESOLVE] Location resolution failed:", error);
    throw error;
  }

  return stats;
}
