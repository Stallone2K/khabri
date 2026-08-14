/**
 * Regional trend engine — P0 of MONITOR-PLAN.md.
 *
 * Rankings are Gemini calls, so they run ONLY here, invoked from the cron
 * cycle (precomputeRegions) or fired in the background on a cold cache miss.
 * The API layer reads RegionTrendCache and never awaits an LLM.
 */
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";
import { ZONES_BY_COUNTRY } from "@/lib/regions";

const RANK_MODEL = "gemini-3.5-flash";
const FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
// One cron cycle is 3h — anything younger is "fresh". Older still serves
// (stale-while-revalidate); it just also triggers a background recompute.
export const FRESH_MS = 3.5 * 60 * 60_000;
const ROTATION_DAYS = 7;
const TOP_STATES = 10;
const MIN_SIGNALS = 3;
const MAX_SIGNALS = 250;
const MAX_TRENDS = 30;
const INTER_REGION_DELAY_MS = 1500;

export const WINDOWS: Record<string, number> = { "24h": 24, "3d": 72, "7d": 168, "30d": 720 };

export interface RegionTarget {
  regionKey: string;  // "IN" | "IN:zone:WEST" | "IN:state:33"
  label: string;      // "India" | "Western India" | "Goa"
  country: string;
  admin1Codes: string[] | null; // null = whole country
  window: string;
}

export interface RegionalTrend {
  rank: number;
  topic: string;
  score: number;
  reason: string;
  category: string;
  originalUrl?: string | null;
}

// ---------------------------------------------------------------------------
// REGION RESOLUTION
// ---------------------------------------------------------------------------

/** Resolve query params into a concrete target, or null if unknown. */
export async function resolveRegion(
  country: string,
  opts: { state?: string | null; zone?: string | null },
): Promise<RegionTarget | null> {
  if (opts.state) {
    const st = await prisma.location.findFirst({
      where: { type: "STATE", countryCode: country, admin1Code: opts.state },
      select: { name: true, admin1Code: true },
    });
    if (!st?.admin1Code) return null;
    return {
      regionKey: `${country}:state:${st.admin1Code}`,
      label: st.name,
      country,
      admin1Codes: [st.admin1Code],
      window: "30d",
    };
  }
  if (opts.zone) {
    const zoneDef = (ZONES_BY_COUNTRY[country] ?? []).find((z) => z.key === opts.zone);
    if (!zoneDef) return null;
    const states = await prisma.location.findMany({
      where: { type: "STATE", countryCode: country, name: { in: zoneDef.states } },
      select: { admin1Code: true },
    });
    return {
      regionKey: `${country}:zone:${zoneDef.key}`,
      label: `${zoneDef.label} ${country === "IN" ? "India" : country}`,
      country,
      admin1Codes: states.map((s) => s.admin1Code).filter((c): c is string => !!c),
      window: "30d",
    };
  }
  const countryRow = await prisma.location.findFirst({
    where: { type: "COUNTRY", countryCode: country },
    select: { name: true },
  });
  return {
    regionKey: country,
    label: countryRow?.name ?? country,
    country,
    admin1Codes: null,
    window: "7d",
  };
}

/** Parse a stored regionKey back into resolvable parts (for the rotation). */
export function parseRegionKey(key: string): { country: string; state?: string; zone?: string } | null {
  const m = key.match(/^([A-Z]{2})(?::(state|zone):(.+))?$/);
  if (!m) return null;
  if (m[2] === "state") return { country: m[1], state: m[3] };
  if (m[2] === "zone") return { country: m[1], zone: m[3] };
  return { country: m[1] };
}

// ---------------------------------------------------------------------------
// COMPUTE (the only place Gemini runs)
// ---------------------------------------------------------------------------

