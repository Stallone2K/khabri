import { prisma } from "@/lib/prisma";

/**
 * Extract stakeholders from SignalEntity records for signals that generated narrative events.
 * Upserts NarrativeStakeholder records with mention counts and avg sentiment.
 */
export async function extractStakeholders(
  nodeId: string,
  signalUrls: string[],
): Promise<number> {
  if (signalUrls.length === 0) return 0;

  // Find signals by URL, then get their high-salience entities
  const entities = await prisma.signalEntity.findMany({
    where: {
      signal: { url: { in: signalUrls } },
      salience: { gte: 0.5 },
    },
    select: {
      name: true,
      type: true,
      salience: true,
      signal: {
        select: { id: true },
      },
    },
  });

  if (entities.length === 0) return 0;

  // Group by name+type to aggregate
  const grouped = new Map<string, { name: string; type: string; count: number; totalSalience: number }>();

  for (const entity of entities) {
    const key = `${entity.name}::${entity.type}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
      existing.totalSalience += entity.salience;
    } else {
      grouped.set(key, {
        name: entity.name,
        type: entity.type,
        count: 1,
        totalSalience: entity.salience,
      });
    }
  }

  // Upsert stakeholders
  let upserted = 0;
  const now = new Date();

  for (const [, data] of grouped) {
    await prisma.narrativeStakeholder.upsert({
      where: {
        nodeId_name_type: {
          nodeId,
          name: data.name,
          type: data.type,
        },
      },
      create: {
        nodeId,
        name: data.name,
        type: data.type,
        mentionCount: data.count,
        sentiment: data.totalSalience / data.count, // avg salience as proxy sentiment
        lastSeenAt: now,
      },
      update: {
        mentionCount: { increment: data.count },
        lastSeenAt: now,
      },
    });
    upserted++;
  }

  return upserted;
}
