"use client";

import { Heart, Bookmark, SquareArrowOutUpRight, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type FeedArticle = {
  id: string;
  title: string;
  link: string;
  content: string | null;
  cleanedContent: string | null; // repurposed as imageUrl
  publishedDate: string;
  source: { id: string; name: string; url: string };
  userStates: { isRead: boolean; isSaved: boolean; isLiked: boolean }[];
};

function extractImageFromContent(content: string | null): string | null {
  if (!content) return null;
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || null;
}

function extractSnippet(content: string | null): string {
  if (!content) return "";
  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, "").trim();
  return text.slice(0, 150);
}

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function FeedCard({
  article,
  onMarkRead,
  onToggleSave,
  onToggleLike,
}: {
  article: FeedArticle;
  onMarkRead: (id: string) => void;
  onToggleSave: (id: string, saved: boolean) => void;
  onToggleLike: (id: string, liked: boolean) => void;
}) {
  const isRead = article.userStates[0]?.isRead ?? false;
  const isSaved = article.userStates[0]?.isSaved ?? false;
  const isLiked = article.userStates[0]?.isLiked ?? false;
  const imageUrl =
    article.cleanedContent || extractImageFromContent(article.content);
  const snippet = extractSnippet(article.content);

  const sourceInitial = article.source.name.charAt(0).toUpperCase();
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${getDomain(article.source.url)}&sz=64`;

  const handleOpen = () => {
    if (!isRead) onMarkRead(article.id);
    window.open(article.link, "_blank", "noopener,noreferrer");
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url: article.link });
      } catch {}
    } else {
      await navigator.clipboard.writeText(article.link);
    }
  };

  return (
    <div className={`border-b border-border pb-4 ${isRead ? "opacity-50" : ""}`}>
      {/* Header — source avatar + name + time */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          <img
            src={faviconUrl}
            alt={article.source.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = "none";
              el.parentElement!.innerHTML = `<span class="text-xs font-bold text-muted-foreground">${sourceInitial}</span>`;
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none truncate">
            {article.source.name}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {getDomain(article.source.url)}
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {titleCase(
            formatDistanceToNow(new Date(article.publishedDate), {
              addSuffix: true,
            })
          )}
        </span>
      </div>

      {/* Image — only if available */}
      {imageUrl && (
        <div
          className="relative w-full aspect-video rounded-md overflow-hidden bg-muted cursor-pointer mb-3"
          onClick={handleOpen}
        >
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display =
                "none";
            }}
          />
        </div>
      )}

      {/* No image — YouTube post card style */}
      {!imageUrl && (
        <div
          className="w-full rounded-lg bg-muted/40 border border-border/50 p-4 cursor-pointer mb-3 hover:bg-muted/60 transition-colors"
          onClick={handleOpen}
        >
          <p className="text-[15px] font-medium leading-relaxed line-clamp-4">
            {article.title}
          </p>
          {snippet && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
              {snippet}
            </p>
          )}
          <p className="text-xs text-muted-foreground/60 mt-3">
            {getDomain(article.source.url)}
          </p>
        </div>
      )}

      {/* Action bar — like Instagram */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(article.id, !isLiked);
            }}
            className="cursor-pointer transition-transform active:scale-125"
          >
            <Heart
              className={`h-[22px] w-[22px] transition-colors ${
                isLiked
                  ? "fill-red-500 text-red-500"
                  : "text-foreground hover:text-muted-foreground"
              }`}
            />
          </button>
          <button
            onClick={handleShare}
            className="cursor-pointer text-foreground hover:text-muted-foreground transition-colors"
          >
            <Send className="h-[20px] w-[20px]" />
          </button>
          <button
            onClick={handleOpen}
            className="cursor-pointer text-foreground hover:text-muted-foreground transition-colors"
          >
            <SquareArrowOutUpRight className="h-[20px] w-[20px]" />
          </button>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(article.id, !isSaved);
          }}
          className="cursor-pointer transition-transform active:scale-125"
        >
          <Bookmark
            className={`h-[22px] w-[22px] transition-colors ${
              isSaved
                ? "fill-foreground text-foreground"
                : "text-foreground hover:text-muted-foreground"
            }`}
          />
        </button>
      </div>

      {/* Title + snippet — only for posts with images (text-only cards already show this) */}
      {imageUrl && (
        <div
          className="cursor-pointer"
          onClick={handleOpen}
        >
          <p className="text-sm leading-snug">
            <span className="font-semibold">{article.source.name}</span>{" "}
            {article.title}
          </p>
          {snippet && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {snippet}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
