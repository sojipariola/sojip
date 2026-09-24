"use client";

import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { Remark } from "@/lib/workspace-api";

interface Props {
  remarks: Remark[];
}

const FIELD_LABELS: Record<string, string> = {
  problem: "Problem",
  solution: "Solution",
  unique_value: "Unique Value",
  unfair_advantage: "Unfair Advantage",
};

export function AISuggestionsPanel({ remarks }: Props) {
  const [open, setOpen] = useState(true);
  const aiRemarks = remarks.filter(
    (r) => r.author_role === "ai" && r.kind === "critique"
  );

  if (aiRemarks.length === 0) return null;

  return (
    <div className="bg-terracotta-50 border border-terracotta-200 rounded-xl p-5 mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-terracotta-600" />
          <h2 className="text-sm font-semibold text-terracotta-900">
            {aiRemarks.length} AI suggestion{aiRemarks.length !== 1 ? "s" : ""}
          </h2>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-terracotta-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-terracotta-700" />
        )}
      </button>

      {open && (
        <ul className="mt-4 space-y-3">
          {aiRemarks.map((r) => (
            <li key={r.id} className="flex items-start gap-3 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta-500 shrink-0 mt-2" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-terracotta-700 uppercase tracking-wide mb-0.5">
                  {FIELD_LABELS[r.field_path] || r.field_path}
                </div>
                <p className="text-terracotta-900 leading-relaxed">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
