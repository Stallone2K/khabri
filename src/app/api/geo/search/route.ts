import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/gemini";
import { buildGeoBriefingPrompt } from "@/lib/prompts";

// Type hierarchy for walking up/down the tree
const TYPE_HIERARCHY = ["CITY", "STATE", "COUNTRY", "REGION"] as const;

interface LocationRecord {
  id: string;
  name: string;
  type: string;
  countryCode: string | null;
  parentId: string | null;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("location");
    const radius = searchParams.get("radius"); // city | state | country | region

    if (!query) {
      return NextResponse.json(
        { error: "Missing 'location' parameter" },
        { status: 400 },
      );
    }

    // =========================================================================
    // 1. RESOLVE QUERY → Location record
    // =========================================================================
    let location: LocationRecord | null = await prisma.location.findFirst({
      where: { name: { equals: query, mode: "insensitive" } },
      select: { id: true, name: true, type: true, countryCode: true, parentId: true },
    });

    // Try alias match if exact name didn't work
    if (!location) {
      const rows = await prisma.$queryRaw<LocationRecord[]>`
        SELECT l."id", l."name", l."type", l."countryCode", l."parentId"
        FROM "Location" l,
        LATERAL unnest(l."aliases") AS alias
        WHERE LOWER(alias) = LOWER(${query})
        LIMIT 1
      `;
      location = rows[0] || null;
    }

    if (!location) {
      return NextResponse.json(
        { error: `Location "${query}" not found` },
        { status: 404 },
      );
    }

    // =========================================================================
    // 2. WALK UP to target radius level
    // =========================================================================
    const targetType = radius?.toUpperCase() || location.type;
    let targetLocation: LocationRecord = location;

    // Walk up the tree until we reach the target type level
    const currentIdx = TYPE_HIERARCHY.indexOf(
      targetLocation.type as (typeof TYPE_HIERARCHY)[number],
    );
    const targetIdx = TYPE_HIERARCHY.indexOf(
      targetType as (typeof TYPE_HIERARCHY)[number],
    );

    if (targetIdx > currentIdx && targetIdx >= 0) {
      let walker: LocationRecord = targetLocation;
      while (
        walker.parentId &&
        TYPE_HIERARCHY.indexOf(
          walker.type as (typeof TYPE_HIERARCHY)[number],
        ) < targetIdx
      ) {
        const parent = await prisma.location.findUnique({
          where: { id: walker.parentId },
          select: { id: true, name: true, type: true, countryCode: true, parentId: true },
        });
        if (!parent) break;
        walker = parent;
      }
      targetLocation = walker;
    }

    // =========================================================================
    // 3. GET ALL DESCENDANT LOCATION IDs (recursive CTE)
    // =========================================================================
    const descendants = await prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM "Location" WHERE id = ${targetLocation.id}
        UNION ALL
        SELECT l.id FROM "Location" l JOIN tree t ON l."parentId" = t.id
      )
      SELECT id FROM tree
    `;
    const locationIds = descendants.map((d) => d.id);

    // =========================================================================
    // 4. QUERY SIGNALS through SignalLocation
    // =========================================================================
    const signals = await prisma.$queryRaw<
      {
        id: string;
        title: string;
        url: string;
        source: string;
        category: string | null;
        sentiment: string | null;
        sentimentScore: number | null;
        publishedAt: Date;
        createdAt: Date;
      }[]
    >`
      SELECT DISTINCT s."id", s."title", s."url", s."source", s."category",
             s."sentiment", s."sentimentScore", s."publishedAt", s."createdAt"
      FROM "Signal" s
      JOIN "SignalLocation" sl ON sl."signalId" = s."id"
      WHERE sl."locationId" = ANY(${locationIds})
      ORDER BY s."createdAt" DESC
      LIMIT 50
    `;

    // =========================================================================
    // 5. BUILD ANCESTOR CHAIN (for context)
    // =========================================================================
    const ancestors: { name: string; type: string; countryCode: string | null }[] = [];
    let current: LocationRecord = location;
    while (current.parentId) {
      const parent = await prisma.location.findUnique({
        where: { id: current.parentId },
        select: { id: true, name: true, type: true, countryCode: true, parentId: true },
      });
      if (!parent) break;
      ancestors.push({
        name: parent.name,
        type: parent.type,
        countryCode: parent.countryCode,
      });
      current = parent;
    }

    // =========================================================================
    // 6. AI BRIEFING (only if we have signals)
    // =========================================================================
    let briefing: string | null = null;
    if (signals.length >= 3) {
      const headlines = signals.slice(0, 30).map((s) => s.title);
      const prompt = buildGeoBriefingPrompt(
        location.name,
        targetType,
        headlines,
      );
      briefing = await generateText("gemini-2.0-flash", prompt, 0.3);
    }

    return NextResponse.json({
      location: {
        id: location.id,
        name: location.name,
        type: location.type,
        countryCode: location.countryCode,
      },
      scope: {
        id: targetLocation.id,
        name: targetLocation.name,
        type: targetLocation.type,
      },
      ancestors,
      signals,
      signalCount: signals.length,
      briefing,
    });
  } catch (error: unknown) {
    console.error("[GEO/SEARCH] Failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Geo search failed", details: message },
      { status: 500 },
    );
  }
}
