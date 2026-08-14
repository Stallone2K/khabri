/**
 * Shared geo math — client-safe (no Node APIs).
 */
import { latLngToCell, polygonToCells } from "h3-js";

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle ring around a center, as a closed GeoJSON ring ([lng, lat] pairs).
 */
export function circleRing(
  lat: number,
  lng: number,
  radiusKm: number,
  steps = 72,
): [number, number][] {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const angular = radiusKm / EARTH_RADIUS_KM;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(latR) * Math.cos(angular) +
        Math.cos(latR) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lngR +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latR),
        Math.cos(angular) - Math.sin(latR) * Math.sin(lat2),
      );
    ring.push([((lng2 * 180) / Math.PI + 540) % 360 - 180, (lat2 * 180) / Math.PI]);
  }
  return ring;
}

/** GeoJSON polygon feature for a radius circle. */
export function circleFeature(lat: number, lng: number, radiusKm: number) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [circleRing(lat, lng, radiusKm)],
    },
  };
}

/**
 * Coarse H3 cells (res 3, ~100km) covering a radius — used as the cache key
 * for radius trend rankings, NOT for precise queries (those use PostGIS).
 */
export function coverCells(lat: number, lng: number, radiusKm: number): string[] {
  const ring = circleRing(lat, lng, radiusKm).map(([rlng, rlat]) => [rlat, rlng]);
  const cells = polygonToCells([ring], 3);
  const center = latLngToCell(lat, lng, 3);
  return Array.from(new Set([center, ...cells])).sort();
}
