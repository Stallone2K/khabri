/**
 * Static plan display data for the pricing page and cards.
 * Prices are display USD (DB stores paise — see prisma/seed-plans.ts).
 * The "unlimited" plan is redeem-code only and intentionally not listed here.
 */

export interface PlanInfo {
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  highlighted?: boolean;
  contactSales?: boolean;
  capacity: string;
  features: string[];
  limits: Record<string, string>;
}

export const PLANS: PlanInfo[] = [
  {
    slug: "free",
    name: "Free",
    description: "For Those Just Getting Started With News Intelligence",
    priceMonthly: 0,
    priceYearly: 0,
    capacity: "500 Credits On Signup",
    features: [
      "5 RSS Sources",
      "2 Tracked Trends",
      "500 Stored Articles",
      "1 API Key · 100 Calls/Day",
      "1 Narrative Discovery/Day",
      "Basic Market Data",
    ],
    limits: {
      sources: "5",
      projects: "2",
      articles: "500",
      apiKeys: "1",
      apiCalls: "100/Day",
      webhooks: "0",
      narratives: "1/Day",
      market: "Basic",
    },
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For Power Users Who Need Deeper, Faster Intelligence",
    priceMonthly: 849,
    priceYearly: 8499,
    capacity: "5,000 Credits / Month",
    features: [
      "25 RSS Sources",
      "10 Tracked Trends",
      "5,000 Stored Articles",
      "5 API Keys · 2,000 Calls/Day",
      "5 Webhooks",
      "10 Narrative Discoveries/Day",
      "Full Market Data",
      "Data Export (JSON + Markdown)",
    ],
    limits: {
      sources: "25",
      projects: "10",
      articles: "5,000",
      apiKeys: "5",
      apiCalls: "2,000/Day",
      webhooks: "5",
      narratives: "10/Day",
      market: "Full",
    },
  },
  {
    slug: "ultimate",
    name: "Ultimate",
    description: "Maximum Firepower For Serious Analysts And Builders",
    priceMonthly: 1299,
    priceYearly: 12999,
    highlighted: true,
    capacity: "25,000 Credits / Month",
    features: [
      "100 RSS Sources",
      "50 Tracked Trends",
      "25,000 Stored Articles",
      "20 API Keys · 10,000 Calls/Day",
      "20 Webhooks",
      "Unlimited Narrative Discovery",
      "Full Market Data",
      "Priority Support",
    ],
    limits: {
      sources: "100",
      projects: "50",
      articles: "25,000",
      apiKeys: "20",
      apiCalls: "10,000/Day",
      webhooks: "20",
      narratives: "Unlimited",
      market: "Full",
    },
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Custom Intelligence Infrastructure For Teams And Desks",
    priceMonthly: 0,
    priceYearly: 0,
    contactSales: true,
    capacity: "Custom Credit Allotments",
    features: [
      "Custom Limits On Everything",
      "Custom Rate Limits & SLA",
      "Dedicated Support Channel",
      "Custom Data Retention",
      "White-Glove Onboarding",
    ],
    limits: {
      sources: "Custom",
      projects: "Custom",
      articles: "Custom",
      apiKeys: "Custom",
      apiCalls: "Custom",
      webhooks: "Custom",
      narratives: "Custom",
      market: "Full",
    },
  },
];
