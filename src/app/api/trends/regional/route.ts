import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";
import { ZONES_BY_COUNTRY } from "@/lib/regions";

const RANK_MODEL = "gemini-3.5-flash";
const CACHE_TTL_MS = 3 * 60 * 60_000; // one cron cycle — new signals land every 3h
const MIN_SIGNALS = 3;
const MAX_SIGNALS = 250;
const MAX_TRENDS = 30;
const WINDOWS: Record<string, number> = { "24h": 24, "3d": 72, "7d": 168, "30d": 720 };

interface RegionalTrend {
  rank: number;
  topic: string;
  score: number;
  reason: string;
  category: string;
  source_index?: number;
  originalUrl?: string | null;
}

/**
 * GET /api/trends/regional?country=IN[&state=<admin1Code>|&zone=<key>]&window=7d
 * Trends ranked from signals geo-tagged to a country, state, or zone.
 * Rankings are Gemini calls — cached per (region, window) in RegionTrendCache.
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") ?? "").toUpperCase();
  const state = searchParams.get("state");
  const zone = searchParams.get("zone")?.toUpperCase() ?? null;
  const windowKey = WINDOWS[searchParams.get("window") ?? "7d"] ? (searchParams.get("window") ?? "7d") : "7d";
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: "country required (ISO alpha-2)" }, { status: 400 });
  }

  // ---------------------------------------------------------------- region →
  // admin1 codes (null = whole country) + human label + cache key
  let admin1Codes: string[] | null = null;
  let regionLabel = country;
  let regionKey = country;

  if (state) {
    const st = await prisma.location.findFirst({
      where: { type: "STATE", countryCode: country, admin1Code: state },
      select: { name: true, admin1Code: true },
    });
    if (!st?.admin1Code) return NextResponse.json({ error: "Unknown state" }, { status: 404 });
    admin1Codes = [st.admin1Code];
    regionLabel = st.name;
    regionKey = `${country}:state:${st.admin1Code}`;
  } else if (zone) {
    const zoneDef = (ZONES_BY_COUNTRY[country] ?? []).find((z) => z.key === zone);
    if (!zoneDef) return NextResponse.json({ error: "Unknown zone" }, { status: 404 });
    const states = await prisma.location.findMany({
      where: { type: "STATE", countryCode: country, name: { in: zoneDef.states } },
      select: { admin1Code: true },
    });
    admin1Codes = states.map((s) => s.admin1Code).filter((c): c is string => !!c);
    regionLabel = `${zoneDef.label} ${country === "IN" ? "India" : country}`;
    regionKey = `${country}:zone:${zone}`;
  }

  // ---------------------------------------------------------------- cache
  const cached = await prisma.regionTrendCache.findUnique({
    where: { regionKey_window: { regionKey, window: windowKey } },
  });
  if (cached && Date.now() - cached.computedAt.getTime() < CACHE_TTL_MS) {
    return NextResponse.json({
      trends: cached.trends,
      region: regionLabel,
      cached: true,
      computedAt: cached.computedAt,
    });
  }

  // ---------------------------------------------------------------- signals
  const cutoff = new Date(Date.now() - WINDOWS[windowKey] * 3_600_000);
  const signals = admin1Codes
    ? await prisma.$queryRaw<{ id: string; title: string; url: string; source: string }[]>`
        SELECT DISTINCT s."id", s."title", s."url", s."source", s."createdAt"
        FROM "Signal" s
        JOIN "SignalLocation" sl ON sl."signalId" = s."id"
        JOIN "Location" l ON l."id" = sl."locationId"
        WHERE l."countryCode" = ${country}
          AND l."admin1Code" = ANY(${admin1Codes})
          AND s."createdAt" > ${cutoff}
        ORDER BY s."createdAt" DESC
        LIMIT ${MAX_SIGNALS}
      `
    : await prisma.$queryRaw<{ id: string; title: string; url: string; source: string }[]>`
        SELECT DISTINCT s."id", s."title", s."url", s."source", s."createdAt"
        FROM "Signal" s
        JOIN "SignalLocation" sl ON sl."signalId" = s."id"
        JOIN "Location" l ON l."id" = sl."locationId"
        WHERE l."countryCode" = ${country}
          AND s."createdAt" > ${cutoff}
        ORDER BY s."createdAt" DESC
        LIMIT ${MAX_SIGNALS}
      `;

  if (signals.length < MIN_SIGNALS) {
    return NextResponse.json({
      trends: [],
      region: regionLabel,
      insufficient: true,
      signalCount: signals.length,
      message: `Only ${signals.length} geo-tagged signal(s) for ${regionLabel} in the last ${windowKey}.`,
    });
  }

  // ---------------------------------------------------------------- rank
  const targetCount = Math.min(MAX_TRENDS, Math.max(5, Math.ceil(signals.length / 4)));
  const prompt = `You are a regional news analyst for ${regionLabel}. Below are ${signals.length} recent news signals geo-tagged to ${regionLabel}.

Identify the TOP ${targetCount} distinct trends/stories happening in or directly affecting ${regionLabel}. Merge duplicate coverage of one story into a single trend. Prefer locally impactful stories over global stories that merely mention the region. Never invent stories not present in the signals.

Return a JSON array of exactly this shape:
[{"rank": 1, "topic": "max 12 words", "score": 0-100, "reason": "one sentence on local impact", "category": "POLITICS|GEOPOLITICS|TECH|FINANCE|CRYPTO|SCIENCE|MILITARY|CLIMATE|HEALTH|SPORTS|ENTERTAINMENT|BUSINESS|SOCIETY", "source_index": <number of the most representative signal below>}]

SIGNALS:
${signals.map((s, i) => `${i + 1}. [${s.source}] ${s.title}`).join("\n")}`;

  let trends: RegionalTrend[];
  try {
    trends = await generateJSON<RegionalTrend[]>(RANK_MODEL, prompt, 0.2);
    trends = (trends ?? [])
      .filter((t) => t?.topic)
      .slice(0, MAX_TRENDS)
      .map((t, i) => ({
        rank: i + 1,
        topic: t.topic,
        score: Math.max(0, Math.min(100, Math.round(t.score ?? 0))),
        reason: t.reason ?? "",
        category: t.category ?? "SOCIETY",
        originalUrl:
          t.source_index && signals[t.source_index - 1]
            ? signals[t.source_index - 1].url
            : null,
      }));
  } catch (error: any) {
    console.error("[REGIONAL-TRENDS] ranking failed:", error?.message ?? error);
    return NextResponse.json(
      { error: "Trend ranking temporarily unavailable", signalCount: signals.length },
      { status: 503 },
    );
  }

  await prisma.regionTrendCache.upsert({
    where: { regionKey_window: { regionKey, window: windowKey } },
    create: { regionKey, window: windowKey, trends: trends as any },
    update: { trends: trends as any, computedAt: new Date() },
  });

  return NextResponse.json({
    trends,
    region: regionLabel,
    cached: false,
    signalCount: signals.length,
  });
}
