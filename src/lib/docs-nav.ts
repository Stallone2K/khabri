export interface NavItem {
  title: string;
  href: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const docsNav: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Authentication", href: "/docs/authentication" },
      { title: "Rate Limiting", href: "/docs/rate-limiting" },
      { title: "Errors", href: "/docs/errors" },
    ],
  },
  {
    title: "Trends",
    items: [
      { title: "Overview", href: "/docs/trends" },
      { title: "List Trends", href: "/docs/trends/list-trends", method: "GET" },
      { title: "Top Trends", href: "/docs/trends/top-trends", method: "GET" },
      { title: "Get Trend", href: "/docs/trends/get-trend", method: "GET" },
    ],
  },
  {
    title: "Signals",
    items: [
      { title: "Overview", href: "/docs/signals" },
      { title: "List Signals", href: "/docs/signals/list-signals", method: "GET" },
      { title: "Search Signals", href: "/docs/signals/search-signals", method: "GET" },
      { title: "Get Signal", href: "/docs/signals/get-signal", method: "GET" },
    ],
  },
  {
    title: "Anomalies",
    items: [
      { title: "Overview", href: "/docs/anomalies" },
      { title: "List Anomalies", href: "/docs/anomalies/list-anomalies", method: "GET" },
      { title: "Trending Anomalies", href: "/docs/anomalies/trending-anomalies", method: "GET" },
    ],
  },
  {
    title: "Narratives",
    items: [
      { title: "Overview", href: "/docs/narratives" },
      { title: "List Narratives", href: "/docs/narratives/list-narratives", method: "GET" },
      { title: "Get Narrative", href: "/docs/narratives/get-narrative", method: "GET" },
      { title: "Timeline", href: "/docs/narratives/narrative-timeline", method: "GET" },
      { title: "Stakeholders", href: "/docs/narratives/narrative-stakeholders", method: "GET" },
    ],
  },
  {
    title: "Geo",
    items: [
      { title: "Overview", href: "/docs/geo" },
      { title: "Search", href: "/docs/geo/geo-search", method: "GET" },
      { title: "Hotspots", href: "/docs/geo/geo-hotspots", method: "GET" },
      { title: "Country Intel", href: "/docs/geo/country-intel", method: "GET" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { title: "Overview", href: "/docs/analytics" },
      { title: "Signal Volume", href: "/docs/analytics/signal-volume", method: "GET" },
      { title: "Categories", href: "/docs/analytics/category-distribution", method: "GET" },
      { title: "Sentiment", href: "/docs/analytics/sentiment-analysis", method: "GET" },
    ],
  },
  {
    title: "Webhooks",
    items: [
      { title: "Overview", href: "/docs/webhooks" },
      { title: "Create Webhook", href: "/docs/webhooks/create-webhook", method: "POST" },
      { title: "List Webhooks", href: "/docs/webhooks/list-webhooks", method: "GET" },
      { title: "Get Webhook", href: "/docs/webhooks/get-webhook", method: "GET" },
      { title: "Delete Webhook", href: "/docs/webhooks/delete-webhook", method: "DELETE" },
    ],
  },
  {
    title: "Stream",
    items: [
      { title: "Real-Time Events", href: "/docs/stream", method: "GET" },
    ],
  },
];

export function flattenNav(): NavItem[] {
  return docsNav.flatMap((section) => section.items);
}

export function findNavNeighbors(href: string) {
  const flat = flattenNav();
  const index = flat.findIndex((item) => item.href === href);
  return {
    prev: index > 0 ? flat[index - 1] : null,
    next: index < flat.length - 1 ? flat[index + 1] : null,
  };
}
