"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useSidebarCollapsed } from "@/app/dashboard/layout";
import { FeedCard, type FeedArticle } from "@/components/feeds/feed-card";
import { FeedGridSkeleton } from "@/components/feeds/feed-card-skeleton";
import { Button } from "@/components/ui/button";
import { PanelRight, ArrowLeft, Loader2, Rss } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function SourceFeedsPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = use(params);
  const { collapsed, expand } = useSidebarCollapsed();

  const [sourceName, setSourceName] = useState("");
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch source name
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((data) => {
        const source = data.find((s: any) => s.id === sourceId);
        if (source) setSourceName(source.name);
      })
      .catch(() => {});
  }, [sourceId]);

  // Fetch articles for this source
  const fetchArticles = useCallback(
    async (cursorId?: string | null) => {
      const isFirstPage = !cursorId;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams();
        params.set("sourceId", sourceId);
        if (cursorId) params.set("cursor", cursorId);
        params.set("limit", "20");

        const res = await fetch(`/api/feeds?${params}`);
        const data = await res.json();

        if (isFirstPage) {
          setArticles(data.articles);
        } else {
          setArticles((prev) => [...prev, ...data.articles]);
        }
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        toast.error("Failed to load articles");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sourceId]
  );

  useEffect(() => {
    fetchArticles(null);
  }, [fetchArticles]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchArticles(cursor);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, cursor, fetchArticles]);

  const handleMarkRead = (articleId: string) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? { ...a, userStates: [{ ...a.userStates[0], isRead: true, isLiked: a.userStates[0]?.isLiked ?? false }] }
          : a
      )
    );
    fetch("/api/feeds/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, isRead: true }),
    }).catch(() => {});
  };

  const handleToggleSave = (articleId: string, saved: boolean) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? { ...a, userStates: [{ ...a.userStates[0], isSaved: saved, isRead: a.userStates[0]?.isRead ?? false, isLiked: a.userStates[0]?.isLiked ?? false }] }
          : a
      )
    );
    fetch("/api/feeds/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, isSaved: saved }),
    }).catch(() => {});
  };

  const handleToggleLike = (articleId: string, liked: boolean) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? { ...a, userStates: [{ ...a.userStates[0], isLiked: liked, isRead: a.userStates[0]?.isRead ?? false, isSaved: a.userStates[0]?.isSaved ?? false }] }
          : a
      )
    );
    fetch("/api/feeds/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, isLiked: liked }),
    }).catch(() => {});
  };

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
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

      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href="/dashboard/feeds">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {sourceName || "Feed"}
          </h1>
        </div>

        {/* Loading skeleton */}
        {loading && <FeedGridSkeleton count={6} />}

        {/* Empty state */}
        {!loading && articles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Rss className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No articles from this source yet
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try refreshing from the main feeds page.
            </p>
          </div>
        )}

        {/* Feed — single column Instagram style */}
        {articles.length > 0 && (
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

        {/* Loading more */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Sentinel */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}
