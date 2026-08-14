import { NextResponse } from "next/server";
import { after } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  resolveRegion,
  computeRegion,
  FRESH_MS,
  WINDOWS,
} from "@/lib/regional-trends";

// Cold-miss compute guard: one background compute per region at a time.
const computing = new Set<string>();

/**
 * GET /api/trends/regional?country=IN[&state=<admin1Code>|&zone=<key>][&window=30d]
 *
 * CACHE-FIRST — this route never awaits Gemini (MONITOR-PLAN P0):
 * - fresh cache   → serve it
 * - stale cache   → serve it (marked stale) + background recompute
 * - cold miss     → { computing: true } + background compute; client polls
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: "country required (ISO alpha-2)" }, { status: 400 });
  }

  const target = await resolveRegion(country, {
    state: searchParams.get("state"),
    zone: searchParams.get("zone")?.toUpperCase() ?? null,
  });
  if (!target) return NextResponse.json({ error: "Unknown region" }, { status: 404 });

  // Optional explicit window override (else the region's default)
  const windowParam = searchParams.get("window");
  if (windowParam && WINDOWS[windowParam]) target.window = windowParam;

  const cached = await prisma.regionTrendCache.findUnique({
    where: { regionKey_window: { regionKey: target.regionKey, window: target.window } },
  });

  // Track access for the precompute rotation (fire-and-forget)
  if (cached) {
    prisma.regionTrendCache
      .update({ where: { id: cached.id }, data: { lastAccessAt: new Date() } })
      .catch(() => {});
  }

  const computeKey = `${target.regionKey}|${target.window}`;
  const isFresh = cached && Date.now() - cached.computedAt.getTime() < FRESH_MS;

  if (!isFresh && !computing.has(computeKey)) {
    computing.add(computeKey);
    after(async () => {
      try {
        await computeRegion(target);
      } catch (e: any) {
        console.error(`[REGIONAL-TRENDS] background compute failed for ${computeKey}:`, e?.message ?? e);
      } finally {
        computing.delete(computeKey);
      }
    });
  }

  if (cached) {
    const trends = cached.trends as any[];
    return NextResponse.json({
      trends,
      region: target.label,
      signalCount: cached.signalCount,
      computedAt: cached.computedAt,
      stale: !isFresh,
      ...(trends.length === 0 && cached.signalCount < 3
        ? {
            insufficient: true,
            message: `Only ${cached.signalCount} geo-tagged signal(s) for ${target.label} in the last ${target.window}.`,
          }
        : {}),
    });
  }

  return NextResponse.json({
    trends: [],
    region: target.label,
    computing: true,
    message: `First look at ${target.label} — computing its trends now.`,
  });
}
