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
 * Resolve unlinked SignalLocations to canonical Location records.
 * Runs 3 passes: exact name match → alias match → country code fallback.
 *
 * Called by: /api/cron/enrich (after enrichSignals completes)
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
    // PASS 1: Exact name + type match (case-insensitive)
    // -------------------------------------------------------------------------
    const pass1 = await prisma.$executeRaw`
      UPDATE "SignalLocation" sl
      SET "locationId" = l."id"
      FROM "Location" l
      WHERE sl."locationId" IS NULL
        AND LOWER(sl."name") = LOWER(l."name")
        AND sl."locationType" = l."type"
    `;
    stats.byName = Number(pass1);

    // -------------------------------------------------------------------------
    // PASS 2: Alias match (check if signal name matches any Location alias)
    // -------------------------------------------------------------------------
    const pass2 = await prisma.$executeRaw`
      UPDATE "SignalLocation" sl
      SET "locationId" = sub."loc_id"
      FROM (
        SELECT DISTINCT ON (sl2."id") sl2."id" AS sl_id, l."id" AS loc_id
        FROM "SignalLocation" sl2
        CROSS JOIN "Location" l,
        LATERAL unnest(l."aliases") AS alias
        WHERE sl2."locationId" IS NULL
          AND LOWER(sl2."name") = LOWER(alias)
        ORDER BY sl2."id", l."id"
      ) sub
      WHERE sl."id" = sub.sl_id
    `;
    stats.byAlias = Number(pass2);

    // -------------------------------------------------------------------------
    // PASS 3: Country code fallback (for COUNTRY type only)
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

    // Count remaining unresolved
    const remaining = await prisma.signalLocation.count({
      where: { locationId: null },
    });
    stats.unresolved = remaining;

    console.log(
      `[RESOLVE] ${stats.resolved} resolved (name: ${stats.byName}, alias: ${stats.byAlias}, cc: ${stats.byCountryCode}), ${stats.unresolved} unresolved`,
    );
  } catch (error: unknown) {
    console.error("[RESOLVE] Location resolution failed:", error);
    throw error;
  }

  return stats;
}
