"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Shield } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { useAuthStore } from "@/store/authStore";
import {
  Plan,
  changeMySubscription,
  formatPrice,
  listAllPlans,
} from "@/lib/billing-api";
import {
  invalidateSubscriptionCache,
  useSubscription,
} from "@/hooks/useSubscription";

export default function AdminBillingPage() {
  const { user } = useAuthStore();
  const { subscription, plan: currentPlan, loading: subLoading, refresh } =
    useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") return;
    listAllPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [user]);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite">
        <div className="text-center max-w-md">
          <Shield className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">
            Only platform admins can access this page.
          </p>
          <Link
            href="/dashboard"
            className="text-terracotta-600 hover:text-terracotta-700 font-medium text-sm"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  async function switchPlan(slug: string) {
    if (slug === currentPlan?.slug) return;
    if (!confirm(`Switch this tenant to the ${slug} plan?`)) return;
    setSwitching(slug);
    try {
      await changeMySubscription({ plan_slug: slug });
      invalidateSubscriptionCache();
      await refresh();
      toast.success(`Switched to ${slug}`);
    } catch (e) {
      toast.error("Could not change plan", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-sm text-slate-500">Admin</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Billing &amp; plans
          </h1>
          <p className="mt-2 text-slate-500">
            Change the plan for this tenant. Historical subscriptions are
            preserved — the old row is marked <code>canceled</code>.
          </p>
        </div>

        {subLoading || plansLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-1">
                  Current plan
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {currentPlan?.name || "Unknown"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-1">
                  Status
                </div>
                <div className="text-sm font-medium text-slate-700 capitalize">
                  {subscription?.status || "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => {
                const isCurrent = p.slug === currentPlan?.slug;
                return (
                  <div
                    key={p.id}
                    className={clsx(
                      "bg-white border-2 rounded-xl p-5 flex flex-col",
                      isCurrent
                        ? "border-terracotta-400"
                        : "border-slate-200"
                    )}
                  >
                    <div className="mb-3 flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {p.name}
                        </h3>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-terracotta-700 bg-terracotta-50 border border-terracotta-200 px-2 py-0.5 rounded">
                            <Check className="w-3 h-3" strokeWidth={3} />
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mb-2">
                        {formatPrice(p)}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    <button
                      onClick={() => switchPlan(p.slug)}
                      disabled={isCurrent || switching === p.slug}
                      className={clsx(
                        "w-full px-3 py-2 rounded-lg text-sm font-medium transition",
                        isCurrent
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                      )}
                    >
                      {switching === p.slug ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : isCurrent ? (
                        "Active"
                      ) : (
                        `Switch to ${p.name}`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
