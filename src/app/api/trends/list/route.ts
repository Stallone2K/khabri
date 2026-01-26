import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  // Dev Mode Fallback
  let userId = session?.user?.id;
  if (!userId) {
    const firstUser = await prisma.user.findFirst();
    userId = firstUser?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Optimized Query: Excludes 'reason' as requested
    const trends = await prisma.rankedTrend.findMany({
      where: { userId: userId },
      orderBy: { rank: "asc" },
      take: 15,
      select: {
        id: true,
        rank: true,
        topic: true,
        score: true,
        originalUrl: true,
        createdAt: true, // Added date for context
      },
    });

    return NextResponse.json(trends);
  } catch (error) {
    console.error("Failed to fetch trends", error);
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }
}
