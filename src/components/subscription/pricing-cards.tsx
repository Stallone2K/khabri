"use client";

import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, type PlanInfo } from "@/lib/plans";

interface PricingCardsProps {
  currentPlan?: string;
  onSelectPlan?: (plan: PlanInfo) => void;
  yearly?: boolean;
}

export function PricingCards({ currentPlan, onSelectPlan, yearly }: PricingCardsProps) {
  return (
    <div className="grid gap-10 md:gap-5 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
      {PLANS.map((plan, i) => {
        const isCurrent = currentPlan === plan.slug;
        const price = yearly ? plan.priceYearly : plan.priceMonthly;
        const period = yearly ? "/Yr" : "/Mo";
        const previousPlan = i > 0 && !PLANS[i - 1].contactSales ? PLANS[i - 1] : null;

        return (
          <div key={plan.slug} className="flex flex-col">
            {/* Plan Name + Description — Above The Card */}
            <div className="mb-5 px-1">
              <h3 className="font-[family-name:var(--font-forma)] text-2xl tracking-tight">
                {plan.name}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground md:min-h-[2rem]">
                {plan.description}
              </p>
            </div>

            {/* Card */}
            <div
              className={cn(
                "flex flex-1 flex-col rounded-none border p-6",
                plan.highlighted
                  ? "border-emerald-500/60 bg-emerald-500/[0.06] shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]"
                  : "border-zinc-800 bg-zinc-950",
              )}
            >
              {/* Price */}
              {plan.contactSales ? (
                <div className="flex items-end">
                  <span className="font-[family-name:var(--font-fira-code)] text-4xl font-bold leading-none text-foreground">
                    Custom
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <span className="mt-1.5 text-sm text-muted-foreground">₹</span>
                  <span
                    className={cn(
                      "font-[family-name:var(--font-fira-code)] text-4xl xl:text-5xl font-bold tabular-nums leading-none",
                      plan.highlighted ? "text-emerald-400" : "text-foreground",
                    )}
                  >
                    {price.toLocaleString("en-IN")}
                  </span>
                  <span className="self-end pb-0.5 text-xs text-muted-foreground">
                    {period}
                  </span>
                </div>
              )}

              {/* Credit Capacity */}
              <p
                className={cn(
                  "mt-3 font-[family-name:var(--font-fira-code)] text-[11px] tracking-wide",
                  plan.highlighted ? "text-emerald-400" : "text-zinc-400",
                )}
              >
                ▲ {plan.capacity}
              </p>

              <div
                className={cn(
                  "my-5 border-t border-dashed",
                  plan.highlighted ? "border-emerald-500/30" : "border-zinc-800",
                )}
              />

              {/* Features */}
              <ul className="flex-1 space-y-3">
                {previousPlan && (
                  <li
                    className={cn(
                      "flex items-start gap-2.5 border-b border-dashed pb-3 text-sm font-medium",
                      plan.highlighted
                        ? "border-emerald-500/30 text-emerald-300"
                        : "border-zinc-800 text-zinc-300",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        plan.highlighted ? "text-emerald-400" : "text-zinc-400",
                      )}
                    />
                    <span>Everything In {previousPlan.name} Plan</span>
                  </li>
                )}
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA — Dashed Frame With Solid Inner Box */}
              <button
                onClick={() => onSelectPlan?.(plan)}
                disabled={isCurrent}
                className={cn(
                  "group mt-8 rounded-none border border-dashed p-1 transition-colors",
                  isCurrent
                    ? "cursor-default border-zinc-800"
                    : plan.highlighted
                      ? "border-emerald-500/50 hover:border-emerald-400"
                      : "border-zinc-700 hover:border-zinc-400",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-between border px-4 py-3 text-sm font-medium transition-colors",
                    isCurrent
                      ? "border-zinc-800 text-muted-foreground"
                      : plan.highlighted
                        ? "border-emerald-500 bg-emerald-500 text-black group-hover:bg-emerald-400 group-hover:border-emerald-400"
                        : "border-zinc-600 text-foreground group-hover:border-zinc-300",
                  )}
                >
                  {isCurrent
                    ? "Current Plan"
                    : plan.contactSales
                      ? "Talk To Sales"
                      : price === 0
                        ? "Get Started Free"
                        : "Subscribe Now"}
                  {!isCurrent && <ArrowUpRight className="h-4 w-4" />}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
