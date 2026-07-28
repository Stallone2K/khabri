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

const TYPE_HIERARCHY = ["CITY", "STATE", "COUNTRY", "REGION"] as const;

interface LocationRecord {
  id: string;
  name: string;
  type: string;
  countryCode: string | null;
  parentId: string | null;
}

export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "geo");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("location");
    const radius = searchParams.get("radius");

    if (!query) {
      logV1Usage(auth, req, 400, startTime);
      return v1Error("VALIDATION_ERROR", "Missing 'location' parameter", 400, auth);
    }

    // 1. Resolve location
    let location: LocationRecord | null = await prisma.location.findFirst({
      where: { name: { equals: query, mode: "insensitive" } },
      select: { id: true, name: true, type: true, countryCode: true, parentId: true },
    });

    if (!location) {
      const rows = await prisma.$queryRaw<LocationRecord[]>`
        SELECT l."id", l."name", l."type", l."countryCode", l."parentId"
        FROM "Location" l, LATERAL unnest(l."aliases") AS alias
        WHERE LOWER(alias) = LOWER(${query})
        LIMIT 1
      `;
      location = rows[0] || null;
    }

    if (!location) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", `Location "${query}" not found`, 404, auth);
    }

    // 2. Walk up to target radius
    const targetType = radius?.toUpperCase() || location.type;
    let targetLocation: LocationRecord = location;

    const currentIdx = TYPE_HIERARCHY.indexOf(targetLocation.type as (typeof TYPE_HIERARCHY)[number]);
    const targetIdx = TYPE_HIERARCHY.indexOf(targetType as (typeof TYPE_HIERARCHY)[number]);

    if (targetIdx > currentIdx && targetIdx >= 0) {
      let walker: LocationRecord = targetLocation;
      while (walker.parentId && TYPE_HIERARCHY.indexOf(walker.type as (typeof TYPE_HIERARCHY)[number]) < targetIdx) {
        const parent = await prisma.location.findUnique({
          where: { id: walker.parentId },
          select: { id: true, name: true, type: true, countryCode: true, parentId: true },
        });
        if (!parent) break;
        walker = parent;
      }
      targetLocation = walker;
    }

    // 3. Get descendant IDs
    const descendants = await prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM "Location" WHERE id = ${targetLocation.id}
        UNION ALL
        SELECT l.id FROM "Location" l JOIN tree t ON l."parentId" = t.id
      )
      SELECT id FROM tree
    `;
    const locationIds = descendants.map((d) => d.id);

    // 4. Query signals
    const signals = await prisma.$queryRaw<{
      id: string; title: string; url: string; source: string;
      category: string | null; sentiment: string | null;
      sentimentScore: number | null; publishedAt: Date; createdAt: Date;
    }[]>`
      SELECT DISTINCT s."id", s."title", s."url", s."source", s."category",
             s."sentiment", s."sentimentScore", s."publishedAt", s."createdAt"
      FROM "Signal" s
      JOIN "SignalLocation" sl ON sl."signalId" = s."id"
      WHERE sl."locationId" = ANY(${locationIds})
      ORDER BY s."createdAt" DESC
      LIMIT 50
    `;

    // 5. Ancestor chain
    const ancestors: { name: string; type: string; countryCode: string | null }[] = [];
    let current: LocationRecord = location;
    while (current.parentId) {
      const parent = await prisma.location.findUnique({
        where: { id: current.parentId },
        select: { id: true, name: true, type: true, countryCode: true, parentId: true },
      });
      if (!parent) break;
      ancestors.push({ name: parent.name, type: parent.type, countryCode: parent.countryCode });
      current = parent;
    }

    // 6. AI briefing
    let briefing: string | null = null;
    if (signals.length >= 3) {
      const headlines = signals.slice(0, 30).map((s) => s.title);
      const prompt = buildGeoBriefingPrompt(location.name, targetType, headlines);
      briefing = await generateText("gemini-flash-latest", prompt, 0.3);
    }

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, {
      location: { id: location.id, name: location.name, type: location.type, countryCode: location.countryCode },
      scope: { id: targetLocation.id, name: targetLocation.name, type: targetLocation.type },
      ancestors,
      signals,
      signalCount: signals.length,
      briefing,
    });
  } catch (error) {
    console.error("[V1/GEO/SEARCH] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Geo search failed", 500, auth);
  }
}
