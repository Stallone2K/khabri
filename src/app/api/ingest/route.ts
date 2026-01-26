import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TREND_ENGINE_PROMPT } from "@/lib/prompts";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const FEED_SOURCES = [
  { url: "https://www.reddit.com/r/india/rising/.rss", source: "r/India" },
  { url: "https://www.reddit.com/r/worldnews/rising/.rss", source: "r/World" },
  { url: "https://www.reddit.com/r/politics/rising/.rss", source: "r/Pol" },
  {
    url: "https://www.reddit.com/r/GeopoliticsIndia/rising/.rss",
    source: "r/GeoInd",
  },
  {
    url: "https://news.google.com/rss/search?q=politics+when:12h&hl=en-IN&gl=IN&ceid=IN:en",
    source: "GN Pol",
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en",
    source: "GN Nation",
  },
];

export async function POST(req: Request) {
  // ---------------------------------------------------------
  // 1. AUTHENTICATION (Dev Mode Friendly)
  // ---------------------------------------------------------
  const session = await getServerSession(authOptions);
  let userId = session?.user?.id;

  // Fallback for Terminal Testing (curl)
  if (!userId) {
    console.log("⚠️ No session found. Attempting to use fallback user...");
    const firstUser = await prisma.user.findFirst();
    if (firstUser) {
      userId = firstUser.id;
      console.log(`✅ Using Fallback User: ${firstUser.email} (${userId})`);
    } else {
      return NextResponse.json(
        { error: "Unauthorized & No Fallback User Found" },
        { status: 401 },
      );
    }
  }

  const parser = new Parser();
  let newSignalsCount = 0;
  const fetchedSignals: any[] = [];

  try {
    // ==========================================
    // STEP 1: FETCH & INGEST SIGNALS
    // ==========================================
    console.log("📡 Starting Signal Ingest...");

    const feedPromises = FEED_SOURCES.map(async (feedInfo) => {
      try {
        const feed = await parser.parseURL(feedInfo.url);
        return feed.items.slice(0, 10).map((item) => ({
          title: item.title?.trim() || "No Title",
          url: item.link || "",
          source: feedInfo.source,
          pubDate: item.isoDate ? new Date(item.isoDate) : new Date(),
        }));
      } catch (e) {
        console.error(`❌ Failed to parse ${feedInfo.source}:`, e);
        return [];
      }
    });

    const results = await Promise.all(feedPromises);
    const flatSignals = results.flat();

    for (const s of flatSignals) {
      if (!s.url) continue;

      const exists = await prisma.signal.findUnique({
        where: { url: s.url },
      });

      if (!exists) {
        await prisma.signal.create({
          data: {
            title: s.title,
            url: s.url,
            source: s.source,
            publishedAt: s.pubDate,
          },
        });
        newSignalsCount++;
        fetchedSignals.push(s);
      }
    }
    console.log(`✅ Ingested ${newSignalsCount} new signals.`);

    // ==========================================
    // STEP 2: PREPARE DATA FOR RANKING
    // ==========================================
    let signalsToRank = fetchedSignals;

    // If few new signals (e.g. re-run), fetch recent ones from DB so AI has something to rank
    if (signalsToRank.length < 10) {
      console.log(
        "📉 Few new signals. Fetching recent signals from DB for context...",
      );
      const recentDbSignals = await prisma.signal.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
      });
      signalsToRank = recentDbSignals.map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source,
      }));
    }

    const signalText = signalsToRank
      .slice(0, 60)
      .map((s) => `- [${s.source}] ${s.title} (Link: ${s.url})`)
      .join("\n");

    // ==========================================
    // STEP 3: AI RANKING (Gemini)
    // ==========================================
    console.log("🧠 Sending to Gemini (Flash) for Ranking...");

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const finalPrompt = `${TREND_ENGINE_PROMPT}\n\nRAW SIGNALS:\n${signalText}`;

    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();

    const jsonString = responseText.replace(/```json|```/g, "").trim();
    let rankedTrends = [];

    try {
      rankedTrends = JSON.parse(jsonString);
    } catch (e) {
      console.error("❌ Failed to parse Gemini JSON response:", responseText);
      return NextResponse.json(
        { error: "AI Parsing Failed", raw: responseText },
        { status: 500 },
      );
    }

    // ==========================================
    // STEP 4: SAVE RANKED TRENDS
    // ==========================================
    // Optional: Delete old trends for this user to keep dashboard fresh
    await prisma.rankedTrend.deleteMany({ where: { userId: userId! } });

    if (Array.isArray(rankedTrends)) {
      await Promise.all(
        rankedTrends.map((trend) =>
          prisma.rankedTrend.create({
            data: {
              rank: trend.rank || 99,
              topic: trend.topic || "Unknown",
              score: trend.score || 0,
              reason: trend.reason || "",
              originalUrl: trend.original_url || null,
              userId: userId!,
            },
          }),
        ),
      );
    }

    return NextResponse.json({
      success: true,
      signalsIngested: newSignalsCount,
      trendsGenerated: rankedTrends.length,
      trends: rankedTrends, // Returning trends so you can see them in terminal immediately
    });
  } catch (error) {
    console.error("🔥 Pipeline Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 },
    );
  }
}
