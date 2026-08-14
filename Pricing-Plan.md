# Khabri: Pricing & Subscription — Current State Assessment

## Context

The pricing/subscription feature was left mid-implementation. This document assesses what's done, what's missing, and what's needed to go live.

---

## Overall Completion: ~85%

The backend is essentially complete. The critical gap is the **client-side Razorpay checkout flow** — users literally cannot pay yet.

---

## What's DONE (Working)

| Component | Files | Notes |
|-----------|-------|-------|
| Database schema | `prisma/schema.prisma` | Plan, Subscription, RedeemCode, Redemption models — complete |
| Plan definitions | `src/lib/plans.ts` | Free, Pro (₹500/mo), Enterprise (₹1900/mo), Unlimited |
| Subscription utilities | `src/lib/subscription.ts` | `getUserPlan()`, `getUserLimits()`, `checkLimit()` — all working |
| Plan limit enforcement | `src/lib/api-middleware.ts`, webhook route | API rate limits clamped to plan's `maxApiCallsPerDay` |
| Pricing page UI | `src/app/pricing/page.tsx` | Full page with cards, comparison table, billing toggle |
| Usage dashboard | `src/app/dashboard/usage/page.tsx` | "Khabri Card" UI, 6 usage meters, redeem input, cancel button |
| Settings billing tab | `src/components/dashboard/settings-dialog.tsx` | Plan badge, usage meters, redeem code input |
| Sidebar plan badge | `src/components/dashboard/app-sidebar.tsx` | Shows plan tier next to username |
| Subscription hook | `src/hooks/use-subscription.ts` | Client-side caching, dedup, helper methods |
| API: `/subscription/status` | `src/app/api/subscription/status/` | Returns plan + limits + usage |
| API: `/subscription/checkout` | `src/app/api/subscription/checkout/` | Creates Razorpay subscription (backend ready) |
| API: `/subscription/cancel` | `src/app/api/subscription/cancel/` | End-of-period cancellation |
| API: `/subscription/redeem` | `src/app/api/subscription/redeem/` | Full validation, atomic transactions |
| API: `/subscription/invoices` | `src/app/api/subscription/invoices/` | Fetches from Razorpay API |
| Razorpay webhook handler | `src/app/api/webhooks/razorpay/` | Handles activated, charged, pending, halted, cancelled |
| Razorpay SDK | `src/lib/razorpay.ts` | Singleton instance + webhook signature verification |
| Seed script | `prisma/seed-plans.ts` | 4 plans + 3 redeem codes |
| UI components | `src/components/subscription/` | PricingCards, PlanBadge, UsageMeter |

---

## What's MISSING (Blockers to Go Live)

### 1. Client-Side Razorpay Checkout Modal (CRITICAL)

**The #1 blocker.** No frontend component exists to:
- Call `/api/subscription/checkout` to get a Razorpay subscription ID
- Load Razorpay's checkout.js script
- Open the Razorpay payment modal with the subscription ID
- Handle success/failure callbacks
- Redirect user after successful payment

**Where it should be wired**: Pricing page "Subscribe" buttons + Settings dialog "Upgrade" button

### 2. Razorpay Environment Variables (CRITICAL)

These env vars are referenced in code but not configured:
```
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
RAZORPAY_PLAN_PRO_MONTHLY
RAZORPAY_PLAN_PRO_YEARLY
RAZORPAY_PLAN_ENTERPRISE_MONTHLY
RAZORPAY_PLAN_ENTERPRISE_YEARLY
```
**Action needed**: Create plans in Razorpay dashboard, get plan IDs, add to `.env`

### 3. Session `planSlug` Not Populated

- `pricing/page.tsx` and `app-sidebar.tsx` read `session.user.planSlug`
- NextAuth JWT/session callbacks likely don't include this field
- **Fix**: Add `planSlug` to NextAuth callbacks or fetch it separately

### 4. Invoice UI (NICE TO HAVE)

- Backend endpoint exists (`/api/subscription/invoices`)
- No UI to display invoice history or download links

---

## Parallel WIP: Feeds Feature

A full **Feeds** feature is also being built in parallel (untracked):
- Dashboard page with 3 tabs (Feeds, Discover, Trending)
- RSS ingestion, article state management, infinite scroll
- 6 API routes + cron job + components
- **Integration point**: Feeds usage is gated by subscription plan limits

---

## Steps to Make Pricing Live

### Step 0: Fix Database Connection (FIRST)

**Problem**: Local `.env` still points to Neon DB. All Prisma operations (migrate, db push, seed) hit Neon instead of self-hosted Postgres on GCP.

**Fix**:
1. Update `DATABASE_URL` in `.env` to point to self-hosted Postgres on GCP VM (34.47.213.135)
   - Format: `postgresql://USER:PASSWORD@34.47.213.135:5432/khabri?schema=public`
   - Ensure Postgres on GCP allows connections from your local IP (check `pg_hba.conf` and firewall rules)
2. Optionally set up an SSH tunnel if direct access isn't exposed:
   ```bash
   ssh -L 5433:localhost:5432 user@34.47.213.135
   # Then use: postgresql://USER:PASSWORD@localhost:5433/khabri
   ```
3. Run `prisma db push` or `prisma migrate deploy` to sync schema to self-hosted DB
4. Run seed script: `npx tsx prisma/seed-plans.ts`
5. Delete or archive the Neon project to avoid confusion

### Step 1: Razorpay Account Setup (Manual)

- Create subscription plans in Razorpay dashboard (Pro monthly/yearly, Enterprise monthly/yearly)
- Get API keys (key_id, key_secret)
- Configure webhook URL: `https://khabri.shownomore.com/api/webhooks/razorpay`
- Set webhook secret
- Add all env vars to production `.env`

### Step 2: Build Checkout Component

- Create `src/components/subscription/checkout-modal.tsx`
- Load Razorpay checkout.js script dynamically
- Wire it to pricing page buttons and settings upgrade button
- Handle payment success → refresh subscription status
- Handle payment failure → show error message

### Step 3: Fix Session planSlug

- Check NextAuth config (`src/app/api/auth/[...nextauth]/` or `src/lib/auth.ts`)
- Add `planSlug` to JWT callback (query from Subscription table)
- Or: rely on `useSubscription()` hook instead of session (simpler)

### Step 4: Run Database Seed

- Run `prisma db seed` or `npx tsx prisma/seed-plans.ts` to create plans + redeem codes

### Step 5: Test End-to-End

- Test free tier limits work
- Test redeem code flow (already working)
- Test Razorpay checkout → webhook → plan upgrade flow
- Test cancellation flow
- Test plan downgrade on subscription.halted webhook

### Step 6: Commit & Deploy

- All subscription + feeds code is uncommitted
- Needs a clean commit (or multiple feature commits)
- Deploy to GCP server via PM2

---

## Verification Plan

1. Create a test user, verify free plan limits
2. Redeem a code → verify plan upgrade + limits change
3. (After Razorpay setup) Complete checkout → verify webhook fires → plan activates
4. Cancel subscription → verify end-of-period behavior
5. Check usage page reflects all changes in real-time
