import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma"; // ✅ Use Shared Instance
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const articles = await prisma.article.findMany({
    where: {
      source: {
        userId: session.user.id,
      },
    },
    orderBy: {
      publishedDate: "desc",
    },
    take: 50,
    include: {
      analysis: true,
      source: true,
    },
  });

  return NextResponse.json(articles);
}
