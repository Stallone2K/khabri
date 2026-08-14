"use client";

/**
 * Client-side Razorpay checkout. Loads checkout.js on demand, starts a
 * checkout (or applies an instant plan change for existing subscribers),
 * and verifies the payment with the server on success.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Failed To Load Razorpay Checkout"));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

export interface CheckoutOptions {
  planSlug: string;
  yearly: boolean;
  user?: { name?: string | null; email?: string | null };
  /** Called after a successful purchase, upgrade, or scheduled downgrade. */
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  /** Called when the user closes the payment sheet without paying. */
  onDismiss?: () => void;
}

export async function startCheckout(opts: CheckoutOptions): Promise<void> {
  const { planSlug, yearly, user, onSuccess, onError, onDismiss } = opts;

  let checkout: {
    error?: string;
    changed?: boolean;
    message?: string;
    subscriptionId?: string;
    keyId?: string;
  };
  try {
    const res = await fetch("/api/subscription/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug, yearly }),
    });
    checkout = await res.json();
    if (!res.ok) {
      onError(checkout.error || "Failed To Start Checkout");
      return;
    }
  } catch {
    onError("Failed To Start Checkout");
    return;
  }

  // Existing subscriber — plan change handled server-side, no modal needed.
  if (checkout.changed) {
    onSuccess(checkout.message || "Plan Updated!");
    return;
  }

  try {
    await loadCheckoutScript();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Failed To Load Razorpay Checkout");
    return;
  }
  if (!window.Razorpay) {
    onError("Razorpay Checkout Is Unavailable");
    return;
  }

  const razorpay = new window.Razorpay({
    key: checkout.keyId,
    subscription_id: checkout.subscriptionId,
    name: "Khabri",
    description: `${planSlug === "pro" ? "Pro" : "Ultimate"} Plan (${yearly ? "Yearly" : "Monthly"})`,
    // Absolute HTTPS URL — the checkout iframe is served from razorpay.com,
    // so relative paths (and http://localhost) can't render there.
    image: "https://khabri.shownomore.com/Lofo.png",
    theme: { color: "#0a0a0a" },
    prefill: {
      name: user?.name ?? undefined,
      email: user?.email ?? undefined,
    },
    modal: {
      ondismiss: () => onDismiss?.(),
    },
    handler: async (response: {
      razorpay_payment_id: string;
      razorpay_subscription_id: string;
      razorpay_signature: string;
    }) => {
      try {
        const res = await fetch("/api/subscription/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });
        const result = await res.json();
        if (!res.ok) {
          onError(result.error || "Payment Verification Failed");
          return;
        }
        onSuccess(result.message || "Subscription Activated!");
      } catch {
        onError("Payment Verification Failed");
      }
    },
  });
  razorpay.open();
}
