"use client";

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export type TrendItem = {
  id: string;
  rank: number;
  topic: string;
  score: number;
  reason: string | null;
  category: string | null;
  region: string | null;
  originalUrl: string | null;
  createdAt: string;
};

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-red-500/15 text-red-400 border-red-500/30";
  if (score >= 80) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  if (score >= 60) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
}

export function TrendCard({ trend }: { trend: TrendItem }) {
  const handleOpen = () => {
    if (trend.originalUrl) {
      window.open(trend.originalUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="w-full rounded-lg bg-muted/40 border border-border/50 p-4 cursor-pointer hover:bg-muted/60 transition-colors"
      onClick={handleOpen}
    >
      {/* Badges row */}
      <div className="flex items-center gap-2 mb-3">
        {trend.category && (
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
            {trend.category}
          </Badge>
        )}
        {trend.region && (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
            {trend.region === "DOMESTIC" ? "Domestic" : "International"}
          </Badge>
        )}
      </div>

      {/* Title */}
      <p className="text-[15px] font-medium leading-relaxed line-clamp-3">
        {trend.topic}
      </p>

      {/* Reason */}
      {trend.reason && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
          {trend.reason}
        </p>
      )}

      {/* Bottom row */}
      <div className="flex items-center gap-3 mt-3">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${scoreBadgeClass(trend.score)}`}
        >
          Score {trend.score}
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          {titleCase(
            formatDistanceToNow(new Date(trend.createdAt), { addSuffix: true })
          )}
        </span>
      </div>
    </div>
  );
}
