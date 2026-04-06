import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getCached, setCache } from "../cache";

const CACHE_TTL = 120_000; // 2 minutes

interface StockResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
  currency: string;
}

async function fetchYahooChart(symbol: string): Promise<StockResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const closes: number[] =
      result.indicators?.quote?.[0]?.close?.filter(
        (v: number | null) => v !== null
      ) ?? [];

    if (closes.length < 2) return null;

    const currentPrice = meta.regularMarketPrice ?? closes[closes.length - 1];
    const previousClose = meta.chartPreviousClose ?? closes[0];
    const change = currentPrice - previousClose;
    const changePercent =
      previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: meta.symbol ?? symbol,
      name: meta.shortName ?? meta.symbol ?? symbol,
      price: currentPrice,
      change,
      changePercent,
      sparkline: closes,
      currency: meta.currency ?? "USD",
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const auth = await authenticateRequest(req, "analytics");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const symbols = searchParams.get("symbols") || "^GSPC,^IXIC";
    const cacheKey = `market:stocks:${symbols}`;

    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const symbolList = symbols.split(",").filter(Boolean);
    const results = await Promise.all(symbolList.map(fetchYahooChart));
    const indices = results.filter(
      (r): r is StockResult => r !== null
    );

    const data = { indices };
    setCache(cacheKey, data, CACHE_TTL);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[MARKET/STOCKS] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 502 }
    );
  }
}
