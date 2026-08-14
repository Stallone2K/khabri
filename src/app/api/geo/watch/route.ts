import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { coverCells } from "@/lib/geo";

const MIN_RADIUS_KM = 10;
const MAX_RADIUS_KM = 2000;

/** GET /api/geo/watch — list the user's ingestion radii. */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const watches = await prisma.userGeoWatch.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ watches });
}

/** POST /api/geo/watch — create an ingestion radius. */
export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const centerLat = Number(body?.centerLat);
  const centerLng = Number(body?.centerLng);
  const radiusKm = Math.round(Number(body?.radiusKm));
  const label = String(body?.label ?? "").trim() || "Watch";

  if (
    !Number.isFinite(centerLat) || Math.abs(centerLat) > 85 ||
    !Number.isFinite(centerLng) || Math.abs(centerLng) > 180 ||
    !Number.isFinite(radiusKm) || radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM
  ) {
    return NextResponse.json(
      { error: `Invalid center or radius (${MIN_RADIUS_KM}-${MAX_RADIUS_KM} km)` },
      { status: 400 },
    );
  }

  const watch = await prisma.userGeoWatch.create({
    data: {
      userId,
      label: label.slice(0, 60),
      centerLat,
      centerLng,
      radiusKm,
      h3Cells: coverCells(centerLat, centerLng, radiusKm),
      categories: Array.isArray(body?.categories) ? body.categories.slice(0, 20) : [],
    },
  });
  return NextResponse.json({ watch }, { status: 201 });
}

/** DELETE /api/geo/watch?id=... — deactivate a radius. */
export async function DELETE(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const result = await prisma.userGeoWatch.updateMany({
    where: { id, userId },
    data: { isActive: false },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
