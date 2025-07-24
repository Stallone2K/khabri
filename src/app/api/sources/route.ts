import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

async function getFeedTitle(url: string): Promise<string> {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch (error) {
    console.error("Failed To Parse Feed URL:", error);
    return "Untitled Feed";
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const sources = await prisma.source.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(sources);
  } catch (error) {
    console.error("Failed To Retrieve Sources:", error);
    return NextResponse.json(
      { error: "Failed To Retrieve Sources" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { url, type } = await request.json();

    if (!url || !type) {
      return NextResponse.json(
        { error: "URL And Type Are Required" },
        { status: 400 }
      );
    }

    if (type !== "RSS") {
      return NextResponse.json(
        { error: "Currently, Only RSS Sources Are Supported." },
        { status: 400 }
      );
    }

    const existingSource = await prisma.source.findFirst({
      where: {
        userId: userId,
        url: url,
      },
    });

    if (existingSource) {
      return NextResponse.json(
        { error: "You Have Already Added This Source." },
        { status: 409 }
      );
    }

    const name = await getFeedTitle(url);

    const newSource = await prisma.source.create({
      data: {
        userId: userId,
        url: url,
        type: type, // e.g., 'RSS'
        name: name,
      },
    });
    return NextResponse.json(newSource, { status: 201 });
  } catch (error) {
    console.error("Failed To Create Source:", error);
    return NextResponse.json(
      { error: "Failed To Create Source" },
      { status: 500 }
    );
  }
}
