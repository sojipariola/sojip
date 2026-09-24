"use client";

import { useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

type GateResult = {
  gate: string;
  passed: boolean;
  reason: string;
  missing: string[];
  ai_feedback: string | null;
};

interface Props {
  projectId: string;
  onResult?: (result: GateResult) => void;
}

export function AIMentorPanel({ projectId, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<GateResult>(
        `/projects/${projectId}/gates/idea/validate`,
        { method: "POST" }
      );
      setResult(res);
      onResult?.(res);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The AI Mentor could not be reached. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-4 h-4 text-terracotta-600" />
        <h3 className="text-sm font-semibold text-slate-900">AI Mentor</h3>
      </div>

      {!result && !loading && !error && (
        <>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            Your AI Mentor reads your canvas and asks a pointed question
            about the weakest part. Be ready to answer it.
          </p>
          <button
            onClick={run}
            className="w-full inline-flex items-center justify-center gap-2 bg-terracotta-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-terracotta-700 transition"
          >
            <Sparkles className="w-4 h-4" />
            Ask the AI Mentor
          </button>
        </>
      )}

      {loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-terracotta-600" />
            Reading your canvas…
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            This usually takes 30–90 seconds on CPU inference. When you
            deploy to a GPU, it responds in under 5 seconds.
          </p>
          <div className="space-y-2 pt-2">
            <div className="h-3 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-4/5" />
          </div>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
          <button
            onClick={run}
            className="text-sm text-terracotta-600 hover:text-terracotta-700 font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          <div
            className={
              result.passed
                ? "rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5"
                : "rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5"
            }
          >
            <div className="flex items-start gap-2">
              <span
                className={
                  result.passed
                    ? "text-emerald-700 text-xs font-semibold uppercase tracking-wide"
                    : "text-amber-800 text-xs font-semibold uppercase tracking-wide"
                }
              >
                {result.passed ? "Approved" : "Follow-up needed"}
              </span>
            </div>
            {result.ai_feedback && (
              <p
                className={
                  result.passed
                    ? "mt-2 text-sm text-emerald-900 leading-relaxed"
                    : "mt-2 text-sm text-amber-900 leading-relaxed"
                }
              >
                {result.ai_feedback}
              </p>
            )}
          </div>

          <button
            onClick={run}
            className="text-sm text-terracotta-600 hover:text-terracotta-700 font-medium"
          >
            Ask again
          </button>
        </div>
      )}
    </div>
  );
}
