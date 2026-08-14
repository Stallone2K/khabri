import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Same-origin proxy for map tiles/glyphs: avoids browser CORS and
      // broken-IPv6 clients, and is the seam where self-hosted tiles
      // (martin/PMTiles) slot in later without touching the globe style.
      {
        source: "/map-tiles/:path*",
        destination: "https://tiles.openfreemap.org/:path*",
      },
    ];
  },
};

export default nextConfig;
