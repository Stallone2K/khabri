import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { countryCode: true, countryName: true },
  });

  return NextResponse.json({
    countryCode: user?.countryCode || null,
    countryName: user?.countryName || null,
  });
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { countryCode, countryName } = await req.json();

  if (!countryCode || typeof countryCode !== "string" || countryCode.length !== 2) {
    return NextResponse.json({ error: "Invalid countryCode" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      countryCode: countryCode.toUpperCase(),
      countryName: countryName || null,
    },
  });

  return NextResponse.json({ success: true, countryCode, countryName });
}
