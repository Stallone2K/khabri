import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai"; // <--- NEW SDK
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TREND_ENGINE_PROMPT } from "@/lib/prompts";

// Initialize Gemini (New SDK)
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

  // Fallback for Terminal Testing
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

      // Deduplicate by URL in DB to avoid massive bloat
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
        pubDate: s.publishedAt, // Map correctly for AI context
      }));
    }

    const signalText = signalsToRank
      .slice(0, 60)
      .map((s) => `- [${s.source}] ${s.title} (Link: ${s.url})`)
      .join("\n");

    // ==========================================
    // STEP 3: AI RANKING (Gemini New SDK)
    // ==========================================
    console.log("🧠 Sending to Gemini (Flash) for Ranking...");

    const finalPrompt = `${TREND_ENGINE_PROMPT}\n\nRAW SIGNALS:\n${signalText}`;

    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }],
        },
      ],
      config: {
        responseMimeType: "application/json", // Force JSON Output
        temperature: 0.2,
      },
    });

    // Extract Text (New SDK structure)
    const responseText =
      response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Clean Markdown wrapping if present (though responseMimeType usually handles this)
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
    // Clean old trends for this user to keep dashboard fresh
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
      trends: rankedTrends,
    });
  } catch (error: any) {
    console.error("🔥 Pipeline Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: String(error?.message || error),
      },
      { status: 500 },
    );
  }
}
