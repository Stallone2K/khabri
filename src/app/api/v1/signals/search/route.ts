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
    const q = searchParams.get("q");
    const entity = searchParams.get("entity");
    const entityType = searchParams.get("entity_type");
    const location = searchParams.get("location");
    const country = searchParams.get("country");

    if (!q && !entity && !location && !country) {
      logV1Usage(auth, req, 400, startTime);
      return v1Error(
        "VALIDATION_ERROR",
        "At least one search parameter required: q, entity, location, or country",
        400,
        auth,
      );
    }

    const where: Record<string, unknown> = {};
    if (q) where.title = { contains: q, mode: "insensitive" };

    // Entity filters
    if (entity || entityType) {
      const entityFilter: Record<string, unknown> = {};
      if (entity) entityFilter.name = { contains: entity, mode: "insensitive" };
      if (entityType) entityFilter.type = entityType;
      where.entities = { some: entityFilter };
    }

    // Location filters
    if (location || country) {
      const locationFilter: Record<string, unknown> = {};
      if (location) locationFilter.name = { contains: location, mode: "insensitive" };
      if (country) locationFilter.countryCode = country.toUpperCase();
      where.locations = { some: locationFilter };
    }

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
    console.error("[V1/SIGNALS/SEARCH] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to search signals", 500, auth);
  }
}
