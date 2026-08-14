"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserLimits } from "@/lib/subscription";

let cachedData: UserLimits | null = null;
let fetchPromise: Promise<UserLimits> | null = null;

async function fetchSubscription(): Promise<UserLimits> {
  const res = await fetch("/api/subscription/status");
  if (!res.ok) throw new Error("Failed to fetch subscription status");
  return res.json();
}

export function useSubscription() {
  const [data, setData] = useState<UserLimits | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      cachedData = null;
      fetchPromise = null;
      const result = await fetchSubscription();
      cachedData = result;
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchSubscription();
    }

    fetchPromise
      .then((result) => {
        cachedData = result;
        setData(result);
      })
      .finally(() => setLoading(false));
  }, []);

  const isUnlimited = (limit: number) => limit === -1;
  const isAtLimit = (current: number, max: number) => max !== -1 && current >= max;
  const usagePercent = (current: number, max: number) =>
    max === -1 ? 0 : Math.min(100, Math.round((current / max) * 100));

  return {
    data,
    loading,
    refresh,
    isUnlimited,
    isAtLimit,
    usagePercent,
    isPro: data?.plan.slug === "pro" || data?.plan.slug === "enterprise" || data?.plan.slug === "unlimited",
    isFree: data?.plan.slug === "free",
  };
}
