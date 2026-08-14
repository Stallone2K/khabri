"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { makeGlobeStyle, EMPTY_FC } from "./globe-style";
import { circleFeature } from "@/lib/geo";

export interface GlobeViewProps {
  heatData: GeoJSON.FeatureCollection | null;
  anomalyData?: GeoJSON.FeatureCollection | null;
  /** Active or in-progress radius; null hides the ring. */
  radius: { lat: number; lng: number; km: number } | null;
  /** When true, clicks pick a new center instead of panning-only. */
  picking: boolean;
  onPickCenter: (lat: number, lng: number) => void;
  /** Heatpoint drill-down. */
  onCellClick?: (cell: string, count: number) => void;
  /** Fly the camera here when it changes (watch switch). */
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
}

export function GlobeView({
  heatData,
  anomalyData,
  radius,
  picking,
  onPickCenter,
  onCellClick,
  flyTo,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const pickRef = useRef(onPickCenter);
  pickRef.current = onPickCenter;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;
  const cellClickRef = useRef(onCellClick);
  cellClickRef.current = onCellClick;

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: makeGlobeStyle(),
      center: [20, 15],
      zoom: 1.6,
      attributionControl: { compact: true },
      // TileJSON responses reference absolute upstream URLs — route every
      // upstream request back through the same-origin /map-tiles proxy.
      // Must stay absolute: MapLibre workers cannot parse relative URLs.
      transformRequest: (url) =>
        url.startsWith("https://tiles.openfreemap.org/")
          ? {
              url: url.replace(
                "https://tiles.openfreemap.org/",
                `${window.location.origin}/map-tiles/`,
              ),
            }
          : undefined,
    });
    map.on("load", () => {
      loadedRef.current = true;
      // Belt-and-braces: some MapLibre versions ignore style-level projection.
      try {
        (map as any).setProjection?.({ type: "globe" });
      } catch { /* style projection already applied */ }
      map.resize();
    });
    map.on("error", (e) => console.error("[GLOBE]", e.error?.message ?? e));
    map.on("click", (e) => {
      if (pickingRef.current) {
        pickRef.current(e.lngLat.lat, e.lngLat.lng);
        return;
      }
      const hits = map.queryRenderedFeatures(e.point, { layers: ["heat-points"] });
      const props = hits[0]?.properties as { cell?: string; count?: number } | undefined;
      if (props?.cell) cellClickRef.current?.(props.cell, props.count ?? 0);
    });
    map.on("mouseenter", "heat-points", () => {
      if (!pickingRef.current) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "heat-points", () => {
      map.getCanvas().style.cursor = "";
    });
    mapRef.current = map;
    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // heat updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () =>
      (map.getSource("heat") as GeoJSONSource | undefined)?.setData(
        (heatData ?? EMPTY_FC) as any,
      );
    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [heatData]);

  // anomaly layer updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () =>
      (map.getSource("anomalies") as GeoJSONSource | undefined)?.setData(
        (anomalyData ?? EMPTY_FC) as any,
      );
    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [anomalyData]);

  // radius ring updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const fc = radius
      ? { type: "FeatureCollection", features: [circleFeature(radius.lat, radius.lng, radius.km)] }
      : EMPTY_FC;
    const apply = () =>
      (map.getSource("radius") as GeoJSONSource | undefined)?.setData(fc as any);
    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [radius]);

  // camera
  useEffect(() => {
    if (!mapRef.current || !flyTo) return;
    mapRef.current.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 5,
      duration: 1800,
    });
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${picking ? "cursor-crosshair" : ""}`}
    />
  );
}
