import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";

// Use a global prisma instance in production to prevent connection limits
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch sources with a count of unread articles
    // Logic: Count articles where the user has NOT marked them as read
    const sources = await prisma.source.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            articles: {
              where: {
                NOT: {
                  userStates: {
                    some: {
                      userId: session.user.id,
                      isRead: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Format the data for the frontend
    const stats = sources.map((source) => ({
      id: source.id,
      name: source.name,
      unreadCount: source._count.articles,
    }));

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching source stats:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
