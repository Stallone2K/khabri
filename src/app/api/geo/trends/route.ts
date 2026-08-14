import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";

const RANK_MODEL = "gemini-3.5-flash";
const CACHE_TTL_MS = 45 * 60_000;
const MIN_SIGNALS = 5;
const MAX_SIGNALS = 120;
const WINDOWS: Record<string, number> = { "6h": 6, "24h": 24, "3d": 72, "7d": 168 };

interface GeoTrend {
  rank: number;
  topic: string;
  score: number;
  reason: string;
  category: string;
}

/**
 * GET /api/geo/trends?watchId=...&window=24h
 * Trends ranked from signals inside a saved ingestion radius.
 * Gemini calls are cached per (covering-cells, window, categories) so
 * overlapping radii share one computation.
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const watchId = searchParams.get("watchId");
  const windowKey = WINDOWS[searchParams.get("window") ?? "24h"] ? (searchParams.get("window") ?? "24h") : "24h";
  if (!watchId) return NextResponse.json({ error: "watchId required" }, { status: 400 });

  const watch = await prisma.userGeoWatch.findFirst({
    where: { id: watchId, userId, isActive: true },
  });
  if (!watch) return NextResponse.json({ error: "Watch not found" }, { status: 404 });

  const cellSetHash = crypto
    .createHash("sha1")
    .update([...watch.h3Cells].sort().join(",") + "|" + [...watch.categories].sort().join(",") )
    .digest("hex");

  const cached = await prisma.geoTrendCache.findUnique({
    where: { cellSetHash_window: { cellSetHash, window: windowKey } },
  });
  if (cached && Date.now() - cached.computedAt.getTime() < CACHE_TTL_MS) {
    return NextResponse.json({
      trends: cached.trends,
      cached: true,
      computedAt: cached.computedAt,
    });
  }

  // Signals within the radius (PostGIS, GIST expression index)
  const cutoff = new Date(Date.now() - WINDOWS[windowKey] * 3_600_000);
  const meters = watch.radiusKm * 1000;
  const signals = await prisma.$queryRaw<
    { id: string; title: string; source: string; category: string | null }[]
  >`
    SELECT DISTINCT s."id", s."title", s."source", s."category", s."createdAt"
    FROM "Signal" s
    JOIN "SignalLocation" sl ON sl."signalId" = s."id"
    WHERE sl."lat" IS NOT NULL
      AND s."createdAt" > ${cutoff}
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(sl."lng", sl."lat"), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${watch.centerLng}, ${watch.centerLat}), 4326)::geography,
        ${meters}
      )
    ORDER BY s."createdAt" DESC
    LIMIT ${MAX_SIGNALS}
  `;

  if (signals.length < MIN_SIGNALS) {
    return NextResponse.json({
      trends: [],
      insufficient: true,
      signalCount: signals.length,
      message: `Only ${signals.length} geo-tagged signal(s) in this radius/window — coverage is low here.`,
    });
  }

  const categoryFilter = watch.categories.length
    ? `Focus on these categories where possible: ${watch.categories.join(", ")}.`
    : "";
  const prompt = `You are a regional news trend analyst. Below are ${signals.length} recent news signals mentioning places inside a ${watch.radiusKm}km radius watch zone ("${watch.label}").

Identify the TOP 10 distinct trends/stories happening in or affecting this specific area. Merge duplicate coverage of the same story. Prefer locally impactful stories over global stories that merely mention the area. ${categoryFilter}

Return a JSON array of exactly this shape:
[{"rank": 1, "topic": "max 12 words", "score": 0-100, "reason": "one sentence why this matters locally", "category": "POLITICS|TECH|FINANCE|SOCIETY|CLIMATE|HEALTH|MILITARY|SPORTS|BUSINESS|OTHER"}]

SIGNALS:
${signals.map((s, i) => `${i + 1}. [${s.source}] ${s.title}`).join("\n")}`;

  let trends: GeoTrend[];
  try {
    trends = await generateJSON<GeoTrend[]>(RANK_MODEL, prompt, 0.2);
    trends = (trends ?? []).filter((t) => t?.topic).slice(0, 10);
  } catch (error: any) {
    console.error("[GEO-TRENDS] ranking failed:", error?.message ?? error);
    return NextResponse.json(
      { error: "Trend ranking temporarily unavailable", signalCount: signals.length },
      { status: 503 },
    );
  }

  await prisma.geoTrendCache.upsert({
    where: { cellSetHash_window: { cellSetHash, window: windowKey } },
    create: { cellSetHash, window: windowKey, trends: trends as any },
    update: { trends: trends as any, computedAt: new Date() },
  });

  return NextResponse.json({ trends, cached: false, signalCount: signals.length });
}
