import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "signals");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { id } = await params;

    const signal = await prisma.signal.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        category: true,
        sentiment: true,
        sentimentScore: true,
        publishedAt: true,
        isEnriched: true,
        enrichedAt: true,
        createdAt: true,
        entities: { select: { name: true, type: true, salience: true } },
        keywords: { select: { keyword: true, weight: true } },
        locations: { select: { name: true, locationType: true, countryCode: true, lat: true, lng: true } },
      },
    });

    if (!signal) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", "Signal not found", 404, auth);
    }

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, signal);
  } catch (error) {
    console.error("[V1/SIGNALS/ID] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch signal", 500, auth);
  }
}
