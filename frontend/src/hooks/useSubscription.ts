"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SubscriptionWithPlan,
  getMySubscription,
} from "@/lib/billing-api";

/**
 * Module-level cache so multiple components on the same page share one
 * fetch. Reset by calling `refreshSubscription()`.
 */
let cached: SubscriptionWithPlan | null = null;
let inflight: Promise<SubscriptionWithPlan> | null = null;

async function loadOnce(): Promise<SubscriptionWithPlan> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = getMySubscription()
    .then((sub) => {
      cached = sub;
      return sub;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateSubscriptionCache() {
  cached = null;
}

export function useSubscription() {
  const [sub, setSub] = useState<SubscriptionWithPlan | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    invalidateSubscriptionCache();
    setLoading(true);
    try {
      const next = await loadOnce();
      setSub(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (cached) {
      setSub(cached);
      setLoading(false);
      return;
    }
    loadOnce()
      .then((s) => {
        if (!cancelled) {
          setSub(s);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Check whether the current tenant's plan allows a feature.
   *
   *   hasFeature("games")             -> boolean check
   *   hasFeature("projects", 5)       -> numeric minimum
   *   hasFeature("projects")          -> true if the key is not "off"
   */
  function hasFeature(key: string, minValue = 1): boolean {
    if (!sub) return false;
    const limit = sub.plan.limits?.[key];
    if (limit === undefined) return false;
    if (limit === null) return true; // unlimited
    if (typeof limit === "boolean") return limit;
    if (typeof limit === "number") return limit >= minValue;
    return false;
  }

  return {
    subscription: sub,
    plan: sub?.plan ?? null,
    limits: sub?.plan.limits ?? {},
    loading,
    error,
    hasFeature,
    refresh,
  };
}
