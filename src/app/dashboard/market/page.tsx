"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUserCountry } from "@/hooks/use-user-country";
import { useSidebarCollapsed } from "@/app/dashboard/layout";
import {
  getMarketConfig,
  getGlobalIndices,
  getAllStockSymbols,
  getCurrencySymbol,
  CRYPTO_WATCHLIST,
} from "@/lib/market-config";
import { MarketSummaryCards } from "@/components/market/market-summary-cards";
import { MarketSection } from "@/components/market/market-section";
import { AssetDetailDialog } from "@/components/market/asset-detail-dialog";
import type { MarketAsset } from "@/components/market/market-row";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PanelRight, RefreshCw } from "lucide-react";

function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

export default function MarketPage() {
  const { country } = useUserCountry();
  const { collapsed, expand } = useSidebarCollapsed();

  const config = useMemo(
    () => getMarketConfig(country?.countryCode),
    [country?.countryCode]
  );
  const globalIndices = useMemo(() => getGlobalIndices(), []);

  // Data state
  const [cryptoAssets, setCryptoAssets] = useState<MarketAsset[]>([]);
  const [forexAssets, setForexAssets] = useState<MarketAsset[]>([]);
  const [localStockAssets, setLocalStockAssets] = useState<MarketAsset[]>([]);
  const [globalStockAssets, setGlobalStockAssets] = useState<MarketAsset[]>([]);

  // Loading / error state
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const [forexLoading, setForexLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const [forexError, setForexError] = useState<string | null>(null);
  const [stocksError, setStocksError] = useState<string | null>(null);

  // Detail dialog
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Last updated
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastUpdatedText, setLastUpdatedText] = useState("");

  // Fetch crypto
  const fetchCrypto = useCallback(async () => {
    setCryptoLoading(true);
    setCryptoError(null);
    try {
      const res = await fetch("/api/market/crypto");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const assets: MarketAsset[] = data.coins.map((coin: any) => ({
        id: `crypto-${coin.id}`,
        name: coin.name,
        symbol: coin.symbol,
        price: coin.currentPrice,
        changePercent: coin.priceChange24h ?? 0,
        sparkline: coin.sparkline ?? [],
        image: coin.image,
        type: "crypto" as const,
        extra: {
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
        },
      }));
      setCryptoAssets(assets);
    } catch {
      setCryptoError("Failed to load crypto data");
    } finally {
      setCryptoLoading(false);
    }
  }, []);

  // Fetch forex
  const fetchForex = useCallback(async () => {
    setForexLoading(true);
    setForexError(null);
    try {
      const targetSet = new Set([...config.forexPairs, config.currencyCode]);
      targetSet.delete("USD"); // base is USD, no point requesting USD/USD
      const targets = [...targetSet].join(",");
      const res = await fetch(
        `/api/market/forex?base=USD&targets=${targets}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      const assets: MarketAsset[] = Object.entries(
        data.rates as Record<string, number>
      ).map(([currency, rate]) => {
        const hist = data.historical?.[currency] ?? [];
        const firstRate = hist.length > 0 ? hist[0] : rate;
        const changePercent =
          firstRate !== 0 ? ((rate - firstRate) / firstRate) * 100 : 0;

        return {
          id: `forex-${currency}`,
          name: `${data.base}/${currency}`,
          symbol: currency,
          price: rate,
          changePercent,
          sparkline: hist,
          type: "forex" as const,
          currencyPrefix: getCurrencySymbol(currency),
          extra: {
            inverseRate: rate !== 0 ? 1 / rate : 0,
          },
        };
      });
      setForexAssets(assets);
    } catch {
      setForexError("Failed to load forex data");
    } finally {
      setForexLoading(false);
    }
  }, [config.forexPairs]);

  // Fetch stocks
  const fetchStocks = useCallback(async () => {
    setStocksLoading(true);
    setStocksError(null);
    try {
      const symbols = getAllStockSymbols(config).join(",");
      const res = await fetch(`/api/market/stocks?symbols=${symbols}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      const localSymbolSet = new Set(
        config.localIndices.map((i) => i.yahooSymbol)
      );
      const globalSymbolSet = new Set(
        globalIndices.map((i) => i.yahooSymbol)
      );

      // Build a name lookup from config
      const nameLookup: Record<string, string> = {};
      for (const idx of config.localIndices) {
        nameLookup[idx.yahooSymbol] = idx.name;
      }
      for (const idx of globalIndices) {
        nameLookup[idx.yahooSymbol] = idx.name;
      }

      const allAssets: MarketAsset[] = data.indices.map((idx: any) => ({
        id: `stock-${idx.symbol}`,
        name: nameLookup[idx.symbol] || idx.name,
        symbol: idx.symbol,
        price: idx.price,
        changePercent: idx.changePercent,
        sparkline: idx.sparkline ?? [],
        type: "stock" as const,
        currencyPrefix: getCurrencySymbol(idx.currency ?? "USD"),
        extra: {
          change: idx.change,
          currency: idx.currency,
        },
      }));

      setLocalStockAssets(
        allAssets.filter((a) => localSymbolSet.has(a.symbol))
      );
      setGlobalStockAssets(
        allAssets.filter((a) => globalSymbolSet.has(a.symbol))
      );
    } catch {
      setStocksError("Failed to load stock data");
    } finally {
      setStocksLoading(false);
    }
  }, [config, globalIndices]);

  // Fetch all
  const fetchAll = useCallback(() => {
    fetchCrypto();
    fetchForex();
    fetchStocks();
    setLastUpdated(new Date());
  }, [fetchCrypto, fetchForex, fetchStocks]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Update "last updated" text
  useEffect(() => {
    if (!lastUpdated) return;
    setLastUpdatedText(timeAgo(lastUpdated));
    const interval = setInterval(() => {
      setLastUpdatedText(timeAgo(lastUpdated));
    }, 10_000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Handle asset click
  const handleAssetClick = (asset: MarketAsset) => {
    setSelectedAsset(asset);
    setDialogOpen(true);
  };

  // Summary card data
  const sp500 =
    globalStockAssets.find((a) => a.symbol === "^GSPC") ??
    localStockAssets.find((a) => a.symbol === "^GSPC") ??
    null;
  const bitcoin = cryptoAssets.find((a) => a.id === "crypto-bitcoin") ?? null;
  const localIndex = localStockAssets[0] ?? null;

  // For local currency card, find the user's currency in forex data
  const localCurrency =
    forexAssets.find((a) => a.symbol === config.currencyCode) ?? null;

  const localIndexLabel =
    config.localIndices[0]?.symbol ?? "Local Index";
  const localCurrencyLabel = config.currencyCode
    ? `USD/${config.currencyCode}`
    : "Forex";

  const summaryLoading = cryptoLoading || forexLoading || stocksLoading;

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      {/* Sidebar expand button */}
      <div className="flex items-center w-full px-4 md:px-8 mt-4">
        {collapsed && (
          <button
            className="hidden md:flex h-10 w-10 items-center justify-center cursor-pointer shrink-0 mr-2"
            onClick={expand}
          >
            <PanelRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Market
            </h1>
            {country && (
              <p className="text-sm text-muted-foreground mt-1">
                {country.countryName} &middot; {config.currencyCode}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastUpdatedText && (
              <span className="text-xs text-muted-foreground">
                {lastUpdatedText}
              </span>
            )}
            <button
              onClick={fetchAll}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-muted-foreground ${
                  summaryLoading ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <MarketSummaryCards
          sp500={sp500}
          bitcoin={bitcoin}
          localIndex={localIndex}
          localCurrency={localCurrency}
          localIndexLabel={localIndexLabel}
          localCurrencyLabel={localCurrencyLabel}
          loading={summaryLoading}
          onAssetClick={handleAssetClick}
        />

        {/* Tabbed Content */}
        <Tabs defaultValue="all">
          <div className="flex justify-center">
            <TabsList className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-1">
              <TabsTrigger value="all" className="rounded-full">All</TabsTrigger>
              <TabsTrigger value="stocks" className="rounded-full">Stocks</TabsTrigger>
              <TabsTrigger value="crypto" className="rounded-full">Crypto</TabsTrigger>
              <TabsTrigger value="forex" className="rounded-full">Forex</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-4 space-y-2">
            {localStockAssets.length > 0 && (
              <MarketSection
                title="Local Indices"
                assets={localStockAssets}
                loading={stocksLoading}
                error={stocksError ?? undefined}
                onAssetClick={handleAssetClick}
                onRetry={fetchStocks}
              />
            )}
            <MarketSection
              title="Global Indices"
              assets={globalStockAssets}
              loading={stocksLoading}
              error={stocksError ?? undefined}
              onAssetClick={handleAssetClick}
              onRetry={fetchStocks}
            />
            <MarketSection
              title="Crypto"
              assets={cryptoAssets}
              loading={cryptoLoading}
              error={cryptoError ?? undefined}
              onAssetClick={handleAssetClick}
              onRetry={fetchCrypto}
            />
            <MarketSection
              title="Currencies"
              assets={forexAssets}
              loading={forexLoading}
              error={forexError ?? undefined}
              onAssetClick={handleAssetClick}
              onRetry={fetchForex}
            />
          </TabsContent>

          <TabsContent value="stocks" className="mt-4 space-y-2">
            {localStockAssets.length > 0 && (
              <MarketSection
                title="Local Indices"
                assets={localStockAssets}
                loading={stocksLoading}
                error={stocksError ?? undefined}
                onAssetClick={handleAssetClick}
                onRetry={fetchStocks}
              />
            )}
            <MarketSection
              title="Global Indices"
              assets={globalStockAssets}
              loading={stocksLoading}
              error={stocksError ?? undefined}
              onAssetClick={handleAssetClick}
              onRetry={fetchStocks}
            />
          </TabsContent>

          <TabsContent value="crypto" className="mt-4">
            <MarketSection
              title="Crypto"
              assets={cryptoAssets}
              loading={cryptoLoading}
              error={cryptoError ?? undefined}
              onAssetClick={handleAssetClick}
              onRetry={fetchCrypto}
            />
          </TabsContent>

          <TabsContent value="forex" className="mt-4">
            <MarketSection
              title="Currencies"
              assets={forexAssets}
              loading={forexLoading}
              error={forexError ?? undefined}
              onAssetClick={handleAssetClick}
              onRetry={fetchForex}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <AssetDetailDialog
        asset={selectedAsset}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
