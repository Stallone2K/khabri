import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

// --- Helper for AI analysis (unchanged) ---
async function analyzeArticleWithAI(
  articleContent: string,
  articleTitle: string
): Promise<{ summary: string; keywords: string[] }> {
  // ... (code is unchanged)
  const prompt = `Analyze the following article content. 1. Provide a concise, one-paragraph summary. 2. Extract the 5 most important keywords or topics as a JavaScript array of strings. Your response MUST be a valid JSON object with the keys "summary" and "keywords". Article Content: --- ${articleContent.substring(
    0,
    8000
  )} ---`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Gemini API request failed with status ${response.status}: ${errorBody}`
      );
      throw new Error(
        `Gemini API request failed with status ${response.status}`
      );
    }
    const result = await response.json();
    const text = result.candidates[0].content.parts[0].text;
    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error(`  -> ❌ AI analysis failed for "${articleTitle}":`, error);
    return { summary: "AI analysis failed.", keywords: [] };
  }
}

// --- Helper for Trend Data (UPDATED to accept userId) ---
async function updateTrendData(keywords: string[], userId: string) {
  if (keywords.length === 0) return;
  const prisma = new PrismaClient();
  const now = new Date();
  const timestamp = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours()
  );
  for (const keyword of keywords) {
    await prisma.trendDataPoint.upsert({
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
  }
}

export async function GET(request: Request) {
  // ... (Security checks are unchanged)
  if (process.env.NODE_ENV !== "development") {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("📰 Starting RSS Ingestion job...");
  let articlesAdded = 0;
  const prisma = new PrismaClient();
  const parser = new Parser();

  try {
    const sources = await prisma.source.findMany({ where: { type: "RSS" } });
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
              item.title
            );
            await prisma.articleAnalysis.create({
              data: { articleId: newArticle.id, ...analysisResult },
            });
            // We now pass the user's ID when updating trends
            await updateTrendData(analysisResult.keywords, source.userId);
          }
        }
        await prisma.source.update({
          where: { id: source.id },
          data: { lastFetched: new Date() },
        });
      } catch (feedError: any) {
        console.error(
          `❌ Failed to process feed for ${source.name} (${source.url}). Error: ${feedError.message}`
        );
      }
    }
    console.log(`✅ RSS job finished. Ingested ${articlesAdded} new articles.`);
    return NextResponse.json({ success: true, articlesAdded });
  } catch (error: any) {
    console.error("A CRITICAL ERROR OCCURRED IN THE INGESTION JOB", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
