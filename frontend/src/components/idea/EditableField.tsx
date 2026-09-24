"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Sparkles, X } from "lucide-react";
import clsx from "clsx";

interface Props {
  label: string;
  prompt: string;
  placeholder: string;
  value: string;
  onSave: (next: string) => Promise<void>;
  onRequestCritique?: () => void;
  critiquing?: boolean;
  locked?: boolean;
  children?: React.ReactNode; // remarks, AI critique, etc.
}

type Mode = "read" | "edit";

export function EditableField({
  label,
  prompt,
  placeholder,
  value,
  onSave,
  onRequestCritique,
  critiquing = false,
  locked = false,
  children,
}: Props) {
  const [mode, setMode] = useState<Mode>("read");
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(value);
    setError(null);
    setMode("edit");
  }

  function cancelEdit() {
    setDraft(value);
    setError(null);
    setMode("read");
  }

  async function commit() {
    if (draft === value) {
      setMode("read");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setMode("read");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
            <span className="text-xs text-slate-400 italic">{prompt}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onRequestCritique && mode === "read" && !locked && (
            <button
              type="button"
              onClick={onRequestCritique}
              disabled={critiquing}
              className="inline-flex items-center gap-1 text-xs text-terracotta-600 hover:text-terracotta-700 transition disabled:opacity-50 px-2 py-1 rounded"
              title="Ask the AI Mentor for a critique of this field"
            >
              {critiquing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              AI
            </button>
          )}

          {!locked && mode === "read" && (
            <button
              type="button"
              onClick={startEdit}
              className="text-slate-400 hover:text-slate-700 transition p-1 rounded"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {mode === "read" ? (
        <div
          className={clsx(
            "text-sm leading-relaxed",
            value ? "text-slate-700" : "text-slate-400 italic"
          )}
        >
          {value || "(empty — click the pencil to edit)"}
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            autoFocus
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 resize-none leading-relaxed"
          />
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-terracotta-600 text-white hover:bg-terracotta-700 rounded-lg transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              )}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Inline children (remarks, AI critique, etc.) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
