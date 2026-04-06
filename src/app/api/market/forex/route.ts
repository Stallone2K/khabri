import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getCached, setCache } from "../cache";

const CACHE_TTL = 300_000; // 5 minutes

export async function GET(req: Request) {
  const auth = await authenticateRequest(req, "analytics");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const base = searchParams.get("base") || "USD";
    const targets = searchParams.get("targets") || "EUR,GBP,JPY,INR";
    const cacheKey = `market:forex:${base}:${targets}`;

    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch latest rates
    const latestUrl = `https://api.frankfurter.app/latest?from=${base}&to=${targets}`;
    const latestRes = await fetch(latestUrl);
    if (!latestRes.ok) {
      throw new Error(`Frankfurter latest returned ${latestRes.status}`);
    }
    const latestData = await latestRes.json();

    // Fetch 7-day historical for sparklines
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const histUrl = `https://api.frankfurter.app/${fmt(weekAgo)}..${fmt(today)}?from=${base}&to=${targets}`;
    const histRes = await fetch(histUrl);

    let historical: Record<string, number[]> = {};
    if (histRes.ok) {
      const histData = await histRes.json();
      // histData.rates is { "2026-04-01": { EUR: 0.92, ... }, ... }
      const dates = Object.keys(histData.rates).sort();
      const targetList = targets.split(",");
      for (const t of targetList) {
        historical[t] = dates.map((d) => histData.rates[d]?.[t] ?? 0);
      }
    }

    const data = {
      base: latestData.base,
      date: latestData.date,
      rates: latestData.rates,
      historical,
    };

    setCache(cacheKey, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[MARKET/FOREX] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch forex data" },
      { status: 502 }
    );
  }
}
