"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, Check, Loader2, Lock, Ticket } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { startCheckout } from "@/lib/razorpay-checkout";
import { useSubscription } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status } = useSession();
  const { data: sub } = useSubscription();

  const planSlug = params.get("plan") ?? "pro";
  const [yearly, setYearly] = useState(params.get("yearly") === "1");
  const [paying, setPaying] = useState(false);

  const plan = PLANS.find((p) => p.slug === planSlug && !p.contactSales && p.priceMonthly > 0);

  if (!plan) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">This Plan Cannot Be Purchased Online.</p>
        <a href="/pricing" className="text-sm text-emerald-400 hover:text-emerald-300">
          ← Back To Pricing
        </a>
      </div>
    );
  }

  const price = yearly ? plan.priceYearly : plan.priceMonthly;
  const period = yearly ? "Year" : "Month";
  const monthlyEquivalent = yearly ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
  const isCurrentPlan = sub?.plan.slug === plan.slug;
  const isPlanChange =
    sub && sub.subscription.source === "RAZORPAY" && sub.plan.slug !== "free" && !isCurrentPlan;

  function handlePay() {
    if (status === "unauthenticated") {
      signIn("google", { callbackUrl: `/checkout?plan=${plan!.slug}&yearly=${yearly ? 1 : 0}` });
      return;
    }
    setPaying(true);
    void startCheckout({
      planSlug: plan!.slug,
      yearly,
      user: session?.user,
      onSuccess: (message) => {
        setPaying(false);
        toast.success(message);
        setTimeout(() => router.push("/dashboard/usage"), 1200);
      },
      onError: (message) => {
        setPaying(false);
        toast.error(message);
      },
      onDismiss: () => setPaying(false),
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2.5 font-[family-name:var(--font-forma)] text-xl tracking-tight"
          >
            <img src="/Lofo.png" alt="Khabri" className="h-7 w-7 rounded-md" />
            Khabri
          </button>
          <a
            href="/pricing"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back To Pricing
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-10">
        <h1 className="font-[family-name:var(--font-forma)] text-3xl tracking-tight md:text-4xl">
          Checkout
        </h1>
        <p className="mt-2 font-[family-name:var(--font-fira-code)] text-[11px] tracking-wider text-emerald-400">
          ▲ SECURE CHANNEL · ENCRYPTED
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-[1.2fr_1fr]">
          {/* ─── Order Summary ─── */}
          <div className="rounded-none border border-zinc-800 bg-zinc-950 p-6">
            <p className="font-[family-name:var(--font-fira-code)] text-[10px] uppercase tracking-widest text-zinc-500">
              Order Summary
            </p>

            <div className="mt-4 flex items-start justify-between">
              <div>
                <h2 className="font-[family-name:var(--font-forma)] text-2xl tracking-tight">
                  Khabri {plan.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
              </div>
              <span className="border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 font-[family-name:var(--font-fira-code)] text-[10px] tracking-wider text-emerald-400">
                {yearly ? "YEARLY" : "MONTHLY"}
              </span>
            </div>

            {/* Billing period switch */}
            <div className="mt-5 inline-flex items-center border border-zinc-800 p-1">
              <button
                onClick={() => setYearly(false)}
                className={cn(
                  "px-3 py-1 font-[family-name:var(--font-fira-code)] text-[10px] uppercase tracking-wider transition-colors",
                  !yearly ? "bg-emerald-500 text-black" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setYearly(true)}
                className={cn(
                  "px-3 py-1 font-[family-name:var(--font-fira-code)] text-[10px] uppercase tracking-wider transition-colors",
                  yearly ? "bg-emerald-500 text-black" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Yearly · Save 17%
              </button>
            </div>

            <div className="my-5 border-t border-dashed border-zinc-800" />

            <p className="font-[family-name:var(--font-fira-code)] text-[11px] tracking-wide text-emerald-400">
              ▲ {plan.capacity}
            </p>
            <ul className="mt-4 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ─── Payment Panel ─── */}
          <div className="flex flex-col gap-4">
            <div className="rounded-none border border-zinc-800 bg-zinc-950 p-6">
              <p className="font-[family-name:var(--font-fira-code)] text-[10px] uppercase tracking-widest text-zinc-500">
                Billing Details
              </p>

              {status === "authenticated" ? (
                <div className="mt-4 flex items-center gap-3">
                  {session?.user?.image && (
                    <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm">{session?.user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  You'll Be Asked To Sign In Before Paying.
                </p>
              )}

              <div className="my-5 border-t border-dashed border-zinc-800" />

              <div className="space-y-2.5 font-[family-name:var(--font-fira-code)] text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Khabri {plan.name} × 1 {period}</span>
                  <span className="tabular-nums">₹{price.toLocaleString("en-IN")}</span>
                </div>
                {yearly && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Effective Monthly</span>
                    <span className="tabular-nums text-zinc-500">
                      ₹{monthlyEquivalent.toLocaleString("en-IN")}/Mo
                    </span>
                  </div>
                )}
                <div className="border-t border-dashed border-zinc-800 pt-2.5">
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Total Due Today</span>
                    <span className="tabular-nums text-emerald-400">
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                    Then ₹{price.toLocaleString("en-IN")} Every {period} · Cancel Anytime
                  </p>
                </div>
              </div>

              {isPlanChange && (
                <p className="mt-4 border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] leading-relaxed text-emerald-300">
                  You're Changing Plans — Your New Plan Starts Immediately And
                  Unused Days Of Your Current Plan Are Credited Back As Bonus
                  Credits.
                </p>
              )}

              {/* Pay CTA — dashed frame, same language as the pricing cards */}
              <button
                onClick={handlePay}
                disabled={paying || isCurrentPlan}
                className={cn(
                  "group mt-6 w-full rounded-none border border-dashed p-1 transition-colors",
                  isCurrentPlan
                    ? "cursor-default border-zinc-800"
                    : "border-emerald-500/50 hover:border-emerald-400",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-between border px-4 py-3 text-sm font-medium transition-colors",
                    isCurrentPlan
                      ? "border-zinc-800 text-muted-foreground"
                      : "border-emerald-500 bg-emerald-500 text-black group-hover:border-emerald-400 group-hover:bg-emerald-400",
                  )}
                >
                  {isCurrentPlan ? (
                    "This Is Your Current Plan"
                  ) : paying ? (
                    <>
                      Processing… <Loader2 className="h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      Pay ₹{price.toLocaleString("en-IN")} <ArrowUpRight className="h-4 w-4" />
                    </>
                  )}
                </span>
              </button>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500">
                <Lock className="h-3 w-3" />
                Payments Processed Securely Via Razorpay
              </p>
            </div>

            {/* Redeem code alternative */}
            <a
              href="/dashboard/usage"
              className="group flex items-center justify-between rounded-none border border-zinc-800 bg-zinc-950 px-5 py-4 transition-colors hover:border-zinc-600"
            >
              <div className="flex items-center gap-3">
                <Ticket className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-sm">Have A Redeem Code?</p>
                  <p className="text-xs text-muted-foreground">Apply It From Your Usage Page Instead</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-foreground" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
