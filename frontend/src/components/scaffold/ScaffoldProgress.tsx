"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  GitCommit,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

import { ScaffoldJob, STAGE_LABELS, STAGE_ORDER } from "@/lib/scaffold-api";

interface Props {
  job: ScaffoldJob;
  onReset: () => void;
}

export function ScaffoldProgress({ job, onReset }: Props) {
  const isDone = job.status === "completed";
  const isFailed = job.status === "failed";
  const isRunning =
    job.status === "running" || job.status === "queued";

  // Determine which stages are complete, current, or pending
  const currentIdx = job.current_stage
    ? STAGE_ORDER.indexOf(job.current_stage)
    : -1;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        {isRunning && (
          <Loader2 className="w-5 h-5 text-terracotta-500 animate-spin shrink-0" />
        )}
        {isDone && (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        )}
        {isFailed && (
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">
            {isDone
              ? "Repository ready"
              : isFailed
              ? "Generation failed"
              : STAGE_LABELS[job.current_stage || "queued"] || "Working…"}
          </h3>
          <p className="text-xs text-slate-500">
            {isDone
              ? "Your starter code and CI pipeline are live on GitHub."
              : isFailed
              ? job.error_message || "Something went wrong."
              : "This takes 20-40 seconds on first run."}
          </p>
        </div>
        <div className="text-sm font-mono text-slate-400 shrink-0">
          {job.progress}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100">
        <div
          className={clsx(
            "h-full transition-all duration-500 ease-out",
            isFailed ? "bg-red-500" : "bg-terracotta-500"
          )}
          style={{ width: job.progress + "%" }}
        />
      </div>

      {/* Stage list */}
      <div className="px-6 py-5">
        <ul className="space-y-3">
          {STAGE_ORDER.map((stage, i) => {
            const isStageDone = isDone || i < currentIdx;
            const isStageCurrent = !isDone && i === currentIdx;
            return (
              <li key={stage} className="flex items-center gap-3 text-sm">
                {isStageDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : isStageCurrent ? (
                  <Loader2 className="w-4 h-4 text-terracotta-500 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
                )}
                <span
                  className={clsx(
                    isStageDone && "text-slate-500",
                    isStageCurrent && "text-slate-900 font-medium",
                    !isStageDone && !isStageCurrent && "text-slate-400"
                  )}
                >
                  {STAGE_LABELS[stage] || stage}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Success state */}
      {isDone && job.repo_url && (
        <div className="px-6 py-5 bg-emerald-50 border-t border-emerald-100">
          <div className="flex items-center gap-2 mb-3">
            <FileCode2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-900">
              {job.repo_full_name}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-emerald-700 mb-4">
            <span className="inline-flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5" />4 starter files
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5" />
              Initial commit
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={job.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
            >
              Open on GitHub
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onReset}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Generate another
            </button>
          </div>
          <p className="mt-4 text-xs text-emerald-800 leading-relaxed">
            <strong>Next:</strong> push your first feature in the Development
            phase, or add a README description from GitHub.
          </p>
        </div>
      )}

      {/* Failure state */}
      {isFailed && (
        <div className="px-6 py-5 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-900 mb-2">
            {job.error_message || "Generation failed."}
          </p>
          <button
            onClick={onReset}
            className="text-sm text-red-700 hover:text-red-900 font-medium"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
