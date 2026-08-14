"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { PricingCards } from "@/components/subscription/pricing-cards";
import { PLANS, type PlanInfo } from "@/lib/plans";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const COMPARISON_ROWS = [
  { label: "RSS Sources", key: "sources" },
  { label: "Tracked Trends", key: "projects" },
  { label: "Stored Articles", key: "articles" },
  { label: "API Keys", key: "apiKeys" },
  { label: "API Calls", key: "apiCalls" },
  { label: "Webhooks", key: "webhooks" },
  { label: "Narrative Discovery", key: "narratives" },
  { label: "Market Data", key: "market" },
];

/** Decorative Terminal-Style Chart — Bloomberg Vibes */
function TerminalChart() {
  return (
    <div className="hidden lg:block select-none border border-zinc-800 bg-zinc-950 p-4 w-[300px]">
      <div className="flex items-center justify-between font-[family-name:var(--font-fira-code)] text-[10px] tracking-widest">
        <span className="text-emerald-400">KHBR · LIVE</span>
        <span className="text-zinc-500">24/7 INTEL</span>
      </div>
      <svg viewBox="0 0 260 90" className="mt-3 w-full">
        {/* Grid */}
        {[0, 22.5, 45, 67.5, 90].map((y) => (
          <line key={y} x1="0" y1={y} x2="260" y2={y} stroke="#27272a" strokeWidth="0.5" />
        ))}
        {[0, 52, 104, 156, 208, 260].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="90" stroke="#27272a" strokeWidth="0.5" />
        ))}
        {/* Area */}
        <path
          d="M0,70 L26,64 L52,66 L78,52 L104,56 L130,40 L156,44 L182,28 L208,32 L234,16 L260,10 L260,90 L0,90 Z"
          fill="url(#pricing-chart-fill)"
        />
        {/* Line */}
        <path
          d="M0,70 L26,64 L52,66 L78,52 L104,56 L130,40 L156,44 L182,28 L208,32 L234,16 L260,10"
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
        />
        <circle cx="260" cy="10" r="2.5" fill="#10b981" />
        <defs>
          <linearGradient id="pricing-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-3 flex items-center justify-between font-[family-name:var(--font-fira-code)] text-[10px]">
        <span className="text-zinc-500">SIGNALS TRACKED</span>
        <span className="text-emerald-400">▲ +327%</span>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [yearly, setYearly] = useState(false);

  const planSlug = (session?.user as { planSlug?: string } | undefined)?.planSlug;

  function handleSelectPlan(plan: PlanInfo) {
    if (plan.contactSales) {
      window.location.href =
        "mailto:dev@shownomore.com?subject=Khabri%20Enterprise%20Plan";
      return;
    }

    if (status === "unauthenticated") {
      signIn("google", { callbackUrl: "/pricing" });
      return;
    }

    if (plan.slug === "free") {
      router.push("/dashboard");
      return;
    }

    // Paid plans — go to the Khabri checkout page
    router.push(`/checkout?plan=${plan.slug}&yearly=${yearly ? 1 : 0}`);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header>
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2.5 font-[family-name:var(--font-forma)] text-xl tracking-tight"
          >
            <img src="/Lofo.png" alt="Khabri" className="h-7 w-7 rounded-md" />
            Khabri
          </button>
          {status === "authenticated" ? (
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-none border border-zinc-700 px-4 py-2 text-sm font-medium hover:border-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-none border border-zinc-700 px-4 py-2 text-sm font-medium hover:border-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Hero — Left Aligned With Terminal Chart */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-14 md:pt-20">
        <div className="flex items-start justify-between gap-12">
          <div className="max-w-xl">
            <h1 className="font-[family-name:var(--font-forma)] text-4xl md:text-6xl leading-[1.05] tracking-tight">
              The Right Plan
              <br />
              For Your <span className="text-emerald-400">Intel.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
              Solo Analyst Or Enterprise Desk — Pay For What You Need. Start
              Free, Scale As Your Intelligence Needs Grow, And Cancel Any Time.
            </p>

            {/* Billing Toggle — Terminal Style */}
            <div className="mt-8 inline-flex items-center border border-zinc-800 p-1">
              <button
                onClick={() => setYearly(false)}
                className={cn(
                  "px-4 py-1.5 font-[family-name:var(--font-fira-code)] text-xs tracking-wider uppercase transition-colors",
                  !yearly
                    ? "bg-emerald-500 text-black"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setYearly(true)}
                className={cn(
                  "px-4 py-1.5 font-[family-name:var(--font-fira-code)] text-xs tracking-wider uppercase transition-colors",
                  yearly
                    ? "bg-emerald-500 text-black"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Yearly
              </button>
              <span className="px-3 font-[family-name:var(--font-fira-code)] text-[10px] text-emerald-400">
                ▲ Save 17%
              </span>
            </div>
          </div>

          <TerminalChart />
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <PricingCards
          currentPlan={planSlug}
          onSelectPlan={handleSelectPlan}
          yearly={yearly}
        />
      </section>

      {/* Feature Comparison Table */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="mb-8 text-center font-[family-name:var(--font-forma)] text-2xl tracking-tight">
          Compare Plans
        </h2>
        <div className="overflow-x-auto border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950">
                <th className="py-3 pl-4 pr-4 text-left font-medium text-muted-foreground">Feature</th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.slug}
                    className={cn(
                      "py-3 px-4 text-center font-medium",
                      plan.highlighted && "text-emerald-400",
                    )}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-zinc-800/60">
                  <td className="py-3 pl-4 pr-4 text-muted-foreground">{row.label}</td>
                  {PLANS.map((plan) => {
                    const value = plan.limits[row.key];
                    return (
                      <td
                        key={plan.slug}
                        className="py-3 px-4 text-center font-[family-name:var(--font-fira-code)] text-xs"
                      >
                        {value === "0" ? (
                          <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />
                        ) : (
                          <span className="text-foreground">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Boolean Features */}
              <tr className="border-b border-zinc-800/60">
                <td className="py-3 pl-4 pr-4 text-muted-foreground">Data Export</td>
                <td className="py-3 px-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground/50" /></td>
                <td className="py-3 px-4 text-center"><Check className="mx-auto h-4 w-4 text-emerald-400" /></td>
                <td className="py-3 px-4 text-center"><Check className="mx-auto h-4 w-4 text-emerald-400" /></td>
                <td className="py-3 px-4 text-center"><Check className="mx-auto h-4 w-4 text-emerald-400" /></td>
              </tr>
              <tr>
                <td className="py-3 pl-4 pr-4 text-muted-foreground">Priority Support</td>
                <td className="py-3 px-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground/50" /></td>
                <td className="py-3 px-4 text-center"><Minus className="mx-auto h-4 w-4 text-muted-foreground/50" /></td>
                <td className="py-3 px-4 text-center"><Check className="mx-auto h-4 w-4 text-emerald-400" /></td>
                <td className="py-3 px-4 text-center"><Check className="mx-auto h-4 w-4 text-emerald-400" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center font-[family-name:var(--font-fira-code)] text-xs text-muted-foreground">
        <p>All Prices In INR · Payments Processed Securely Via Razorpay</p>
      </footer>
    </div>
  );
}
