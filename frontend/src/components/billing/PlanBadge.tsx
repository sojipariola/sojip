"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import clsx from "clsx";

import { useSubscription } from "@/hooks/useSubscription";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-700 border-slate-200",
  pro: "bg-terracotta-50 text-terracotta-700 border-terracotta-200",
  institution: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function PlanBadge() {
  const { plan, loading } = useSubscription();

  if (loading || !plan) return null;

  const cls = PLAN_COLORS[plan.slug] || PLAN_COLORS.free;

  return (
    <Link
      href="/settings/plan"
      className={clsx(
        "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border hover:opacity-90 transition",
        cls
      )}
      title="View or change your plan"
    >
      <Sparkles className="w-3.5 h-3.5" />
      {plan.name}
    </Link>
  );
}
