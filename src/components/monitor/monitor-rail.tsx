"use client";

/**
 * The situation-room rail — reads top-down as:
 * what's happening → where → who → how bad → the raw wire.
 * All blocks locked with the user (MONITOR-PLAN data catalog, Tier 1).
 */
import type { MonitorSummary } from "./monitor-dashboard";

function timeAgoShort(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return hr < 24 ? `${hr}h` : `${Math.floor(hr / 24)}d`;
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-black/40">
      <div className="border-b border-border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="p-2.5">{children}</div>
    </div>
  );
}

const ENTITY_TONE: Record<string, string> = {
  PERSON: "text-violet-400",
  ORG: "text-cyan-400",
  COMPANY: "text-emerald-400",
  COUNTRY: "text-yellow-400",
};

const SEVERITY_TONE: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  ELEVATED: "text-yellow-400",
};

export function MonitorRail({ summary }: { summary: MonitorSummary | null }) {
  if (!summary) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse border border-border bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border bg-black/40 p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Signals 24h
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">
            {summary.signals24h.toLocaleString()}
          </div>
        </div>
        <div className="border border-border bg-black/40 p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Anomalies
          </div>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              summary.anomalies.critical > 0
                ? "text-red-400"
                : summary.anomalies.total > 0
                  ? "text-orange-400"
                  : "text-emerald-400"
            }`}
          >
            {summary.anomalies.total}
          </div>
        </div>
      </div>

      {/* WHAT is happening */}
      <RailCard title="▓ Top Developments">
        {summary.topDevelopments.map((t) => (
          <div key={t.rank} className="flex items-baseline gap-2 border-b border-border/40 py-1.5 last:border-0">
            <span className="font-mono text-[10px] text-muted-foreground">#{t.rank}</span>
            <span className="min-w-0 flex-1 text-[11px] leading-snug">{t.topic}</span>
            <span
              className={`shrink-0 font-mono text-[11px] font-bold ${
                t.score >= 85 ? "text-red-400" : t.score >= 70 ? "text-yellow-400" : "text-emerald-400"
              }`}
            >
              {t.score}
            </span>
          </div>
        ))}
        {summary.topDevelopments.length === 0 && (
          <p className="font-mono text-[10px] text-muted-foreground">Awaiting first ranking cycle…</p>
        )}
      </RailCard>

      {/* WHERE it's happening */}
      <RailCard title="▓ Hotspots · 24h">
        {summary.hotspots.map((h) => (
          <div key={h.countryCode} className="mb-2 last:mb-0">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] text-foreground/85">{h.name}</span>
              <span className="shrink-0 font-mono text-[10px]">
                <span className="text-muted-foreground">{h.count}</span>{" "}
                {h.deltaPct !== 0 && (
                  <span className={h.deltaPct > 0 ? "text-red-400" : "text-emerald-400"}>
                    {h.deltaPct > 0 ? "▲" : "▼"}
                    {Math.abs(h.deltaPct)}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-1 w-full bg-muted/40">
              <div className="h-1 bg-emerald-400" style={{ width: `${Math.max(2, h.pct)}%` }} />
            </div>
          </div>
        ))}
      </RailCard>

      {/* WHO it's about */}
      <RailCard title="▓ Trending Entities · 24h">
        <div className="flex flex-wrap gap-1.5">
          {summary.topEntities.map((e) => (
            <span
              key={`${e.type}:${e.name}`}
              className="border border-border/70 bg-black/50 px-1.5 py-0.5 font-mono text-[10px]"
              title={e.type}
            >
              <span className={ENTITY_TONE[e.type] ?? "text-foreground/80"}>{e.name}</span>
              <span className="ml-1 text-muted-foreground">{e.count}</span>
            </span>
          ))}
          {summary.topEntities.length === 0 && (
            <p className="font-mono text-[10px] text-muted-foreground">No enriched entities yet today.</p>
          )}
        </div>
      </RailCard>

      {/* HOW BAD it is */}
      <RailCard title="▓ Anomaly Watch">
        {summary.anomalyList.length > 0 ? (
          summary.anomalyList.map((a, i) => (
            <div key={i} className="flex items-baseline gap-2 border-b border-border/40 py-1 last:border-0">
              <span className={`font-mono text-[10px] font-bold ${SEVERITY_TONE[a.severity] ?? ""}`}>
                {a.severity.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px]">{a.label}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">z={a.zScore}</span>
            </div>
          ))
        ) : (
          <p className="font-mono text-[10px] text-muted-foreground">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Monitoring — baselines building, no active spikes.
          </p>
        )}
      </RailCard>

      {/* the world's mood */}
      <RailCard title="▓ Sentiment · 24h">
        <div className="flex h-1.5 w-full overflow-hidden">
          <div className="bg-red-400/80" style={{ width: `${summary.sentiment.negative}%` }} />
          <div className="bg-muted" style={{ width: `${summary.sentiment.neutral}%` }} />
          <div className="bg-emerald-400/80" style={{ width: `${summary.sentiment.positive}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span className="text-red-400">NEG {summary.sentiment.negative}%</span>
          <span>NEU {summary.sentiment.neutral}%</span>
          <span className="text-emerald-400">POS {summary.sentiment.positive}%</span>
        </div>
      </RailCard>

      {/* the raw wire */}
      <RailCard title="▓ Wire">
        {summary.firehose.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border-b border-border/40 py-1.5 last:border-0"
          >
            <div className="truncate text-[10.5px] leading-snug text-foreground/80 group-hover:text-emerald-200">
              {s.title}
            </div>
            <div className="font-mono text-[9px] uppercase text-muted-foreground">
              {s.source} · {timeAgoShort(s.createdAt)}
            </div>
          </a>
        ))}
      </RailCard>

      {/* status line */}
      <div className="flex items-center justify-between border border-border bg-black/40 px-3 py-2 font-mono text-[10px] text-muted-foreground">
        <span>LAST SIGNAL {timeAgoShort(summary.lastSignalAt)}</span>
        <span>CYCLE {timeAgoShort(summary.lastCycleAt)}</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>
      </div>
    </div>
  );
}
