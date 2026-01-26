import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Common English stop words to ignore in keyword search
const STOP_WORDS = new Set([
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  // Dev Mode Fallback
  let userId = session?.user?.id;
  if (!userId) {
    const firstUser = await prisma.user.findFirst();
    userId = firstUser?.id;
  }

  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Parse 'hours' from query param (Default: 24)
    const { searchParams } = new URL(req.url);
    const hoursParam = parseInt(searchParams.get("hours") || "24");
    // Limit to reasonable range (1 to 48 hours) to prevent abuse
    const hours = Math.max(1, Math.min(hoursParam, 48));

    // 2. Get Top 5 Trends
    const topTrends = await prisma.rankedTrend.findMany({
      where: { userId },
      orderBy: { rank: "asc" },
      take: 5,
      select: { id: true, topic: true, rank: true, originalUrl: true },
    });

    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // 3. Initialize buckets based on 'hours'
    const chartData = Array.from({ length: hours }, (_, i) => {
      const d = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      return {
        time: d.getHours() + ":00",
        timestamp: d.getTime(),
        ...topTrends.reduce(
          (acc, t) => ({ ...acc, [`trend_${t.rank}`]: 0 }),
          {},
        ),
      };
    });

    // 4. Populate Data
    for (const trend of topTrends) {
      const rawWords = trend.topic.toLowerCase().split(/[^a-z0-9]+/);
      const keywords = rawWords.filter(
        (w) => w.length > 1 && !STOP_WORDS.has(w),
      );

      const searchConditions: any[] = [];

      if (keywords.length > 0) {
        searchConditions.push(
          ...keywords.map((word) => ({
            title: { contains: word, mode: "insensitive" },
          })),
        );
      }
      if (trend.originalUrl) {
        searchConditions.push({ url: trend.originalUrl });
      }

      if (searchConditions.length === 0) continue;

      const matchingSignals = await prisma.signal.findMany({
        where: {
          OR: [
            { publishedAt: { gte: startTime } },
            { createdAt: { gte: startTime } },
          ],
          AND: [{ OR: searchConditions }],
        },
        select: { publishedAt: true, createdAt: true, url: true },
      });

      const processedSignalIds = new Set();

      matchingSignals.forEach((sig) => {
        if (processedSignalIds.has(sig.url)) return;
        processedSignalIds.add(sig.url);

        const dateToUse =
          sig.publishedAt > startTime ? sig.publishedAt : sig.createdAt;
        const sigTime = new Date(dateToUse).getTime();

        // Calculate hour index based on dynamic 'hours'
        const hourIndex = Math.floor(
          (sigTime - startTime.getTime()) / (60 * 60 * 1000),
        );

        if (hourIndex >= 0 && hourIndex < hours) {
          // @ts-ignore
          chartData[hourIndex][`trend_${trend.rank}`] += 1;
        }
      });
    }

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("Graph API Error:", error);
    return NextResponse.json({ error: "Graph failed" }, { status: 500 });
  }
}
