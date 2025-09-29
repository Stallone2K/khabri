import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
// We update this file to import from the new central location.
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

// --- Handler to GET all sources for the logged-in user ---
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.source.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sources);
}

// --- Handler to ADD a new source ---
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, url } = await request.json();

  if (!name || !url) {
    return NextResponse.json(
      { error: "Name and URL are required" },
      { status: 400 }
    );
  }

  const newSource = await prisma.source.create({
    data: {
      name,
      url,
      type: "RSS", // Currently, we only support adding RSS feeds manually
      userId: session.user.id,
    },
  });

  return NextResponse.json(newSource, { status: 201 });
}

// --- Handler to DELETE a source ---
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json(
      { error: "Source ID is required" },
      { status: 400 }
    );
  }

  // Security check: ensure the user owns this source before deleting
  const source = await prisma.source.findUnique({
    where: { id },
  });

  if (!source || source.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Source not found or access denied" },
      { status: 404 }
    );
  }

  await prisma.source.delete({
    where: { id },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
