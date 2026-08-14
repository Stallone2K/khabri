"use client";

/**
 * Ambient data-sculpture globe — the Shopify Live View model, terminal-dark.
 *
 * Continent dot-matrix: PREGENERATED land dots (land-dots.json, built by the
 * d3-geo sampler offline) rendered as ONE THREE.Points cloud — a single GPU
 * draw call, zero main-thread geometry work. Signal heat and anomaly spikes
 * use globe.gl's point/ring layers (hundreds of items, cheap).
 *
 * Not navigational: it rotates and breathes; interaction lives in the rail.
 */
import { useEffect, useRef } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import landDots from "./land-dots.json";

const GREEN = "#3dff8f";
const GLOBE_RADIUS = 100; // globe.gl world units

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

function latLngToVec3(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/** One Points cloud for all land dots — built once, single draw call. */
function buildLandCloud(): THREE.Points {
  const positions = new Float32Array(landDots.length * 3);
  (landDots as [number, number][]).forEach(([lat, lng], i) => {
    const [x, y, z] = latLngToVec3(lat, lng, GLOBE_RADIUS + 0.4);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(GREEN),
    size: 1.35,
    transparent: true,
    opacity: 0.45,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

export function AmbientGlobe({ heat, anomalies }: AmbientGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);

  // init once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || globeRef.current) return;

    const globe = new Globe(el)
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor(GREEN)
      .atmosphereAltitude(0.16)
      .pointsMerge(true)
      .pointResolution(6)
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

    // Land dot-matrix: one GPU point cloud
    const landCloud = buildLandCloud();
    globe.scene().add(landCloud);

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
      landCloud.geometry.dispose();
      (landCloud.material as THREE.Material).dispose();
      globe._destructor?.();
      globeRef.current = null;
    };
  }, []);

  // data layers: heat dots + anomaly spikes (hundreds of items — cheap)
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

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

    globe.pointsData([...heatDots, ...spikes]);
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
