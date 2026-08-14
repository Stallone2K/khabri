"use client";

/**
 * Ambient data-sculpture globe — the Shopify Live View model, terminal-dark.
 * Dot-matrix continents sampled from BUNDLED land topology (d3-geo
 * point-in-polygon — zero network deps, no h3), signal heat as glowing
 * points, anomalies as spikes + pulse rings. Not navigational: it rotates
 * and breathes; interaction lives in the rail around it.
 */
import { useEffect, useRef } from "react";
import Globe from "globe.gl";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import countriesTopo from "world-atlas/countries-110m.json";

const GREEN = "#3dff8f";
const DOT_STEP_DEG = 1.4; // land dot grid density

interface HeatPoint {
  lat: number;
  lng: number;
  count: number;
}
interface AnomalyPoint {
  lat: number;
  lng: number;
  severity: string;
  zScore: number;
  label: string;
}

export interface AmbientGlobeProps {
  heat: HeatPoint[];
  anomalies: AnomalyPoint[];
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ff3b3b",
  HIGH: "#ff8c1a",
  ELEVATED: "#ffd23b",
};

/** Sample the landmass into a dot grid once per session. */
function buildLandDots(): { lat: number; lng: number }[] {
  const land = feature(countriesTopo as any, (countriesTopo as any).objects.land) as any;
  const dots: { lat: number; lng: number }[] = [];
  for (let lat = -58; lat <= 78; lat += DOT_STEP_DEG) {
    for (let lng = -180; lng < 180; lng += DOT_STEP_DEG) {
      if (geoContains(land, [lng, lat])) dots.push({ lat, lng });
    }
  }
  return dots;
}

export function AmbientGlobe({ heat, anomalies }: AmbientGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const landDotsRef = useRef<{ lat: number; lng: number }[] | null>(null);

  // init once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || globeRef.current) return;

    if (!landDotsRef.current) landDotsRef.current = buildLandDots();

    const globe = new Globe(el)
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor(GREEN)
      .atmosphereAltitude(0.16)
      .pointsMerge(true)
      .pointResolution(6) // thousands of dots — halve per-point triangles
      .pointLat("lat")
      .pointLng("lng")
      .pointColor("color")
      .pointAltitude("altitude")
      .pointRadius("radius")
      .ringLat("lat")
      .ringLng("lng")
      .ringColor("color")
      .ringMaxRadius("maxR")
      .ringPropagationSpeed(1.2)
      .ringRepeatPeriod(1400)
      .width(el.clientWidth)
      .height(el.clientHeight);

    // Dark sphere under the dots
    const mat = globe.globeMaterial() as any;
    mat.color?.set?.("#03130b");
    mat.emissive?.set?.("#010704");
    mat.shininess = 0.2;

    // Ambient behavior: slow rotation, no pan, gentle zoom bounds
    const controls = globe.controls() as any;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.enablePan = false;
    controls.minDistance = 180;
    controls.maxDistance = 500;
    globe.pointOfView({ lat: 18, lng: 40, altitude: 2.1 });

    globeRef.current = globe;

    const ro = new ResizeObserver(() => {
      globe.width(el.clientWidth).height(el.clientHeight);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      globe._destructor?.();
      globeRef.current = null;
    };
  }, []);

  // data layers: land matrix + heat dots + anomaly spikes in one dataset
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const landDots = (landDotsRef.current ?? []).map((d) => ({
      lat: d.lat,
      lng: d.lng,
      color: "rgba(61, 255, 143, 0.28)",
      altitude: 0.002,
      radius: 0.32,
    }));

    const maxCount = Math.max(1, ...heat.map((h) => h.count));
    const heatDots = heat.map((h) => ({
      lat: h.lat,
      lng: h.lng,
      color: `rgba(120, 255, 190, ${0.5 + 0.5 * Math.min(1, h.count / maxCount)})`,
      altitude: 0.012,
      radius: 0.16 + 0.6 * Math.sqrt(h.count / maxCount),
    }));

    const spikes = anomalies.map((a) => ({
      lat: a.lat,
      lng: a.lng,
      color: SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.ELEVATED,
      altitude: Math.min(0.35, 0.06 + a.zScore * 0.045), // Shopify-spike: taller = hotter
      radius: 0.22,
    }));

    globe.pointsData([...landDots, ...heatDots, ...spikes]);
    globe.ringsData(
      anomalies.map((a) => ({
        lat: a.lat,
        lng: a.lng,
        color: SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.ELEVATED,
        maxR: 3 + Math.min(6, a.zScore),
      })),
    );
  }, [heat, anomalies]);

  // Absolute so the WebGL canvas can never dictate flex sizing (it would
  // otherwise push the rail out of the row).
  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />;
}
