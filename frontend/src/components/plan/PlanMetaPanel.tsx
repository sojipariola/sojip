"use client";

import { useState } from "react";
import { Calendar, Loader2, Save } from "lucide-react";

interface Props {
  deadline: string | null;
  budgetDays: number | null;
  locked: boolean;
  onSave: (payload: { deadline: string | null; budget_days: number | null }) => Promise<void>;
}

export function PlanMetaPanel({ deadline, budgetDays, locked, onSave }: Props) {
  const [draftDeadline, setDraftDeadline] = useState(deadline || "");
  const [draftBudget, setDraftBudget] = useState(budgetDays?.toString() || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        deadline: draftDeadline || null,
        budget_days: draftBudget ? parseInt(draftBudget, 10) : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-terracotta-500" />
        <h3 className="text-sm font-semibold text-slate-900">
          Timeline
        </h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Launch deadline
          </label>
          <input
            type="date"
            value={draftDeadline}
            onChange={(e) => setDraftDeadline(e.target.value)}
            disabled={locked}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Budget (days) <span className="text-slate-400">optional</span>
          </label>
          <input
            type="number"
            min={1}
            value={draftBudget}
            onChange={(e) => setDraftBudget(e.target.value)}
            disabled={locked}
            placeholder="e.g., 90"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 disabled:bg-slate-50"
          />
        </div>

        {!locked && (
          <button
            onClick={save}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-terracotta-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-terracotta-700 transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save timeline
          </button>
        )}
      </div>
    </div>
  );
}
