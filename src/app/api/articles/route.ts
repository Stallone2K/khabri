import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { logUsage, addRateLimitHeaders } from "@/lib/api-middleware";

export async function GET(req: Request) {
  const startTime = Date.now();
  const auth = await authenticateRequest(req, "signals");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const articles = await prisma.article.findMany({
      where: {
        source: {
          userId: auth.userId,
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

    const response = NextResponse.json(articles);
    if (auth.authMode === "apikey" && auth.keyId) {
      logUsage(auth.keyId, req, 200, Date.now() - startTime).catch(() => {});
      addRateLimitHeaders(response, auth.rateLimit!, auth.remaining!, auth.resetMs!);
    }
    return response;
  } catch (error) {
    console.error("Articles API error:", error);
    if (auth.authMode === "apikey" && auth.keyId) {
      logUsage(auth.keyId, req, 500, Date.now() - startTime).catch(() => {});
    }
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}
