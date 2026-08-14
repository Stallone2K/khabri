/**
 * One-time backfill: resolve all existing SignalLocations against the
 * GeoNames gazetteer in batches until no progress.
 *
 * Run after seed-geonames.ts: npx tsx scripts/backfill-geo.ts
 */
import { resolveSignalLocations } from "../src/lib/ingestion/location-resolver";
import { prisma } from "../src/lib/prisma";

async function main() {
  const t0 = Date.now();
  let round = 0;
  let lastUnresolved = Infinity;

  for (;;) {
    round++;
    const stats = await resolveSignalLocations(5000);
    console.log(`[BACKFILL] round ${round}: +${stats.resolved} resolved, ${stats.unresolved} left`);
    if (stats.unresolved >= lastUnresolved) break; // no progress — the rest are unmatchable
    lastUnresolved = stats.unresolved;
  }

  const [total, linked] = await Promise.all([
    prisma.signalLocation.count(),
    prisma.signalLocation.count({ where: { locationId: { not: null } } }),
  ]);
  console.log(
    `[BACKFILL] done in ${Math.round((Date.now() - t0) / 1000)}s: ` +
      `${linked}/${total} linked (${((linked / Math.max(total, 1)) * 100).toFixed(1)}%)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
