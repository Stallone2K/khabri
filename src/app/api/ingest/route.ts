import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅ Uses the shared connection
import { PrismaClient } from "@prisma/client"; // Only needed for type definitions
import Parser from "rss-parser";

// --- Helper for AI analysis ---
async function analyzeArticleWithAI(
  articleContent: string,
  articleTitle: string,
): Promise<{ summary: string; keywords: string[] }> {
  // ... (Keep existing AI logic, omitted for brevity, it is fine) ...
  // Returning dummy data if you don't have the AI function handy in your copy-paste:
  // Remove this dummy return if you keep your original helper function.
  const prompt = `Analyze the following article content. 1. Provide a concise, one-paragraph summary. 2. Extract the 5 most important keywords or topics as a JavaScript array of strings. Your response MUST be a valid JSON object with the keys "summary" and "keywords". Article Content: --- ${articleContent.substring(0, 8000)} ---`;

  try {
    if (!process.env.GEMINI_API_KEY)
      return { summary: "No API Key", keywords: [] };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const result = await response.json();
    const text = result.candidates[0].content.parts[0].text;
    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    console.error("AI Analysis failed", e);
    return { summary: "Analysis Failed", keywords: [] };
  }
}

// --- Helper for Trend Data ---
async function updateTrendData(
  keywords: string[],
  userId: string,
  prismaClient: PrismaClient,
) {
  if (keywords.length === 0) return;
  const now = new Date();
  const timestamp = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
  );
  for (const keyword of keywords) {
    try {
      await prismaClient.trendDataPoint.upsert({
        where: {
          keyword_timestamp_userId: {
            keyword: keyword.toLowerCase(),
            timestamp,
            userId,
          },
        },
        update: { count: { increment: 1 } },
        create: { keyword: keyword.toLowerCase(), timestamp, count: 1, userId },
      });
    } catch (error) {
      console.error(`Failed to update trend for keyword "${keyword}":`, error);
    }
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.NODE_ENV === "production") {
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let articlesAdded = 0;
  // REMOVED: const prisma = new PrismaClient();  <-- THIS WAS THE PROBLEM
  const parser = new Parser({
    timeout: 10000,
    headers: { "User-Agent": "Khabri RSS Reader/1.0" },
  });

  try {
    const sources = await prisma.source.findMany({ where: { type: "RSS" } });

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        articlesAdded: 0,
        message: "No RSS sources configured",
      });
    }

    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url);
        for (const item of feed.items) {
          if (!item.guid || !item.link || !item.title || !item.isoDate)
            continue;

          const existingArticle = await prisma.article.findUnique({
            where: { guid: item.guid },
          });

          if (!existingArticle) {
            const newArticle = await prisma.article.create({
              data: {
                sourceId: source.id,
                title: item.title,
                link: item.link,
                guid: item.guid,
                publishedDate: new Date(item.isoDate),
                content: item.content || "",
                cleanedContent: item.contentSnippet || "",
              },
            });
            articlesAdded++;

            const analysisResult = await analyzeArticleWithAI(
              item.contentSnippet || item.content || "",
              item.title,
            );
            await prisma.articleAnalysis.create({
              data: { articleId: newArticle.id, ...analysisResult },
            });
            await updateTrendData(
              analysisResult.keywords,
              source.userId,
              prisma,
            );
          }
        }
        await prisma.source.update({
          where: { id: source.id },
          data: { lastFetched: new Date() },
        });
      } catch (feedError: any) {
        console.error(`Failed to process ${source.name}:`, feedError.message);
      }
    }

    // REMOVED: await prisma.$disconnect(); <-- DO NOT DISCONNECT THE SHARED INSTANCE

    return NextResponse.json({
      success: true,
      articlesAdded,
      message: `Ingested ${articlesAdded} articles`,
    });
  } catch (error: any) {
    console.error("Ingestion Error:", error);
    // REMOVED: await prisma.$disconnect();
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 },
    );
  }
}
