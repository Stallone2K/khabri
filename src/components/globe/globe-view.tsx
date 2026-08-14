"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { makeGlobeStyle, EMPTY_FC } from "./globe-style";
import { circleFeature } from "@/lib/geo";

export interface GlobeViewProps {
  heatData: GeoJSON.FeatureCollection | null;
  /** Active or in-progress radius; null hides the ring. */
  radius: { lat: number; lng: number; km: number } | null;
  /** When true, clicks pick a new center instead of panning-only. */
  picking: boolean;
  onPickCenter: (lat: number, lng: number) => void;
  /** Fly the camera here when it changes (watch switch). */
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
}

export function GlobeView({ heatData, radius, picking, onPickCenter, flyTo }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const pickRef = useRef(onPickCenter);
  pickRef.current = onPickCenter;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: makeGlobeStyle(),
      center: [20, 15],
      zoom: 1.6,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-left");
    map.on("load", () => {
      loadedRef.current = true;
      map.resize();
    });
    map.on("click", (e) => {
      if (pickingRef.current) pickRef.current(e.lngLat.lat, e.lngLat.lng);
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
      style={{ background: "#000503" }}
    />
  );
}
