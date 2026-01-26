import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TREND_ENGINE_PROMPT } from "@/lib/prompts";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// The Hardcoded Feeds from your Python Script
const EARLY_SIGNAL_FEEDS = [
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
  // 1. Auth Check (RankedTrend needs a userId)
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parser = new Parser();
    let newSignalsCount = 0;

    // ==========================================
    // STEP 1: INGEST SIGNALS (Python: fetch_early_signals)
    // ==========================================
    const fetchedSignals = [];

    // Fetch all feeds in parallel
    const feedPromises = EARLY_SIGNAL_FEEDS.map(async (feedInfo) => {
      try {
        const feed = await parser.parseURL(feedInfo.url);
        // Take top 10 from each, just like Python script
        return feed.items.slice(0, 10).map((item) => ({
          title: item.title || "No Title",
          url: item.link || "",
          source: feedInfo.source,
          pubDate: item.isoDate ? new Date(item.isoDate) : new Date(),
        }));
      } catch (e) {
        console.error(`Failed to parse ${feedInfo.source}`, e);
        return [];
      }
    });

    const results = await Promise.all(feedPromises);
    const flatSignals = results.flat();

    // Deduplicate and Save to DB
    for (const s of flatSignals) {
      if (!s.url) continue;

      // Check if exists
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

    // ==========================================
    // STEP 2: RANK TRENDS (Python: rank_signals)
    // ==========================================

    // If we have no new signals, maybe fetch recent ones from DB for ranking
    // so the dashboard always shows something.
    let signalsToRank = fetchedSignals;
    if (signalsToRank.length < 5) {
      const recentDbSignals = await prisma.signal.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      // Map DB shape to simple shape
      signalsToRank = recentDbSignals.map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source,
        pubDate: s.publishedAt,
      }));
    }

    // Limit context window for Gemini
    const signalText = signalsToRank
      .slice(0, 60)
      .map((s) => `- [${s.source}] ${s.title} (Link: ${s.url})`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const finalPrompt = `${TREND_ENGINE_PROMPT}\n\nRAW SIGNALS:\n${signalText}`;

    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();

    // Clean JSON (Python: safe_json_loads)
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    let rankedTrends = [];

    try {
      rankedTrends = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse Gemini JSON", e);
      return NextResponse.json(
        { error: "AI Parsing Failed", raw: responseText },
        { status: 500 },
      );
    }

    // ==========================================
    // STEP 3: SAVE TRENDS (Python: save_json)
    // ==========================================

    // Clear old trends for this user (optional: strictly show latest)
    // await prisma.rankedTrend.deleteMany({ where: { userId: session.user.id } });

    if (Array.isArray(rankedTrends)) {
      for (const trend of rankedTrends) {
        await prisma.rankedTrend.create({
          data: {
            rank: trend.rank || 99,
            topic: trend.topic || "Unknown",
            score: trend.score || 0,
            reason: trend.reason || "",
            originalUrl: trend.original_url || null,
            userId: session.user.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      signalsIngested: newSignalsCount,
      trendsCount: rankedTrends.length,
    });
  } catch (error) {
    console.error("Pipeline Failed:", error);
    return NextResponse.json({ error: "Pipeline Failed" }, { status: 500 });
  }
}
