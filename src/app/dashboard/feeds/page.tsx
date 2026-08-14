"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSidebarCollapsed } from "@/app/dashboard/layout";
import { FeedCard, type FeedArticle } from "@/components/feeds/feed-card";
import { FeedGridSkeleton } from "@/components/feeds/feed-card-skeleton";
import { FeedSwitcher } from "@/components/feeds/feed-switcher";
import { TrendCard, type TrendItem } from "@/components/feeds/trend-card";
import { PanelRight, Loader2, Grab } from "lucide-react";
import { toast } from "sonner";

type FeedTab = "feeds" | "discover" | "trending";
type Source = { id: string; name: string; url: string };

const PULL_THRESHOLD = 80;

export default function FeedsPage() {
  const { collapsed, expand } = useSidebarCollapsed();

  const [activeTab, setActiveTab] = useState<FeedTab>("feeds");
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [trendPage, setTrendPage] = useState(1);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Find the scrollable parent (<main> in dashboard layout)
  useEffect(() => {
    let el = containerRef.current?.parentElement ?? null;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollParentRef.current = el;
        return;
      }
      el = el.parentElement;
    }
  }, []);

  // Fetch sources (for empty state + auto-ingestion)
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((data) => setSources(data))
      .catch(() => {});
  }, []);

  // Fetch articles (feeds + discover tabs)
  const fetchArticles = useCallback(
    async (cursorId?: string | null) => {
      const isFirstPage = !cursorId;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);

      try {
        const endpoint =
          activeTab === "discover" ? "/api/feeds/discover" : "/api/feeds";
        const params = new URLSearchParams();
        if (cursorId) params.set("cursor", cursorId);
        params.set("limit", "20");

        const res = await fetch(`${endpoint}?${params}`);
        const data = await res.json();
        const fetched = data.articles ?? [];

        if (isFirstPage) {
          setArticles(fetched);
        } else {
          setArticles((prev) => [...prev, ...fetched]);
        }
        setCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);

      } catch {
        toast.error("Failed to load feeds");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab]
  );

  // Fetch trends (trending tab)
  const fetchTrends = useCallback(async (page: number = 1) => {
    const isFirstPage = page === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`/api/feeds/trending?page=${page}`);
      const data = await res.json();
      const fetched = data.trends ?? [];

      if (isFirstPage) {
        setTrends(fetched);
      } else {
        setTrends((prev) => [...prev, ...fetched]);
      }
      setHasMore(data.hasMore ?? false);
      setTrendPage(page);
    } catch {
      toast.error("Failed to load trends");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Tab change → reset + fetch
  useEffect(() => {
    setCursor(null);
    setArticles([]);
    setTrends([]);
    setTrendPage(1);
    setHasMore(false);

    if (activeTab === "trending") {
      fetchTrends(1);
    } else {
      fetchArticles(null);
    }
  }, [activeTab, fetchArticles, fetchTrends]);

  // Trigger RSS ingestion
  const triggerIngestion = async () => {
    setIngesting(true);
    try {
      const res = await fetch("/api/feeds/ingest", { method: "POST" });
      const data = await res.json();
      if (data.articlesIngested > 0) {
        toast.success(`Fetched ${data.articlesIngested} new articles`);
        await fetchArticles(null);
      }
    } catch {
      toast.error("Failed to fetch feeds");
    } finally {
      setIngesting(false);
    }
  };

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollTop = scrollParentRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop <= 0 && !ingesting) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 120));
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD) {
      setPullDistance(50);
      if (activeTab === "feeds") {
        await triggerIngestion();
      } else if (activeTab === "discover") {
        await fetchArticles(null);
      } else {
        await fetchTrends(1);
      }
    }
    setPullDistance(0);
  };

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          if (activeTab === "trending") {
            fetchTrends(trendPage + 1);
          } else {
            fetchArticles(cursor);
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, cursor, trendPage, activeTab, fetchArticles, fetchTrends]);

  // Article state helpers
  const updateArticleState = (
    articleId: string,
    update: Partial<FeedArticle["userStates"][0]>
  ) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? {
              ...a,
              userStates: [
                {
                  isRead: a.userStates[0]?.isRead ?? false,
                  isSaved: a.userStates[0]?.isSaved ?? false,
                  isLiked: a.userStates[0]?.isLiked ?? false,
                  ...update,
                },
              ],
            }
          : a
      )
    );
  };

  const handleMarkRead = (articleId: string) => {
    updateArticleState(articleId, { isRead: true });
    fetch("/api/feeds/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, isRead: true }),
    }).catch(() => {});
  };

  const handleToggleSave = (articleId: string, saved: boolean) => {
    updateArticleState(articleId, { isSaved: saved });
    fetch("/api/feeds/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, isSaved: saved }),
    }).catch(() => {});
  };

  const handleToggleLike = (articleId: string, liked: boolean) => {
    updateArticleState(articleId, { isLiked: liked });
    fetch("/api/feeds/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, isLiked: liked }),
    }).catch(() => {});
  };

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-screen w-full overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {collapsed && (
        <div className="flex items-center w-full px-4 md:px-8 mt-4">
          <button
            className="hidden md:flex h-10 w-10 items-center justify-center cursor-pointer shrink-0"
            onClick={expand}
          >
            <PanelRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{
          height: pullDistance > 0 ? `${pullDistance}px` : "0px",
          opacity: pullProgress,
          transitionDuration: isPulling ? "0ms" : "300ms",
        }}
      >
        <div className="flex items-center justify-center h-full">
          {ingesting ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          ) : pullProgress < 1 ? (
            <Grab
              className="h-5 w-5 text-muted-foreground transition-transform"
              style={{
                transform: `scale(${0.8 + pullProgress * 0.4})`,
                opacity: Math.max(0.5, pullProgress),
              }}
            />
          ) : (
            <Loader2
              className="h-5 w-5 text-muted-foreground transition-transform"
              style={{ transform: `rotate(${pullProgress * 360}deg)` }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-lg mx-auto">
        {/* Header with switcher */}
        <FeedSwitcher value={activeTab} onChange={setActiveTab} />

        {/* Ingesting state (feeds tab only) */}
        {ingesting && articles.length === 0 && activeTab === "feeds" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">
              Fetching articles from {sources.length} source
              {sources.length !== 1 ? "s" : ""}...
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !ingesting && activeTab !== "trending" && (
          <FeedGridSkeleton count={6} />
        )}
        {loading && activeTab === "trending" && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Empty states — no text, just skeleton placeholder */}
        {!loading && !ingesting && (
          <>
            {(activeTab === "feeds" || activeTab === "discover") && articles.length === 0 && (
              <FeedGridSkeleton count={6} />
            )}
            {activeTab === "trending" && trends.length === 0 && (
              <div className="flex justify-center py-20">
              </div>
            )}
          </>
        )}

        {/* Article feed (feeds + discover) */}
        {activeTab !== "trending" && articles.length > 0 && (
          <div className="space-y-6">
            {articles.map((article) => (
              <FeedCard
                key={article.id}
                article={article}
                onMarkRead={handleMarkRead}
                onToggleSave={handleToggleSave}
                onToggleLike={handleToggleLike}
              />
            ))}
          </div>
        )}

        {/* Trending feed */}
        {activeTab === "trending" && trends.length > 0 && (
          <div className="space-y-4">
            {trends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
        )}

        {/* Loading more */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}
