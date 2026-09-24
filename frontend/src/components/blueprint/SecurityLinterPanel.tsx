"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

import {
  SecurityIssue,
  SecurityReport,
  critiqueBlueprint,
  lintBlueprint,
} from "@/lib/blueprint-api";

interface Props {
  projectId: string;
}

const SEVERITY_META: Record<
  SecurityIssue["severity"],
  { icon: typeof Info; color: string; label: string; bg: string }
> = {
  info: {
    icon: Info,
    color: "text-slate-500",
    label: "Info",
    bg: "bg-slate-50 border-slate-200",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600",
    label: "Warning",
    bg: "bg-amber-50 border-amber-200",
  },
  error: {
    icon: XCircle,
    color: "text-red-600",
    label: "Error",
    bg: "bg-red-50 border-red-200",
  },
};

export function SecurityLinterPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [critique, setCritique] = useState<string | null>(null);

  async function runLint() {
    setLoading(true);
    try {
      const result = await lintBlueprint(projectId);
      setReport(result);
    } catch (e) {
      toast.error("Could not run linter", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function runCritique() {
    setCritiqueLoading(true);
    setCritique(null);
    try {
      const result = await critiqueBlueprint(projectId);
      setCritique(result.critique);
    } catch (e) {
      toast.error("AI critique unavailable", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setCritiqueLoading(false);
    }
  }

  const errorCount =
    report?.issues.filter((i) => i.severity === "error").length || 0;
  const warningCount =
    report?.issues.filter((i) => i.severity === "warning").length || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-terracotta-600" />
        <h3 className="text-sm font-semibold text-slate-900">Security check</h3>
      </div>

      {!report && !loading && (
        <>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Deterministic rules catch common architectural mistakes: missing
            auth on mutations, direct DB access from the frontend, public
            endpoints without rate limits.
          </p>
          <button
            onClick={runLint}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 transition"
          >
            Run security check
          </button>
        </>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Checking the diagram…
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div
            className={clsx(
              "rounded-lg border px-3 py-2 text-xs",
              report.passed
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              {report.passed ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              {report.passed ? "Passed" : `${errorCount} blocking issue(s)`}
            </div>
            {warningCount > 0 && (
              <p className="mt-1 text-[10px] opacity-80">
                {warningCount} warning{warningCount === 1 ? "" : "s"} also found.
              </p>
            )}
          </div>

          {report.issues.length > 0 && (
            <ul className="space-y-2">
              {report.issues.map((issue, i) => {
                const meta = SEVERITY_META[issue.severity];
                const Icon = meta.icon;
                return (
                  <li
                    key={i}
                    className={clsx(
                      "rounded-lg border px-3 py-2",
                      meta.bg
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={clsx("w-3.5 h-3.5 shrink-0 mt-0.5", meta.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-800 leading-relaxed">
                          {issue.message}
                        </p>
                        {issue.suggestion && (
                          <p className="text-[10px] text-slate-600 mt-1 italic leading-relaxed">
                            {issue.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            onClick={runLint}
            disabled={loading}
            className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium"
          >
            Re-run
          </button>
        </div>
      )}

      {/* AI critique */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-terracotta-500" />
          <h4 className="text-xs font-semibold text-slate-900">
            AI architecture review
          </h4>
        </div>
        <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
          Deterministic rules are fast; the AI sees nuance. Run this when the
          security check is clean.
        </p>

        {!critique && !critiqueLoading && (
          <button
            onClick={runCritique}
            className="w-full inline-flex items-center justify-center gap-1.5 border border-terracotta-300 text-terracotta-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-terracotta-50 transition"
          >
            <Sparkles className="w-3 h-3" />
            Ask the AI for an architecture review
          </button>
        )}

        {critiqueLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Reading the diagram…
          </div>
        )}

        {critique && (
          <div className="bg-terracotta-50 border border-terracotta-100 rounded-lg px-3 py-2.5">
            <p className="text-xs text-terracotta-900 leading-relaxed whitespace-pre-wrap">
              {critique}
            </p>
            <button
              onClick={runCritique}
              className="mt-2 text-[10px] text-terracotta-600 hover:text-terracotta-700 font-medium"
            >
              Ask again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
