"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  Minus,
} from "lucide-react";
import clsx from "clsx";

import { useAuthStore } from "@/store/authStore";
import { useSubscription } from "@/hooks/useSubscription";
import { limitLabel, formatPrice } from "@/lib/billing-api";

const LIMIT_ROWS: { key: string; label: string; suffix?: string }[] = [
  { key: "projects", label: "Projects" },
  { key: "ai_calls_per_day", label: "AI Mentor calls per day" },
  { key: "deployments", label: "Deployments" },
  { key: "peer_validations", label: "Peer validations required per gate" },
];

const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: "games", label: "Focus games" },
  { key: "teacher_notes", label: "Teacher notes" },
];

export default function MyPlanPage() {
  const { user } = useAuthStore();
  const { plan, loading } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite">
        <p className="text-slate-500 text-sm">No active plan found.</p>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  const isInstitution = plan.slug === "institution";

  return (
    <div className="min-h-screen bg-offwhite">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-sm text-slate-500">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Your plan
          </h1>
          <p className="mt-2 text-slate-500">
            Your plan determines what your whole institution can do.
          </p>
        </div>

        {/* Current plan card */}
        <div
          className={clsx(
            "bg-white border rounded-2xl p-8 mb-6",
            isInstitution
              ? "border-emerald-200"
              : plan.slug === "pro"
              ? "border-terracotta-200"
              : "border-slate-200"
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {isInstitution && (
                  <Crown className="w-5 h-5 text-emerald-600" />
                )}
                <span className="text-xs uppercase tracking-widest font-semibold text-slate-400">
                  Current plan
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {plan.name}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {plan.description || "No description"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-semibold text-slate-900">
                {formatPrice(plan)}
              </div>
            </div>
          </div>

          {isInstitution && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-900 leading-relaxed">
              <strong>Founding institution.</strong> Your Institution plan is
              free forever — you're one of the first twenty schools on SOJIP.
            </div>
          )}
        </div>

        {/* What you get */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              What your plan includes
            </h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {LIMIT_ROWS.map((row) => {
              const value = plan.limits?.[row.key];
              return (
                <li
                  key={row.key}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <span className="text-sm text-slate-700">{row.label}</span>
                  <span className="text-sm font-medium text-slate-900">
                    {limitLabel(value)}
                  </span>
                </li>
              );
            })}
            {FEATURE_ROWS.map((row) => {
              const value = plan.limits?.[row.key];
              const on = value === true;
              return (
                <li
                  key={row.key}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <span className="text-sm text-slate-700">{row.label}</span>
                  {on ? (
                    <Check
                      className="w-4 h-4 text-emerald-500"
                      strokeWidth={3}
                    />
                  ) : (
                    <Minus className="w-4 h-4 text-slate-300" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta-600 hover:text-terracotta-700"
          >
            Compare all plans →
          </Link>
          {isAdmin && !isInstitution && (
            <Link
              href="/admin/billing"
              className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
            >
              Change plan
            </Link>
          )}
          {isAdmin && isInstitution && (
            <Link
              href="/admin/billing"
              className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white transition"
            >
              Open admin console
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
