import { PrismaClient } from "@prisma/client";

// =============================================================================
// TYPES
// =============================================================================

export interface WelfordState {
  mean: number;
  m2: number;
  sampleCount: number;
}

export interface AnomalyResult {
  zScore: number;
  severity: "NONE" | "ELEVATED" | "HIGH" | "CRITICAL";
  currentValue: number;
  baselineMean: number;
  baselineStdDev: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const THRESHOLDS = {
  ELEVATED: 1.5,
  HIGH: 2.0,
  CRITICAL: 3.0,
} as const;

// Minimum hourly observations before anomaly detection activates
const MIN_SAMPLES = 12;

// =============================================================================
// WELFORD'S ONLINE ALGORITHM
// =============================================================================

/** Update Welford state with a new observation. Returns a new state. */
export function welfordUpdate(state: WelfordState, newValue: number): WelfordState {
  const n = state.sampleCount + 1;
  const delta = newValue - state.mean;
  const newMean = state.mean + delta / n;
  const delta2 = newValue - newMean;
  const newM2 = state.m2 + delta * delta2;
  return { mean: newMean, m2: newM2, sampleCount: n };
}

/** Compute standard deviation from Welford state. */
export function welfordStdDev(state: WelfordState): number {
  if (state.sampleCount < 2) return 0;
  return Math.sqrt(state.m2 / state.sampleCount);
}

/** Compute z-score and classify severity. Returns NONE if insufficient data. */
export function computeAnomaly(
  state: WelfordState,
  currentValue: number,
): AnomalyResult {
  const stdDev = welfordStdDev(state);
  const baselineMean = state.mean;

  if (state.sampleCount < MIN_SAMPLES || stdDev === 0) {
    return { zScore: 0, severity: "NONE", currentValue, baselineMean, baselineStdDev: stdDev };
  }

  const zScore = (currentValue - baselineMean) / stdDev;

  let severity: AnomalyResult["severity"] = "NONE";
  if (zScore >= THRESHOLDS.CRITICAL) severity = "CRITICAL";
  else if (zScore >= THRESHOLDS.HIGH) severity = "HIGH";
  else if (zScore >= THRESHOLDS.ELEVATED) severity = "ELEVATED";

  return { zScore, severity, currentValue, baselineMean, baselineStdDev: stdDev };
}

/** Compute auto-resolve timestamp based on severity. */
export function computeAutoResolveTime(severity: string, now: Date): Date {
  const hours = severity === "CRITICAL" ? 24 : severity === "HIGH" ? 12 : 6;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

// =============================================================================
// AGGREGATION QUERIES — count from existing enrichment tables
// =============================================================================

/** Count keyword occurrences in signals since `since`. */
export async function countKeywordsSince(
  prisma: PrismaClient,
  since: Date,
): Promise<Map<string, number>> {
  const results = await prisma.$queryRaw<{ keyword: string; count: bigint }[]>`
    SELECT sk."keyword", COUNT(*) as count
    FROM "SignalKeyword" sk
    JOIN "Signal" s ON sk."signalId" = s."id"
    WHERE s."createdAt" >= ${since}
    GROUP BY sk."keyword"
    HAVING COUNT(*) >= 2
  `;
  const map = new Map<string, number>();
  for (const r of results) map.set(r.keyword, Number(r.count));
  return map;
}

/** Count entity mentions in signals since `since`. */
export async function countEntitiesSince(
  prisma: PrismaClient,
  since: Date,
): Promise<Map<string, number>> {
  const results = await prisma.$queryRaw<{ name: string; type: string; count: bigint }[]>`
    SELECT se."name", se."type", COUNT(*) as count
    FROM "SignalEntity" se
    JOIN "Signal" s ON se."signalId" = s."id"
    WHERE s."createdAt" >= ${since}
    GROUP BY se."name", se."type"
    HAVING COUNT(*) >= 2
  `;
  const map = new Map<string, number>();
  for (const r of results) map.set(`${r.name}::${r.type}`, Number(r.count));
  return map;
}

/** Count signals per country since `since`. */
export async function countCountriesSince(
  prisma: PrismaClient,
  since: Date,
): Promise<Map<string, number>> {
  const results = await prisma.$queryRaw<{ countryCode: string; count: bigint }[]>`
    SELECT sl."countryCode", COUNT(DISTINCT sl."signalId") as count
    FROM "SignalLocation" sl
    JOIN "Signal" s ON sl."signalId" = s."id"
    WHERE s."createdAt" >= ${since}
      AND sl."countryCode" IS NOT NULL
    GROUP BY sl."countryCode"
    HAVING COUNT(DISTINCT sl."signalId") >= 2
  `;
  const map = new Map<string, number>();
  for (const r of results) map.set(r.countryCode, Number(r.count));
  return map;
}

/** Average sentiment per keyword since `since`. */
export async function computeSentimentSince(
  prisma: PrismaClient,
  since: Date,
): Promise<Map<string, number>> {
  const results = await prisma.$queryRaw<{
    keyword: string;
    avgSentiment: number;
  }[]>`
    SELECT sk."keyword", AVG(s."sentimentScore") as "avgSentiment"
    FROM "SignalKeyword" sk
    JOIN "Signal" s ON sk."signalId" = s."id"
    WHERE s."createdAt" >= ${since}
      AND s."sentimentScore" IS NOT NULL
    GROUP BY sk."keyword"
    HAVING COUNT(*) >= 3
  `;
  const map = new Map<string, number>();
  for (const r of results) map.set(`sentiment::${r.keyword}`, Number(r.avgSentiment));
  return map;
}

// =============================================================================
// LABEL HELPERS
// =============================================================================

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AR: "Argentina", AU: "Australia",
  AT: "Austria", BD: "Bangladesh", BE: "Belgium", BR: "Brazil", CA: "Canada",
  CL: "Chile", CN: "China", CO: "Colombia", CZ: "Czech Republic", DK: "Denmark",
  EG: "Egypt", ET: "Ethiopia", FI: "Finland", FR: "France", DE: "Germany",
  GH: "Ghana", GR: "Greece", HK: "Hong Kong", HU: "Hungary", IN: "India",
  ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland", IL: "Israel",
  IT: "Italy", JP: "Japan", KE: "Kenya", KR: "South Korea", KW: "Kuwait",
  MY: "Malaysia", MX: "Mexico", MA: "Morocco", NL: "Netherlands", NZ: "New Zealand",
  NG: "Nigeria", NO: "Norway", PK: "Pakistan", PH: "Philippines", PL: "Poland",
  PT: "Portugal", QA: "Qatar", RO: "Romania", RU: "Russia", SA: "Saudi Arabia",
  SG: "Singapore", ZA: "South Africa", ES: "Spain", SE: "Sweden", CH: "Switzerland",
  TW: "Taiwan", TH: "Thailand", TR: "Turkey", UA: "Ukraine", AE: "UAE",
  GB: "United Kingdom", US: "United States", VN: "Vietnam",
};

/** Generate a human-readable label from a dimension key. */
export function keyToLabel(dimension: string, key: string): string {
  if (dimension === "ENTITY") {
    const [name] = key.split("::");
    return name;
  }
  if (dimension === "COUNTRY") {
    return COUNTRY_NAMES[key] || key;
  }
  if (dimension === "SENTIMENT") {
    return key.replace("sentiment::", "");
  }
  return key; // KEYWORD — already readable
}

/** Map dimension to anomaly event type. */
export function dimensionToType(dimension: string): string {
  switch (dimension) {
    case "KEYWORD": return "KEYWORD_SPIKE";
    case "ENTITY": return "ENTITY_SURGE";
    case "COUNTRY": return "GEO_CONCENTRATION";
    case "SENTIMENT": return "SENTIMENT_SHIFT";
    default: return "KEYWORD_SPIKE";
  }
}
