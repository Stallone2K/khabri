import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

// --- Helper for AI analysis ---
async function analyzeArticleWithAI(
  articleContent: string,
  articleTitle: string
): Promise<{ summary: string; keywords: string[] }> {
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

// --- Helper for Trend Data ---
async function updateTrendData(
  keywords: string[],
  userId: string,
  prisma: PrismaClient
) {
  if (keywords.length === 0) return;
  const now = new Date();
  const timestamp = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours()
  );
  for (const keyword of keywords) {
    try {
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
    } catch (error) {
      console.error(`Failed to update trend for keyword "${keyword}":`, error);
    }
  }
}

export async function GET(request: Request) {
  // Get headers for logging and authentication
  const authHeader = request.headers.get("authorization");
  const userAgent = request.headers.get("user-agent") || "unknown";
  const origin = request.headers.get("origin") || "unknown";

  // In production, verify the request is authorized
  if (process.env.NODE_ENV === "production") {
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error("❌ Unauthorized ingest attempt", {
        hasAuthHeader: !!authHeader,
        authHeaderMatch: authHeader === expectedAuth,
        userAgent,
        origin,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("📰 Starting RSS Ingestion job...", {
    timestamp: new Date().toISOString(),
    triggeredBy: userAgent,
    environment: process.env.NODE_ENV,
  });

  let articlesAdded = 0;
  const prisma = new PrismaClient();
  const parser = new Parser({
    timeout: 10000, // 10 second timeout for each feed
    headers: {
      "User-Agent": "Khabri RSS Reader/1.0",
    },
  });

  try {
    const sources = await prisma.source.findMany({ where: { type: "RSS" } });
    console.log(`📡 Found ${sources.length} RSS sources to process`);

    if (sources.length === 0) {
      console.log("⚠️ No RSS sources found. Add sources to start ingestion.");
      await prisma.$disconnect();
      return NextResponse.json({
        success: true,
        articlesAdded: 0,
        message: "No RSS sources configured",
        timestamp: new Date().toISOString(),
      });
    }

    for (const source of sources) {
      try {
        console.log(`🔄 Processing feed: ${source.name} (${source.url})`);
        const feed = await parser.parseURL(source.url);

        let sourceArticlesAdded = 0;

        for (const item of feed.items) {
          if (!item.guid || !item.link || !item.title || !item.isoDate) {
            console.log(`⚠️ Skipping incomplete item from ${source.name}`);
            continue;
          }

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
            sourceArticlesAdded++;
            console.log(`  ✅ Added: "${item.title.substring(0, 60)}..."`);

            // Analyze article with AI
            const analysisResult = await analyzeArticleWithAI(
              item.contentSnippet || item.content || "",
              item.title
            );

            await prisma.articleAnalysis.create({
              data: { articleId: newArticle.id, ...analysisResult },
            });

            // Update trend data
            await updateTrendData(
              analysisResult.keywords,
              source.userId,
              prisma
            );
          }
        }

        // Update last fetched timestamp
        await prisma.source.update({
          where: { id: source.id },
          data: { lastFetched: new Date() },
        });

        console.log(
          `  ✅ ${source.name}: Added ${sourceArticlesAdded} new articles`
        );
      } catch (feedError: any) {
        console.error(
          `  ❌ Failed to process ${source.name} (${source.url}):`,
          feedError.message
        );
        // Continue with next source even if one fails
      }
    }

    await prisma.$disconnect();

    const successMessage =
      articlesAdded > 0
        ? `Successfully ingested ${articlesAdded} new articles`
        : "No new articles found";

    console.log(`✅ RSS job finished: ${successMessage}`);

    return NextResponse.json({
      success: true,
      articlesAdded,
      message: successMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ CRITICAL ERROR IN INGESTION JOB:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting Prisma:", disconnectError);
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
