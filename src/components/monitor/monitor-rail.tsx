"use client";

/**
 * Right rail beside the globe — the Shopify "Metrics at a glance" analog,
 * terminal-skinned. Pure reads, auto-refreshed by the parent.
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
      <div className="p-3">{children}</div>
    </div>
  );
}

function Meter({ label, value, pct, tone = "bg-emerald-400" }: {
  label: string; value: string | number; pct: number; tone?: string;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-foreground/85">{label}</span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{value}</span>
      </div>
      <div className="h-1 w-full bg-muted/40">
        <div className={`h-1 ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

export function MonitorRail({ summary }: { summary: MonitorSummary | null }) {
  if (!summary) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse border border-border bg-muted/20" />
        ))}
      </div>
    );
  }

  const anomalyTotal = summary.anomalies.total;
  const maxCat = Math.max(1, ...summary.topCategories.map((c) => c.count));

  return (
    <div className="space-y-3">
      {/* headline numbers — Shopify "Visitors right now" analog */}
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
                : anomalyTotal > 0
                  ? "text-orange-400"
                  : "text-emerald-400"
            }`}
          >
            {anomalyTotal}
          </div>
          {anomalyTotal > 0 && (
            <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
              {summary.anomalies.critical}C · {summary.anomalies.high}H · {summary.anomalies.elevated}E
            </div>
          )}
        </div>
      </div>

      <RailCard title="▓ Top Locations · 7d">
        {summary.topLocations.map((l) => (
          <Meter key={l.countryCode} label={l.name} value={l.count.toLocaleString()} pct={l.pct} />
        ))}
        {summary.topLocations.length === 0 && (
          <p className="font-mono text-[10px] text-muted-foreground">No geo-tagged signals yet.</p>
        )}
      </RailCard>

      <RailCard title="▓ Categories · 24h">
        {summary.topCategories.map((c) => (
          <Meter
            key={c.name}
            label={c.name}
            value={c.count}
            pct={Math.round((c.count / maxCat) * 100)}
            tone="bg-cyan-400"
          />
        ))}
      </RailCard>

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
