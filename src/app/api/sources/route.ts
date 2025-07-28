import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

// GET handler (no changes)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sources = await prisma.source.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sources);
}

// POST handler (no changes)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { url, type } = await request.json();
  if (!url || !type) {
    return NextResponse.json(
      { error: "URL and type are required" },
      { status: 400 }
    );
  }
  const existingSource = await prisma.source.findFirst({
    where: { userId: session.user.id, url: url },
  });
  if (existingSource) {
    return NextResponse.json(
      { error: "You have already added this source." },
      { status: 409 }
    );
  }
  // A real app would use a proper RSS parser to get the title
  const name = new URL(url).hostname;
  const newSource = await prisma.source.create({
    data: { userId: session.user.id, url, type, name },
  });
  return NextResponse.json(newSource, { status: 201 });
}

// ✨ NEW: DELETE handler
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Source ID is required" },
      { status: 400 }
    );
  }

  try {
    // Verify the source belongs to the current user before deleting
    const source = await prisma.source.findFirst({
      where: { id: id, userId: session.user.id },
    });

    if (!source) {
      return NextResponse.json(
        {
          error: "Source not found or you do not have permission to delete it.",
        },
        { status: 404 }
      );
    }

    await prisma.source.delete({
      where: { id: id },
    });

    return NextResponse.json(
      { message: "Source deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete source:", error);
    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}
