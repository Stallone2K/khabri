import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cellToLatLng } from "h3-js";

const WINDOWS: Record<string, number> = { "24h": 24, "3d": 72, "7d": 168, "30d": 720 };

/**
 * GET /api/geo/heat?window=7d
 * Signal density per H3 res-5 cell as GeoJSON points — the globe heat layer.
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const hours = WINDOWS[searchParams.get("window") ?? "7d"] ?? 168;
  const cutoff = new Date(Date.now() - hours * 3_600_000);

  const rows = await prisma.$queryRaw<{ cell: string; count: bigint }[]>`
    SELECT sl."h3Cell" AS cell, COUNT(DISTINCT sl."signalId") AS count
    FROM "SignalLocation" sl
    JOIN "Signal" s ON s."id" = sl."signalId"
    WHERE sl."h3Cell" IS NOT NULL
      AND s."createdAt" > ${cutoff}
    GROUP BY sl."h3Cell"
  `;

  let maxCount = 0;
  const features = rows.map((r) => {
    const count = Number(r.count);
    if (count > maxCount) maxCount = count;
    const [lat, lng] = cellToLatLng(r.cell);
    return {
      type: "Feature" as const,
      properties: { cell: r.cell, count },
      geometry: { type: "Point" as const, coordinates: [lng, lat] },
    };
  });

  return NextResponse.json({
    type: "FeatureCollection",
    features,
    properties: { maxCount, cells: rows.length, windowHours: hours },
  });
}
