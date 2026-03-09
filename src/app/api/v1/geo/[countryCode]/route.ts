import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/gemini";
import { buildGeoBriefingPrompt } from "@/lib/prompts";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ countryCode: string }> },
) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "geo");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { countryCode } = await params;
    const code = countryCode.toUpperCase();
    const { searchParams } = new URL(req.url);
    const hours = Math.min(72, Math.max(1, parseInt(searchParams.get("hours") || "24")));

    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Find country location
    const country = await prisma.location.findFirst({
      where: { countryCode: code, type: "COUNTRY" },
      select: { id: true, name: true, countryCode: true },
    });

    const countryName = country?.name || code;

    // Get signals for this country
    const signals = await prisma.$queryRaw<{
      id: string; title: string; url: string; source: string;
      category: string | null; sentiment: string | null;
      sentimentScore: number | null; publishedAt: Date; createdAt: Date;
    }[]>`
      SELECT DISTINCT s."id", s."title", s."url", s."source", s."category",
             s."sentiment", s."sentimentScore", s."publishedAt", s."createdAt"
      FROM "Signal" s
      JOIN "SignalLocation" sl ON sl."signalId" = s."id"
      WHERE sl."countryCode" = ${code}
        AND s."createdAt" >= ${timeThreshold}
      ORDER BY s."createdAt" DESC
      LIMIT 50
    `;

    // Category + sentiment breakdown
    const [categories, sentiments] = await Promise.all([
      prisma.$queryRaw<{ category: string; count: bigint }[]>`
        SELECT s."category", COUNT(DISTINCT s."id") as count
        FROM "Signal" s
        JOIN "SignalLocation" sl ON sl."signalId" = s."id"
        WHERE sl."countryCode" = ${code}
          AND s."createdAt" >= ${timeThreshold}
          AND s."category" IS NOT NULL
        GROUP BY s."category"
        ORDER BY count DESC
      `,
      prisma.$queryRaw<{ sentiment: string; count: bigint }[]>`
        SELECT s."sentiment", COUNT(DISTINCT s."id") as count
        FROM "Signal" s
        JOIN "SignalLocation" sl ON sl."signalId" = s."id"
        WHERE sl."countryCode" = ${code}
          AND s."createdAt" >= ${timeThreshold}
          AND s."sentiment" IS NOT NULL
        GROUP BY s."sentiment"
        ORDER BY count DESC
      `,
    ]);

    const categoryMap: Record<string, number> = {};
    for (const c of categories) categoryMap[c.category] = Number(c.count);

    const sentimentMap: Record<string, number> = {};
    for (const s of sentiments) sentimentMap[s.sentiment] = Number(s.count);

    // AI briefing
    let briefing: string | null = null;
    if (signals.length >= 3) {
      const headlines = signals.slice(0, 30).map((s) => s.title);
      const prompt = buildGeoBriefingPrompt(countryName, "COUNTRY", headlines);
      briefing = await generateText("gemini-2.0-flash", prompt, 0.3);
    }

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, {
      country: { code, name: countryName },
      signalCount: signals.length,
      signals,
      categories: categoryMap,
      sentimentBreakdown: sentimentMap,
      briefing,
    });
  } catch (error) {
    console.error("[V1/GEO/COUNTRY] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch country intelligence", 500, auth);
  }
}
