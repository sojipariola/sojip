"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { useDebounce } from "@/hooks/useDebounce";

export type LeanCanvas = {
  problem?: string | null;
  solution?: string | null;
  unique_value?: string | null;
  unfair_advantage?: string | null;
};

const FIELDS: {
  key: keyof LeanCanvas;
  label: string;
  prompt: string;
  placeholder: string;
}[] = [
  {
    key: "problem",
    label: "Problem",
    prompt: "Who specifically has this problem?",
    placeholder:
      "Be narrow. Not 'students' — which students, where, and why does this problem matter to them?",
  },
  {
    key: "solution",
    label: "Solution",
    prompt: "What does it do?",
    placeholder:
      "Concrete and verifiable. What will users actually do with your solution?",
  },
  {
    key: "unique_value",
    label: "Unique Value",
    prompt: "Why this, and not the obvious alternative?",
    placeholder:
      "What makes this different from what already exists? Be specific.",
  },
  {
    key: "unfair_advantage",
    label: "Unfair Advantage",
    prompt: "What can't be easily copied?",
    placeholder:
      "A partnership, a dataset, a community — something others can't simply replicate.",
  },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  projectId: string;
  initialCanvas: LeanCanvas;
  onChange?: (canvas: LeanCanvas) => void;
}

export function LeanCanvasForm({ projectId, initialCanvas, onChange }: Props) {
  const [canvas, setCanvas] = useState<LeanCanvas>(initialCanvas);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debouncedCanvas = useDebounce(canvas, 800);
  const isFirstRender = useRef(true);

  // Autosave on debounced change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let cancelled = false;
    setStatus("saving");

    apiFetch<{ phase_data: LeanCanvas }>(
      `/projects/${projectId}/phase-data`,
      {
        method: "PATCH",
        body: { phase_data: debouncedCanvas },
      }
    )
      .then(() => {
        if (cancelled) return;
        setStatus("saved");
        setLastSavedAt(new Date());
        onChange?.(debouncedCanvas);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCanvas, projectId]);

  function update(key: keyof LeanCanvas, value: string) {
    setCanvas((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Lean Canvas
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Four fields. Each one forces a sharper answer.
          </p>
        </div>
        <SaveIndicator status={status} lastSavedAt={lastSavedAt} />
      </div>

      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="mb-3">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor={f.key}
                  className="text-sm font-semibold text-slate-900"
                >
                  {f.label}
                </label>
                <span className="text-xs text-slate-400 italic">
                  {f.prompt}
                </span>
              </div>
            </div>
            <textarea
              id={f.key}
              rows={3}
              value={canvas[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-0 py-0 bg-transparent border-0 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 resize-none leading-relaxed"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveIndicator({
  status,
  lastSavedAt,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
}) {
  if (status === "saving") {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Saving…
      </div>
    );
  }
  if (status === "saved" && lastSavedAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600">
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
        Saved
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="text-xs text-red-600">
        Save failed — will retry on next edit
      </div>
    );
  }
  return null;
}
