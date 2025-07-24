import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

// This function handles GET requests to /api/articles
export async function GET() {
  // First, get the user's session to make sure they are logged in
  const session = await getServerSession(authOptions);

  // If there's no session or user ID, deny access
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Find all the source IDs that belong to the current user
    const userSources = await prisma.source.findMany({
      where: { userId: userId },
      select: { id: true }, // We only need the IDs for the next query
    });

    // If the user hasn't added any sources, return an empty list right away
    if (userSources.length === 0) {
      return NextResponse.json([]);
    }

    // Create a list of just the source IDs
    const sourceIds = userSources.map((source) => source.id);

    // Now, find all articles where the sourceId is in our user's list of sourceIds
    const articles = await prisma.article.findMany({
      where: {
        sourceId: {
          in: sourceIds,
        },
      },
      // Order the articles by published date, newest first
      orderBy: {
        publishedDate: "desc",
      },
      // Limit to the most recent 100 articles to keep it fast
      take: 100,
      // Also include the name of the source and the AI analysis for each article
      include: {
        source: {
          select: { name: true },
        },
        analysis: true,
      },
    });

    // Return the list of articles as a JSON response
    return NextResponse.json(articles);
  } catch (error) {
    console.error("Failed To Retrieve Articles:", error);
    return NextResponse.json(
      { error: "Failed To Retrieve Articles" },
      { status: 500 }
    );
  }
}
