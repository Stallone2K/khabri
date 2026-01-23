import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import Parser from "rss-parser"; // ✅ Import parser

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Please Log In" },
        { status: 401 },
      );
    }

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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json(); // We only really need the URL now

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 1. Fetch the RSS feed to get the REAL Title
    let finalName = "";
    try {
      const parser = new Parser({
        timeout: 5000,
        headers: { "User-Agent": "Khabri RSS Reader/1.0" },
      });
      const feed = await parser.parseURL(url);

      // Use the feed title, or fallback to hostname if missing
      finalName =
        feed.title?.trim() || new URL(url).hostname.replace("www.", "");
    } catch (parseError) {
      console.warn(
        "Could not fetch RSS title, falling back to hostname",
        parseError,
      );
      try {
        finalName = new URL(url).hostname.replace("www.", "");
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid URL provided" },
          { status: 400 },
        );
      }
    }

    const newSource = await prisma.source.create({
      data: {
        name: finalName, // ✅ Uses the real title from the RSS feed
        url,
        type: "RSS",
        category: "General",
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

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await request.json();

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

// PATCH: Rename a source
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name } = await request.json();

    if (!id || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const updatedSource = await prisma.source.update({
      where: {
        id,
        userId: session.user.id, // Security: ensure user owns this source
      },
      data: { name },
    });

    return NextResponse.json(updatedSource);
  } catch (error) {
    console.error("PATCH Source Error:", error);
    return NextResponse.json(
      { error: "Failed to update source" },
      { status: 500 },
    );
  }
}
