"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

type Validation = {
  id: string;
  project_id: string;
  validator_id: string;
  comment: string | null;
  phase: string;
};

const REQUIRED = 3;

interface Props {
  projectId: string;
  refreshKey?: number;
}

export function PeerValidationList({ projectId, refreshKey }: Props) {
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Validation[]>(`/projects/${projectId}/validations`)
      .then((data) => {
        if (!cancelled) setValidations(data);
      })
      .catch(() => {
        // Silently ignore — will retry on next refresh
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const count = validations.length;
  const remaining = Math.max(0, REQUIRED - count);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Peer validations
        </h3>
        <span className="text-xs text-slate-500">
          {count} of {REQUIRED}
        </span>
      </div>

      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: REQUIRED }).map((_, i) =>
          i < count ? (
            <CheckCircle2
              key={i}
              className="w-5 h-5 text-terracotta-500"
              strokeWidth={2}
            />
          ) : (
            <Circle
              key={i}
              className="w-5 h-5 text-slate-300"
              strokeWidth={2}
            />
          )
        )}
      </div>

      {loading && (
        <p className="text-xs text-slate-400">Loading validations…</p>
      )}

      {!loading && count === 0 && (
        <p className="text-sm text-slate-500 leading-relaxed">
          No peer validations yet. Ask a classmate or colleague to validate
          your idea — they'll see it in their shared workspace.
        </p>
      )}

      {!loading && count > 0 && (
        <ul className="space-y-3">
          {validations.map((v) => (
            <li key={v.id} className="text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-terracotta-500 shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <div className="min-w-0">
                  {v.comment ? (
                    <p className="text-slate-700 leading-snug">
                      "{v.comment}"
                    </p>
                  ) : (
                    <p className="text-slate-500 italic">
                      Validated without comment
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && remaining > 0 && (
        <p className="mt-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
          Needs {remaining} more validation{remaining !== 1 ? "s" : ""} to
          unlock the Plan phase.
        </p>
      )}
    </div>
  );
}
