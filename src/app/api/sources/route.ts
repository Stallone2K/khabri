import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma"; // ✅ IMPORT SHARED INSTANCE
import { authOptions } from "@/lib/auth";

// GET: Fetch all sources
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // 1. Check Auth
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Please Log In" },
        { status: 401 },
      );
    }

    // 2. Fetch Data
    const sources = await prisma.source.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sources);
  } catch (error) {
    console.error("GET Source Error:", error);
    return NextResponse.json(
      { error: "Database Connection Failed" },
      { status: 500 },
    );
  }
}

// POST: Add a source
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, url } = await request.json();

    if (!name || !url) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const newSource = await prisma.source.create({
      data: {
        name,
        url,
        type: "RSS",
        userId: session.user.id,
      },
    });

    return NextResponse.json(newSource, { status: 201 });
  } catch (error) {
    console.error("POST Source Error:", error);
    return NextResponse.json(
      { error: "Failed to create source" },
      { status: 500 },
    );
  }
}

// DELETE: Remove a source
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await request.json();

    // Verify ownership before deleting
    const count = await prisma.source.count({
      where: { id, userId: session.user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    await prisma.source.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
