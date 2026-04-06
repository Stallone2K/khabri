import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getCached, setCache } from "../cache";
import { CRYPTO_WATCHLIST } from "@/lib/market-config";

const CACHE_KEY = "market:crypto";
const CACHE_TTL = 60_000; // 60 seconds

export async function GET(req: Request) {
  const auth = await authenticateRequest(req, "analytics");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cached = getCached<unknown>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const ids = CRYPTO_WATCHLIST.join(",");
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h,7d&order=market_cap_desc`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`CoinGecko API returned ${res.status}`);
    }

    const raw = await res.json();

    const coins = raw.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol?.toUpperCase(),
      name: coin.name,
      image: coin.image,
      currentPrice: coin.current_price,
      priceChange24h: coin.price_change_percentage_24h,
      priceChange7d: coin.price_change_percentage_7d_in_currency,
      sparkline: coin.sparkline_in_7d?.price ?? [],
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
    }));

    const data = { coins };
    setCache(CACHE_KEY, data, CACHE_TTL);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[MARKET/CRYPTO] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto data" },
      { status: 502 }
    );
  }
}
