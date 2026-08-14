import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Razorpay server-side helpers. All functions degrade gracefully when the
 * RAZORPAY_* env vars are absent (payments simply report "not configured").
 *
 * Required env:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 *   RAZORPAY_PLAN_PRO_MONTHLY, RAZORPAY_PLAN_PRO_YEARLY
 *   RAZORPAY_PLAN_ULTIMATE_MONTHLY, RAZORPAY_PLAN_ULTIMATE_YEARLY
 */

let instance: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpay(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return instance;
}

const PLAN_ENV_KEYS: Record<string, { monthly: string; yearly: string }> = {
  pro: { monthly: "RAZORPAY_PLAN_PRO_MONTHLY", yearly: "RAZORPAY_PLAN_PRO_YEARLY" },
  ultimate: { monthly: "RAZORPAY_PLAN_ULTIMATE_MONTHLY", yearly: "RAZORPAY_PLAN_ULTIMATE_YEARLY" },
};

/** Razorpay plan id for a khabri plan slug + billing period, or null. */
export function getRazorpayPlanId(slug: string, yearly: boolean): string | null {
  const keys = PLAN_ENV_KEYS[slug];
  if (!keys) return null;
  return process.env[yearly ? keys.yearly : keys.monthly] || null;
}

/** Reverse lookup: khabri plan slug for a Razorpay plan id. */
export function slugForRazorpayPlanId(planId: string): { slug: string; yearly: boolean } | null {
  for (const [slug, keys] of Object.entries(PLAN_ENV_KEYS)) {
    if (process.env[keys.monthly] === planId) return { slug, yearly: false };
    if (process.env[keys.yearly] === planId) return { slug, yearly: true };
  }
  return null;
}

/** Verify the signature returned by Razorpay Checkout after payment. */
export function verifyCheckoutSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
): boolean {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Verify the X-Razorpay-Signature header on webhook deliveries. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
