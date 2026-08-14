import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/geo/anomalies
 * Active COUNTRY-dimension anomalies with gazetteer centroids — the globe's
 * orange pulse layer. (Keyword/entity anomalies have no coordinates.)
 */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw<
    {
      id: string;
      key: string;
      label: string;
      severity: string;
      zScore: number;
      currentValue: number;
      lat: number | null;
      lng: number | null;
    }[]
  >`
    SELECT a."id", a."key", a."label", a."severity", a."zScore", a."currentValue",
           l."lat", l."lng"
    FROM "AnomalyEvent" a
    LEFT JOIN "Location" l
      ON l."countryCode" = a."key" AND l."type" = 'COUNTRY'
    WHERE a."type" = 'COUNTRY'
      AND a."isResolved" = false
    ORDER BY a."zScore" DESC
    LIMIT 100
  `;

  const features = rows
    .filter((r) => r.lat !== null && r.lng !== null)
    .map((r) => ({
      type: "Feature" as const,
      properties: {
        id: r.id,
        label: r.label,
        severity: r.severity,
        zScore: Math.round(r.zScore * 10) / 10,
        count: r.currentValue,
      },
      geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
    }));

  return NextResponse.json({ type: "FeatureCollection", features });
}
