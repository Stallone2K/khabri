import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";

export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "geo");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const hours = Math.min(72, Math.max(1, parseInt(searchParams.get("hours") || "24")));
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10")));

    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    const hotspots = await prisma.$queryRaw<{
      countryCode: string;
      name: string | null;
      signal_count: bigint;
      top_category: string | null;
      dominant_sentiment: string | null;
    }[]>`
      SELECT
        sl."countryCode",
        MIN(l."name") as name,
        COUNT(DISTINCT sl."signalId") as signal_count,
        MODE() WITHIN GROUP (ORDER BY s."category") as top_category,
        MODE() WITHIN GROUP (ORDER BY s."sentiment") as dominant_sentiment
      FROM "SignalLocation" sl
      JOIN "Signal" s ON sl."signalId" = s."id"
      LEFT JOIN "Location" l ON sl."locationId" = l."id" AND l."type" = 'COUNTRY'
      WHERE s."createdAt" >= ${timeThreshold}
        AND sl."countryCode" IS NOT NULL
      GROUP BY sl."countryCode"
      ORDER BY signal_count DESC
      LIMIT ${limit}
    `;

    const data = hotspots.map((h) => ({
      countryCode: h.countryCode,
      name: h.name || h.countryCode,
      signalCount: Number(h.signal_count),
      topCategory: h.top_category,
      dominantSentiment: h.dominant_sentiment,
    }));

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, data);
  } catch (error) {
    console.error("[V1/GEO/HOTSPOTS] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch hotspots", 500, auth);
  }
}
