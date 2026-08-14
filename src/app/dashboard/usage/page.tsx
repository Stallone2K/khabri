"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { PlanBadge } from "@/components/subscription/plan-badge";
import { Loader2, ArrowUpRight, Ticket, AlertTriangle, Coins } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
} from "recharts";

interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

interface CreditData {
  balance: number;
  isUnlimited: boolean;
  last30Days: { spent: number; granted: number };
  series: { date: string; spent: number; granted: number }[];
  ledger: LedgerEntry[];
}

const REASON_LABELS: Record<string, string> = {
  signup_grant: "Signup Bonus",
  ingest_scan: "Trend Scan",
  narrative_discovery: "Narrative Discovery",
  api_usage: "API Usage",
  monthly_grant: "Monthly Grant",
  redeem_grant: "Redeem Bonus",
  plan_upgrade: "Plan Upgrade Bonus",
  proration_credit: "Unused Days Credit",
  refund: "Refund",
};

function useCredits() {
  const [credits, setCredits] = useState<CreditData | null>(null);
  useEffect(() => {
    fetch("/api/dashboard/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then(setCredits)
      .catch(() => setCredits(null));
  }, []);
  return credits;
}

export default function UsagePage() {
  const { data, loading } = useSubscription();
  const { data: session } = useSession();
  const credits = useCredits();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const user = data.user;

  // Format user ID as credit card number (groups of 4)
  const cardNumber = formatAsCardNumber(user?.id || session?.user?.id || "0000000000000000");

  // Real credit balance from the ledger (∞ for the unlimited plan)
  const totalCredits = credits
    ? credits.isUnlimited
      ? "UNLIMITED"
      : credits.balance.toLocaleString()
    : getCreditsDisplay(data.plan.slug, data.subscription.source);

  // Member since
  const memberSince = user?.memberSince
    ? new Date(user.memberSince).toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" })
    : "01/25";

  const holderName = (user?.name || session?.user?.name || "KHABRI USER").toUpperCase();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Usage</h1>
          <PlanBadge planSlug={data.plan.slug} planName={data.plan.name} />
        </div>
        {data.plan.slug !== "enterprise" && (
          <Link
            href="/pricing"
            className="flex items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
          >
            Upgrade
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Khabri Card — Black metal with signature diagonal */}
      <div className="relative w-full aspect-[1.586/1] max-w-xl mx-auto rounded-2xl overflow-hidden select-none group border border-zinc-600/50">
        {/* Pure black base */}
        <div className="absolute inset-0 bg-black" />

        {/* Signature diagonal slash — a subtle silver streak across the card */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            background: "linear-gradient(135deg, transparent 40%, #a1a1aa 50%, transparent 60%)",
          }}
        />

        {/* Bottom metallic edge */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-500/10 to-transparent" />


        {/* Card content */}
        <div className="relative h-full flex flex-col justify-between p-6 md:p-7">
          {/* Top row */}
          <div className="flex items-start justify-between">
            <SilverChip />
            <div className="flex items-center gap-3">
              <img src="/Lofo.png" alt="Khabri" className="h-7 w-7 rounded-md opacity-80" />
              <span className="font-[family-name:var(--font-forma)] text-xl font-bold tracking-[0.1em] bg-gradient-to-b from-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                Khabri
              </span>
            </div>
          </div>

          {/* Card number */}
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest">Card Number</p>
            <p className="text-lg md:text-xl font-mono tracking-[0.15em] bg-gradient-to-r from-zinc-300 to-zinc-500 bg-clip-text text-transparent">
              {cardNumber}
            </p>
          </div>

          {/* Bottom row */}
          <div className="flex items-end justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] text-zinc-700 uppercase tracking-widest">Card Holder</p>
              <p className="text-sm font-medium text-zinc-400 tracking-wide">{holderName}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-zinc-700 uppercase tracking-widest">Member Since</p>
              <p className="text-sm font-mono text-zinc-500">{memberSince}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-700 uppercase tracking-widest">Credits</p>
              <p className="text-lg font-mono font-semibold bg-gradient-to-b from-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                {totalCredits}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Redeem Code */}
      <RedeemCodeInput />

      {/* Divider */}
      {credits && !credits.isUnlimited && (
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
      )}

      {/* Credit Ledger */}
      {credits && !credits.isUnlimited && <CreditLedgerSection credits={credits} />}

      {/* Cancel Subscription — only for paid Razorpay users */}
      {data.subscription.source === "RAZORPAY" && data.subscription.status !== "CANCELLED" && (
        <>
          <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
          <CancelSubscriptionSection
            currentPeriodEnd={data.subscription.currentPeriodEnd}
          />
        </>
      )}
    </div>
  );
}

/** Formats a CUID/string as a credit card number: XXXX XXXX XXXX XXXX */
function formatAsCardNumber(id: string): string {
  // Take only alphanumeric, uppercase, pad to 16
  const cleaned = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().padEnd(16, "0").slice(0, 16);
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)} ${cleaned.slice(12, 16)}`;
}

/** Display credits based on plan tier */
function getCreditsDisplay(planSlug: string, source: string): string {
  if (source === "REDEEM_CODE" || planSlug === "unlimited") return "UNLIMITED";
  switch (planSlug) {
    case "pro": return "₹849";
    case "ultimate": return "₹1,299";
    case "enterprise": return "CUSTOM";
    default: return "₹0";
  }
}

/** Silver RFID chip SVG */
function SilverChip() {
  return (
    <svg width="52" height="40" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="35" height="27" rx="3.5" fill="url(#chip-silver)" stroke="#71717a" strokeWidth="0.5" />
      <line x1="12" y1="0" x2="12" y2="28" stroke="#71717a" strokeWidth="0.5" opacity="0.5" />
      <line x1="24" y1="0" x2="24" y2="28" stroke="#71717a" strokeWidth="0.5" opacity="0.5" />
      <line x1="0" y1="9" x2="36" y2="9" stroke="#71717a" strokeWidth="0.5" opacity="0.5" />
      <line x1="0" y1="19" x2="36" y2="19" stroke="#71717a" strokeWidth="0.5" opacity="0.5" />
      <rect x="12" y="9" width="12" height="10" rx="1" fill="none" stroke="#71717a" strokeWidth="0.5" opacity="0.7" />
      <defs>
        <linearGradient id="chip-silver" x1="0" y1="0" x2="36" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#71717a" />
          <stop offset="0.3" stopColor="#a1a1aa" />
          <stop offset="0.5" stopColor="#d4d4d8" />
          <stop offset="0.7" stopColor="#a1a1aa" />
          <stop offset="1" stopColor="#71717a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CreditLedgerSection({ credits }: { credits: CreditData }) {
  return (
    <div className="space-y-5">
      {/* Header + 30-day totals */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold tracking-tight">Credit Activity</h2>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            30d spent{" "}
            <span className="font-mono text-zinc-300">
              {credits.last30Days.spent.toLocaleString()}
            </span>
          </span>
          <span>
            30d granted{" "}
            <span className="font-mono text-emerald-400">
              {credits.last30Days.granted.toLocaleString()}
            </span>
          </span>
        </div>
      </div>

      {/* 30-day spend sparkline */}
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={credits.series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(d) => String(d)}
              formatter={(value: number, name: string) => [
                value,
                name === "spent" ? "Spent" : "Granted",
              ]}
            />
            <Area
              type="monotone"
              dataKey="spent"
              stroke="#a1a1aa"
              strokeWidth={1.5}
              fill="url(#spendGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ledger table */}
      {credits.ledger.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No credit activity yet — your ledger will appear here.
        </p>
      ) : (
        <div className="space-y-0.5">
          {credits.ledger.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-zinc-300 truncate">
                  {REASON_LABELS[entry.reason] ?? entry.reason}
                </span>
                {entry.refType && (
                  <span className="text-[10px] font-mono text-zinc-600 truncate hidden sm:inline">
                    {entry.refType}
                    {entry.refId ? `#${entry.refId.slice(-6)}` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}{" "}
                  {new Date(entry.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    entry.delta > 0 ? "text-emerald-400" : "text-zinc-400"
                  }`}
                >
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RedeemCodeInput() {
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/subscription/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to redeem code");
        return;
      }
      toast.success(result.message || "Code redeemed successfully!");
      setCode("");
      window.location.reload();
    } catch {
      toast.error("Failed to redeem code");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="flex items-center gap-3 max-w-xl mx-auto w-full">
      <div className="relative flex-1">
        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Enter Redeem Code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          className="w-full rounded-lg border border-border bg-transparent pl-10 pr-4 py-2.5 text-sm font-mono tracking-wider placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <button
        onClick={handleRedeem}
        disabled={redeeming || !code.trim()}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {redeeming ? "Redeeming..." : "Redeem"}
      </button>
    </div>
  );
}

function CancelSubscriptionSection({ currentPeriodEnd }: { currentPeriodEnd: string | Date | null }) {
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to cancel subscription");
        return;
      }
      toast.success(result.message || "Subscription cancelled.");
      setShowConfirm(false);
      window.location.reload();
    } catch {
      toast.error("Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const periodEndStr = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-400/70" />
        <h2 className="text-lg font-semibold tracking-tight text-red-400/70">Cancel Subscription</h2>
      </div>

      {!showConfirm ? (
        <div className="flex items-center justify-between rounded-lg border border-red-500/10 bg-red-500/5 px-4 py-4">
          <div>
            <p className="text-sm text-zinc-300">End your current subscription</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {periodEndStr
                ? `You'll retain access until ${periodEndStr}`
                : "You'll be downgraded to the Free plan"}
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Cancel Plan
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Are you sure?</p>
            <p className="text-xs text-muted-foreground mt-1">
              {periodEndStr
                ? `Your subscription will remain active until ${periodEndStr}, after which you'll be downgraded to the Free plan.`
                : "You'll immediately lose access to paid features and be downgraded to the Free plan."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Yes, Cancel Subscription"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Keep My Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