export async function computeRegion(target: RegionTarget): Promise<{
  trends: RegionalTrend[];
  signalCount: number;
}> {
  const cutoff = new Date(Date.now() - (WINDOWS[target.window] ?? 168) * 3_600_000);

  const signals = target.admin1Codes
    ? await prisma.$queryRaw<{ id: string; title: string; url: string; source: string }[]>`
        SELECT DISTINCT s."id", s."title", s."url", s."source", s."createdAt"
        FROM "Signal" s
        JOIN "SignalLocation" sl ON sl."signalId" = s."id"
        JOIN "Location" l ON l."id" = sl."locationId"
        WHERE l."countryCode" = ${target.country}
          AND l."admin1Code" = ANY(${target.admin1Codes})
          AND s."createdAt" > ${cutoff}
        ORDER BY s."createdAt" DESC
        LIMIT ${MAX_SIGNALS}
      `
    : await prisma.$queryRaw<{ id: string; title: string; url: string; source: string }[]>`
        SELECT DISTINCT s."id", s."title", s."url", s."source", s."createdAt"
        FROM "Signal" s
        JOIN "SignalLocation" sl ON sl."signalId" = s."id"
        JOIN "Location" l ON l."id" = sl."locationId"
        WHERE l."countryCode" = ${target.country}
          AND s."createdAt" > ${cutoff}
        ORDER BY s."createdAt" DESC
        LIMIT ${MAX_SIGNALS}
      `;

  let trends: RegionalTrend[] = [];
  if (signals.length >= MIN_SIGNALS) {
    const targetCount = Math.min(MAX_TRENDS, Math.max(5, Math.ceil(signals.length / 4)));
    const prompt = `You are a regional news analyst for ${target.label}. Below are ${signals.length} recent news signals geo-tagged to ${target.label}.

Identify the TOP ${targetCount} distinct trends/stories happening in or directly affecting ${target.label}. Merge duplicate coverage of one story into a single trend. Prefer locally impactful stories over global stories that merely mention the region. Never invent stories not present in the signals.

Return a JSON array of exactly this shape:
[{"rank": 1, "topic": "max 12 words", "score": 0-100, "reason": "one sentence on local impact", "category": "POLITICS|GEOPOLITICS|TECH|FINANCE|CRYPTO|SCIENCE|MILITARY|CLIMATE|HEALTH|SPORTS|ENTERTAINMENT|BUSINESS|SOCIETY", "source_index": <number of the most representative signal below>}]

SIGNALS:
${signals.map((s, i) => `${i + 1}. [${s.source}] ${s.title}`).join("\n")}`;

    const raw = await generateJSON<(RegionalTrend & { source_index?: number })[]>(
      RANK_MODEL,
      prompt,
      0.2,
      FALLBACKS,
    );
    trends = (raw ?? [])
      .filter((t) => t?.topic)
      .slice(0, MAX_TRENDS)
      .map((t, i) => ({
        rank: i + 1,
        topic: t.topic,
        score: Math.max(0, Math.min(100, Math.round(t.score ?? 0))),
        reason: t.reason ?? "",
        category: t.category ?? "SOCIETY",
        originalUrl:
          t.source_index && signals[t.source_index - 1] ? signals[t.source_index - 1].url : null,
      }));
  }

  await prisma.regionTrendCache.upsert({
    where: { regionKey_window: { regionKey: target.regionKey, window: target.window } },
    create: {
      regionKey: target.regionKey,
      window: target.window,
      trends: trends as any,
      signalCount: signals.length,
    },
    update: {
      trends: trends as any,
      signalCount: signals.length,
      computedAt: new Date(),
    },
  });

  return { trends, signalCount: signals.length };
}

// ---------------------------------------------------------------------------
// PRECOMPUTE CYCLE (called from cron after enrichment + resolution)
// ---------------------------------------------------------------------------

export async function precomputeRegions(): Promise<{
  computed: number;
  failed: number;
  skipped: number;
}> {
  const stats = { computed: 0, failed: 0, skipped: 0 };
  const targets = new Map<string, RegionTarget>();

  // 1. Every country users actually belong to
  const userCountries = await prisma.user.findMany({
    where: { countryCode: { not: null } },
    select: { countryCode: true },
    distinct: ["countryCode"],
  });

  for (const { countryCode } of userCountries) {
    const country = countryCode!;
    const countryTarget = await resolveRegion(country, {});
    if (countryTarget) targets.set(countryTarget.regionKey, countryTarget);

    // zones
    for (const zone of ZONES_BY_COUNTRY[country] ?? []) {
      const t = await resolveRegion(country, { zone: zone.key });
      if (t) targets.set(t.regionKey, t);
    }

    // top states by 30d signal volume
    const topStates = await prisma.$queryRaw<{ admin1Code: string }[]>`
      SELECT l."admin1Code"
      FROM "Location" l
      JOIN "SignalLocation" sl ON sl."locationId" = l."id"
      JOIN "Signal" s ON s."id" = sl."signalId"
      WHERE l."countryCode" = ${country}
        AND l."admin1Code" IS NOT NULL
        AND s."createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY l."admin1Code"
      ORDER BY COUNT(DISTINCT sl."signalId") DESC
      LIMIT ${TOP_STATES}
    `;
    for (const { admin1Code } of topStates) {
      const t = await resolveRegion(country, { state: admin1Code });
      if (t) targets.set(t.regionKey, t);
    }
  }

  // 2. Rotation: any region a user viewed recently stays fresh
  const rotation = await prisma.regionTrendCache.findMany({
    where: { lastAccessAt: { gte: new Date(Date.now() - ROTATION_DAYS * 86_400_000) } },
    select: { regionKey: true },
    distinct: ["regionKey"],
  });
  for (const { regionKey } of rotation) {
    if (targets.has(regionKey)) continue;
    const parts = parseRegionKey(regionKey);
    if (!parts) continue;
    const t = await resolveRegion(parts.country, parts);
    if (t) targets.set(t.regionKey, t);
  }

  console.log(`[PRECOMPUTE] ${targets.size} region targets this cycle`);

  // 3. Sequential compute — gentle on Gemini, failures skip to the next region
  for (const target of targets.values()) {
    try {
      const { trends, signalCount } = await computeRegion(target);
      stats.computed++;
      console.log(
        `[PRECOMPUTE] ${target.regionKey} (${target.window}): ${trends.length} trends / ${signalCount} signals`,
      );
    } catch (e: any) {
      stats.failed++;
      console.error(`[PRECOMPUTE] ${target.regionKey} failed: ${e?.message ?? e}`);
    }
    await new Promise((r) => setTimeout(r, INTER_REGION_DELAY_MS));
  }

  console.log(
    `[PRECOMPUTE] cycle done: ${stats.computed} computed, ${stats.failed} failed`,
  );
  return stats;
}
