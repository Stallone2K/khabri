/**
 * Khabri terminal globe style — black ocean, phosphor-green land strokes,
 * built on OpenFreeMap vector tiles (OpenMapTiles schema). No API key.
 */
export const GLOBE_GREEN = "#3dff8f";
export const GLOBE_GREEN_DIM = "#1a7a4a";

export function makeGlobeStyle(): any {
  // MapLibre resolves TileJSON/glyph URLs against nothing — they must be
  // absolute. Client-only component, so window is available.
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return {
    version: 8,
    projection: { type: "globe" },
    glyphs: `${origin}/map-tiles/fonts/{fontstack}/{range}.pbf`,
    sky: {
      // Thin phosphor halo at the sphere's edge only — fog-ground-blend kept
      // near zero: higher values blanket the whole sphere and hide every layer.
      "sky-color": "#000000",
      "horizon-color": "#0f5c38",
      "fog-color": "#020604",
      "sky-horizon-blend": 0.8,
      "horizon-fog-blend": 0.3,
      "fog-ground-blend": 0.1,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 5, 0],
    },
    sources: {
      ofm: { type: "vector", url: `${origin}/map-tiles/planet` },
      heat: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      radius: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      anomalies: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      // Land = background, water drawn darker on top → coastlines pop.
      { id: "bg-land", type: "background", paint: { "background-color": "#0c2015" } },
      {
        id: "water",
        type: "fill",
        source: "ofm",
        "source-layer": "water",
        paint: { "fill-color": "#02090a" },
      },
      {
        id: "boundary-country",
        type: "line",
        source: "ofm",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        paint: {
          "line-color": GLOBE_GREEN,
          "line-opacity": 0.5,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 6, 1.4],
        },
      },
      {
        id: "boundary-state",
        type: "line",
        source: "ofm",
        "source-layer": "boundary",
        minzoom: 3,
        filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
        paint: {
          "line-color": GLOBE_GREEN_DIM,
          "line-opacity": 0.25,
          "line-width": 0.6,
          "line-dasharray": [2, 2],
        },
      },
      {
        id: "place-country",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        minzoom: 2,
        maxzoom: 7,
        filter: ["==", ["get", "class"], "country"],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 13],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.15,
        },
        paint: {
          "text-color": GLOBE_GREEN,
          "text-opacity": 0.55,
          "text-halo-color": "#000000",
          "text-halo-width": 1.2,
        },
      },
      {
        id: "place-city",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        minzoom: 4.5,
        filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 9, 10, 12],
        },
        paint: {
          "text-color": "#9fffce",
          "text-opacity": 0.7,
          "text-halo-color": "#000000",
          "text-halo-width": 1,
        },
      },
      // --- data layers (sources injected at runtime) ---
      {
        id: "heat",
        type: "heatmap",
        source: "heat",
        maxzoom: 9,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 1, 0.25, 50, 0.7, 500, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1.4, 9, 3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 4, 22, 9, 40],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.15, "rgba(10,60,35,0.45)",
            0.4, "rgba(25,140,80,0.6)",
            0.7, "rgba(61,255,143,0.75)",
            1, "rgba(190,255,220,0.95)",
          ],
        },
      },
      {
        // Visible dots at high zoom; near-invisible hit-targets at low zoom so
        // heatpoints are clickable everywhere.
        id: "heat-points",
        type: "circle",
        source: "heat",
        paint: {
          "circle-color": GLOBE_GREEN,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.25, 5, 0.4, 6, 0.7],
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            0, ["interpolate", ["linear"], ["get", "count"], 1, 1.5, 500, 4],
            6, ["interpolate", ["linear"], ["get", "count"], 1, 3, 100, 9, 1000, 16],
          ],
          "circle-stroke-color": "#000",
          "circle-stroke-width": ["step", ["zoom"], 0, 6, 1],
        },
      },
      {
        id: "anomaly-halo",
        type: "circle",
        source: "anomalies",
        paint: {
          "circle-color": "#ff8c1a",
          "circle-opacity": 0.18,
          "circle-radius": ["interpolate", ["linear"], ["get", "zScore"], 1.5, 12, 3, 22, 6, 34],
        },
      },
      {
        id: "anomaly-core",
        type: "circle",
        source: "anomalies",
        paint: {
          "circle-color": [
            "match", ["get", "severity"],
            "CRITICAL", "#ff3b3b",
            "HIGH", "#ff8c1a",
            "#ffd23b",
          ],
          "circle-opacity": 0.9,
          "circle-radius": 4,
          "circle-stroke-color": "#000",
          "circle-stroke-width": 1,
        },
      },
      {
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: { "fill-color": GLOBE_GREEN, "fill-opacity": 0.06 },
      },
      {
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: {
          "line-color": GLOBE_GREEN,
          "line-opacity": 0.8,
          "line-width": 1.5,
          "line-dasharray": [3, 2],
        },
      },
    ],
  };
}

export const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;
