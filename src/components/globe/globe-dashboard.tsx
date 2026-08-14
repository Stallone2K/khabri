"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { RadiusTrendsPanel } from "./radius-trends-panel";
import { CellSignalsPanel } from "./cell-signals-panel";
import { Crosshair, X, Check, Trash2 } from "lucide-react";

const GlobeView = dynamic(() => import("./globe-view").then((m) => m.GlobeView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black font-mono text-xs text-emerald-500">
      INITIALIZING GLOBE…
    </div>
  ),
});

interface GeoWatch {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export function GlobeDashboard() {
  const [heatData, setHeatData] = useState<
    (GeoJSON.FeatureCollection & { properties?: { maxCount: number; cells: number } }) | null
  >(null);
  const [anomalyData, setAnomalyData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [watches, setWatches] = useState<GeoWatch[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ id: string; count: number } | null>(null);

  // radius-picking state
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [draftKm, setDraftKm] = useState(200);
  const [draftLabel, setDraftLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/geo/heat?window=7d")
      .then((r) => r.json())
      .then(setHeatData)
      .catch(() => setHeatData(null));
    fetch("/api/geo/anomalies")
      .then((r) => r.json())
      .then(setAnomalyData)
      .catch(() => setAnomalyData(null));
  }, []);

  const loadWatches = useCallback(async () => {
    try {
      const res = await fetch("/api/geo/watch");
      const data = await res.json();
      const list: GeoWatch[] = data.watches ?? [];
      setWatches(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
    } catch {
      /* rail shows empty state */
    }
  }, []);
  useEffect(() => void loadWatches(), [loadWatches]);

  const active = useMemo(() => watches.find((w) => w.id === activeId) ?? null, [watches, activeId]);

  useEffect(() => {
    if (active) setFlyTo({ lat: active.centerLat, lng: active.centerLng, zoom: zoomForRadius(active.radiusKm) });
  }, [active]);

  const radiusOnGlobe = picking && draft
    ? { lat: draft.lat, lng: draft.lng, km: draftKm }
    : active
      ? { lat: active.centerLat, lng: active.centerLng, km: active.radiusKm }
      : null;

  async function saveDraft() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/geo/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: draftLabel || `Zone ${watches.length + 1}`,
          centerLat: draft.lat,
          centerLng: draft.lng,
          radiusKm: draftKm,
        }),
      });
      if (res.ok) {
        const { watch } = await res.json();
        setPicking(false);
        setDraft(null);
        setDraftLabel("");
        await loadWatches();
        setActiveId(watch.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteActive() {
    if (!active) return;
    await fetch(`/api/geo/watch?id=${active.id}`, { method: "DELETE" });
    setActiveId(null);
    await loadWatches();
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-sm border border-border lg:grid lg:h-[70vh] lg:min-h-[480px] lg:grid-cols-[1fr_300px]">
      {/* ---------------- globe pane ---------------- */}
      <div className="relative h-[55vh] min-h-[360px] lg:h-auto">
        <GlobeView
          heatData={heatData}
          anomalyData={anomalyData}
          radius={radiusOnGlobe}
          picking={picking}
          onPickCenter={(lat, lng) => setDraft({ lat, lng })}
          onCellClick={(id, count) => setSelectedCell({ id, count })}
          flyTo={flyTo}
        />

        {selectedCell && !picking && (
          <CellSignalsPanel cell={selectedCell} onClose={() => setSelectedCell(null)} />
        )}

        {/* control strip */}
        <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
          {watches.map((w) => (
            <button
              key={w.id}
              onClick={() => { setPicking(false); setActiveId(w.id); }}
              className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                w.id === activeId && !picking
                  ? "border-emerald-400 bg-emerald-950/80 text-emerald-300"
                  : "border-border bg-black/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
          {!picking ? (
            <button
              onClick={() => { setPicking(true); setDraft(null); }}
              className="flex items-center gap-1 border border-emerald-700 bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-950"
            >
              <Crosshair className="h-3 w-3" /> Set Radius
            </button>
          ) : (
            <button
              onClick={() => { setPicking(false); setDraft(null); }}
              className="flex items-center gap-1 border border-border bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          )}
          {active && !picking && (
            <button
              onClick={() => void deleteActive()}
              title="Delete zone"
              className="border border-border bg-black/70 p-1 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* picking HUD */}
        {picking && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2 border border-emerald-800 bg-black/85 p-2 font-mono text-[11px] text-emerald-300 md:right-auto">
            {!draft ? (
              <span className="animate-pulse">▓ CLICK A POINT ON THE GLOBE TO CENTER YOUR ZONE</span>
            ) : (
              <>
                <span>
                  {draft.lat.toFixed(2)}, {draft.lng.toFixed(2)}
                </span>
                <label className="flex items-center gap-1">
                  R:
                  <input
                    type="range"
                    min={10}
                    max={1000}
                    step={10}
                    value={draftKm}
                    onChange={(e) => setDraftKm(Number(e.target.value))}
                    className="w-28 accent-emerald-400"
                  />
                  <span className="w-14">{draftKm} km</span>
                </label>
                <input
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  placeholder="zone name"
                  className="w-24 border border-emerald-900 bg-transparent px-1 py-0.5 text-emerald-200 placeholder:text-emerald-900"
                />
                <button
                  onClick={() => void saveDraft()}
                  disabled={saving}
                  className="flex items-center gap-1 border border-emerald-500 px-2 py-0.5 uppercase hover:bg-emerald-950 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        )}

        {/* heat legend */}
        {heatData?.properties && (
          <div className="absolute bottom-2 right-2 hidden border border-border bg-black/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground md:block">
            {(heatData.properties as any).cells} cells · 7d signal density
          </div>
        )}
      </div>

      {/* ---------------- trends rail (right on desktop, below on mobile) ---------------- */}
      <div className="h-[40vh] border-t border-border bg-background lg:h-auto lg:border-l lg:border-t-0">
        <RadiusTrendsPanel watchId={picking ? null : activeId} watchLabel={active?.label ?? null} />
      </div>
    </div>
  );
}

function zoomForRadius(km: number): number {
  if (km <= 50) return 8;
  if (km <= 150) return 7;
  if (km <= 400) return 5.5;
  if (km <= 800) return 4.5;
  return 3.5;
}
