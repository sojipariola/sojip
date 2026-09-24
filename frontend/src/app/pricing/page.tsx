"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Crown, Loader2, Sparkles } from "lucide-react";
import clsx from "clsx";

import { Plan, formatPrice, limitLabel, listPublicPlans } from "@/lib/billing-api";

const CARD_META: Record<
  string,
  { accent: string; badge: string | null; cta: string }
> = {
  free: {
    accent: "border-slate-200",
    badge: null,
    cta: "Start free",
  },
  pro: {
    accent: "border-terracotta-300",
    badge: "Most popular",
    cta: "Upgrade to Pro",
  },
  institution: {
    accent: "border-emerald-300",
    badge: "For schools",
    cta: "Talk to us",
  },
};

const LIMIT_KEYS: { key: string; label: string }[] = [
  { key: "projects", label: "Projects" },
  { key: "ai_calls_per_day", label: "AI Mentor calls / day" },
  { key: "deployments", label: "Deployments" },
  { key: "peer_validations", label: "Peer validations per gate" },
];

const FEATURE_KEYS: { key: string; label: string }[] = [
  { key: "games", label: "Focus games" },
  { key: "teacher_notes", label: "Teacher notes" },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPublicPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-offwhite">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terracotta-50 border border-terracotta-200 text-terracotta-700 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Pick the plan that fits
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">
            Simple, honest pricing
          </h1>
          <p className="text-slate-500">
            Every plan unlocks the full seven-phase journey. Plans differ in
            how much you can build and how much guidance you get.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const meta =
                CARD_META[plan.slug] || CARD_META.free;
              const isInstitution = plan.slug === "institution";
              return (
                <div
                  key={plan.id}
                  className={clsx(
                    "relative bg-white border-2 rounded-2xl p-6 flex flex-col",
                    meta.accent
                  )}
                >
                  {meta.badge && (
                    <div
                      className={clsx(
                        "absolute -top-3 left-6 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full",
                        isInstitution
                          ? "bg-emerald-500 text-white"
                          : "bg-terracotta-500 text-white"
                      )}
                    >
                      {isInstitution && <Crown className="w-3 h-3" />}
                      {meta.badge}
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-900 mb-1">
                      {plan.name}
                    </h2>
                    <p className="text-sm text-slate-500 min-h-[40px]">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-6">
                    <div className="text-3xl font-bold tracking-tight text-slate-900">
                      {formatPrice(plan)}
                    </div>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {LIMIT_KEYS.map((row) => (
                      <li
                        key={row.key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600">{row.label}</span>
                        <span className="font-medium text-slate-900">
                          {limitLabel(plan.limits?.[row.key])}
                        </span>
                      </li>
                    ))}
                    {FEATURE_KEYS.map((row) => {
                      const on = plan.limits?.[row.key] === true;
                      return (
                        <li
                          key={row.key}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-slate-600">{row.label}</span>
                          {on ? (
                            <Check
                              className="w-4 h-4 text-emerald-500"
                              strokeWidth={3}
                            />
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={isInstitution ? "/contact" : "/register"}
                    className={clsx(
                      "block text-center px-4 py-2.5 rounded-lg text-sm font-medium transition",
                      isInstitution
                        ? "border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                        : plan.slug === "pro"
                        ? "bg-terracotta-600 text-white hover:bg-terracotta-700"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    {meta.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-10">
          The first 20 schools get Institution free forever. Contact us to
          claim a spot.
        </p>
      </section>
    </main>
  );
}
