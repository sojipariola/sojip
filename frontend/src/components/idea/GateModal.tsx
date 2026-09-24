"use client";

import { ArrowRight, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  currentPhaseName: string;
  nextPhaseName: string;
  missing: string[];
}

export function GateModal({
  open,
  onClose,
  currentPhaseName,
  nextPhaseName,
  missing,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-xs font-semibold tracking-widest uppercase text-terracotta-600">
              Almost there
            </span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Before you move to {nextPhaseName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          The {currentPhaseName} phase has requirements for a reason.
          Complete these to unlock the next step:
        </p>

        <ul className="space-y-3 mb-6">
          {missing.map((m, i) => (
            <li
              key={i}
              className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-lg px-4 py-3"
            >
              <ArrowRight className="w-4 h-4 text-terracotta-500 shrink-0 mt-0.5" />
              <span className="text-sm text-slate-700 leading-snug">{m}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            Not yet
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 bg-terracotta-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-terracotta-700 transition"
          >
            Keep working
          </button>
        </div>
      </div>
    </div>
  );
}
