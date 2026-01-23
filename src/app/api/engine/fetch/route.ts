import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma"; // Assuming you have this

export async function POST() {
  const parser = new Parser();

  // 1. Get Sources from DB
  const sources = await prisma.source.findMany();

  const signals = [];

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      feed.items.slice(0, 10).forEach((item) => {
        signals.push({
          title: item.title,
          url: item.link,
          source: source.name,
          publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        });
      });
    } catch (e) {
      console.error(`Failed to parse ${source.name}`, e);
    }
  }

  // 2. (Optional) Save Signals to DB or return for Ranking
  return NextResponse.json({ signals });
}
