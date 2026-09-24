import { apiFetch } from "./api-client";

export type Plan = {
  id: string;
  slug: "free" | "pro" | "institution" | string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: "month" | "year" | string;
  limits: Record<string, number | boolean | null>;
  is_active: boolean;
  sort_order: number;
};

export type Subscription = {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: "active" | "trialing" | "past_due" | "canceled" | string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionWithPlan = Subscription & { plan: Plan };

/** Public. No auth required. */
export function listPublicPlans() {
  return apiFetch<Plan[]>("/plans");
}

/** Admin-only. Includes inactive plans. */
export function listAllPlans() {
  return apiFetch<Plan[]>("/plans/all");
}

export function updatePlan(
  slug: string,
  payload: Partial<{
    name: string;
    description: string | null;
    price_cents: number;
    limits: Record<string, number | boolean | null>;
    is_active: boolean;
    sort_order: number;
  }>
) {
  return apiFetch<Plan>(`/plans/${slug}`, {
    method: "PATCH",
    body: payload,
  });
}

export function getMySubscription() {
  return apiFetch<SubscriptionWithPlan>("/subscriptions/me");
}

export function changeMySubscription(payload: {
  plan_slug: string;
  status?: string;
  note?: string;
}) {
  return apiFetch<SubscriptionWithPlan>("/subscriptions/me", {
    method: "PATCH",
    body: payload,
  });
}

export function getTenantSubscription(tenantId: string) {
  return apiFetch<SubscriptionWithPlan>(`/subscriptions/tenant/${tenantId}`);
}

// ─── Helpers ─────────────────────────────────────────────
export function formatPrice(plan: Plan): string {
  if (plan.price_cents === 0) return "Free";
  const major = plan.price_cents / 100;
  const symbol = plan.currency === "usd" ? "$" : plan.currency.toUpperCase() + " ";
  return `${symbol}${major.toFixed(major % 1 === 0 ? 0 : 2)}/${plan.billing_interval}`;
}

export function limitLabel(value: number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "Unlimited";
  if (typeof value === "boolean") return value ? "Included" : "Not included";
  return String(value);
}
