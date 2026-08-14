import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const WINDOWS: Record<string, number> = { "24h": 24, "3d": 72, "7d": 168, "30d": 720 };

/**
 * GET /api/geo/cell?cell=<h3>&window=7d
 * Recent signals mentioning places inside one H3 cell — the heatpoint drill-down.
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cell = searchParams.get("cell");
  if (!cell || !/^[0-9a-f]{15}$/.test(cell)) {
    return NextResponse.json({ error: "valid cell required" }, { status: 400 });
  }
  const hours = WINDOWS[searchParams.get("window") ?? "7d"] ?? 168;
  const cutoff = new Date(Date.now() - hours * 3_600_000);

  const rows = await prisma.$queryRaw<
    { id: string; title: string; url: string; source: string; createdAt: Date; place: string }[]
  >`
    SELECT DISTINCT ON (s."id")
      s."id", s."title", s."url", s."source", s."createdAt", sl."name" AS place
    FROM "Signal" s
    JOIN "SignalLocation" sl ON sl."signalId" = s."id"
    WHERE sl."h3Cell" = ${cell}
      AND s."createdAt" > ${cutoff}
    ORDER BY s."id", s."createdAt" DESC
  `;
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const placeCounts = new Map<string, number>();
  for (const r of rows) placeCounts.set(r.place, (placeCounts.get(r.place) ?? 0) + 1);
  const topPlace = [...placeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    cell,
    topPlace,
    signalCount: rows.length,
    signals: rows.slice(0, 12).map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: r.source,
      place: r.place,
      createdAt: r.createdAt,
    })),
  });
}
