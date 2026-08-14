"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";

interface CellSignal {
  id: string;
  title: string;
  url: string;
  source: string;
  place: string;
  createdAt: string;
}

export function CellSignalsPanel({
  cell,
  onClose,
}: {
  cell: { id: string; count: number };
  onClose: () => void;
}) {
  const [signals, setSignals] = useState<CellSignal[]>([]);
  const [topPlace, setTopPlace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/geo/cell?cell=${cell.id}&window=7d`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSignals(data.signals ?? []);
        setTopPlace(data.topPlace ?? null);
      })
      .catch(() => !cancelled && setSignals([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cell.id]);

  return (
    <div className="absolute left-2 top-12 z-10 flex max-h-[70%] w-72 flex-col border border-emerald-800 bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-emerald-900 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
            ▓ {topPlace ?? "Sector"}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {cell.count} signals · 7d · cell {cell.id.slice(0, 7)}
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="m-2 h-9 animate-pulse rounded-sm bg-muted/40" />
          ))}
        {!loading && signals.length === 0 && (
          <p className="p-3 font-mono text-[10px] text-muted-foreground">No recent signals here.</p>
        )}
        {!loading &&
          signals.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block border-b border-border/40 px-3 py-2 hover:bg-emerald-950/40"
            >
              <div className="flex items-start gap-1.5">
                <span className="min-w-0 flex-1 text-[11px] leading-snug text-foreground/90 group-hover:text-emerald-200">
                  {s.title}
                </span>
                <ExternalLink className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                {s.source} · {s.place}
              </div>
            </a>
          ))}
      </div>
    </div>
  );
}
