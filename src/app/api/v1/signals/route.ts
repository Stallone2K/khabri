import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
  parsePagination,
} from "@/lib/api-v1";

export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "signals");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip } = parsePagination(searchParams);
    const category = searchParams.get("category");
    const sentiment = searchParams.get("sentiment");
    const source = searchParams.get("source");
    const since = searchParams.get("since");
    const enriched = searchParams.get("enriched");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (sentiment) where.sentiment = sentiment;
    if (source) where.source = { contains: source, mode: "insensitive" };
    if (since) where.publishedAt = { gte: new Date(since) };
    if (enriched !== null && enriched !== undefined) where.isEnriched = enriched === "true";

    const [signals, total] = await Promise.all([
      prisma.signal.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take: pageSize,
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
          createdAt: true,
          entities: { select: { name: true, type: true, salience: true } },
          keywords: { select: { keyword: true, weight: true } },
          locations: { select: { name: true, locationType: true, countryCode: true, lat: true, lng: true } },
        },
      }),
      prisma.signal.count({ where }),
    ]);

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, signals, { total, page, pageSize });
  } catch (error) {
    console.error("[V1/SIGNALS] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch signals", 500, auth);
  }
}
