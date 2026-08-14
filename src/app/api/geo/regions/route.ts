import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ZONES_BY_COUNTRY } from "@/lib/regions";

/**
 * GET /api/geo/regions?country=IN
 * States (gazetteer admin1) and zone groupings for the region dropdown.
 * Only states that actually have geo-tagged signals are returned, with counts,
 * so the dropdown never offers empty selections.
 */
export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: "country required (ISO alpha-2)" }, { status: 400 });
  }

  // States with at least one signal mention in the last 30 days
  const rows = await prisma.$queryRaw<
    { admin1Code: string; name: string; signalCount: bigint }[]
  >`
    SELECT st."admin1Code", st."name", COUNT(DISTINCT sl."signalId") AS "signalCount"
    FROM "Location" st
    JOIN "Location" member
      ON member."countryCode" = st."countryCode"
     AND member."admin1Code" = st."admin1Code"
    JOIN "SignalLocation" sl ON sl."locationId" = member."id"
    JOIN "Signal" s ON s."id" = sl."signalId"
    WHERE st."type" = 'STATE'
      AND st."countryCode" = ${country}
      AND s."createdAt" > NOW() - INTERVAL '30 days'
    GROUP BY st."admin1Code", st."name"
    ORDER BY st."name"
  `;

  const states = rows.map((r) => ({
    code: r.admin1Code,
    name: r.name,
    signalCount: Number(r.signalCount),
  }));

  const zones = (ZONES_BY_COUNTRY[country] ?? []).map((z) => ({
    key: z.key,
    label: z.label,
    signalCount: states
      .filter((s) => z.states.includes(s.name))
      .reduce((sum, s) => sum + s.signalCount, 0),
  }));

  return NextResponse.json({ country, states, zones });
}
