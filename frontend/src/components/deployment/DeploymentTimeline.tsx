"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

import {
  Deployment,
  DeploymentStatus,
  STATUS_META,
  TARGET_META,
} from "@/lib/deployment-api";

interface Props {
  deployments: Deployment[];
  refreshingId: string | null;
  rollingBackId: string | null;
  onRefreshHealth: (id: string) => void;
  onRollback: (id: string) => void;
  onDelete: (id: string) => void;
}

function statusIcon(status: DeploymentStatus) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    case "unhealthy":
      return <AlertCircle className="w-3.5 h-3.5 text-amber-600" />;
    case "unreachable":
    case "failed":
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case "deploying":
      return <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />;
    case "rolled_back":
      return <RotateCcw className="w-3.5 h-3.5 text-slate-400" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 30) return days + "d ago";
  return date.toLocaleDateString();
}

export function DeploymentTimeline({
  deployments,
  refreshingId,
  rollingBackId,
  onRefreshHealth,
  onRollback,
  onDelete,
}: Props) {
  if (deployments.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <Clock className="w-6 h-6 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          No deployments yet. Choose a path above to get started.
        </p>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...deployments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // The current healthy deployment is the reference for rollback
  const current = sorted.find((d) => d.status === "healthy");

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Deployment timeline
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every attempt, newest first. Click a URL to visit.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {deployments.length} record{deployments.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {sorted.map((d, idx) => {
          const statusMeta = STATUS_META[d.status] || STATUS_META.pending;
          const targetMeta = TARGET_META[d.target];
          const isCurrent = current && current.id === d.id;
          const isRollbackCandidate =
            current && !isCurrent && d.status === "healthy";

          return (
            <li key={d.id} className="px-6 py-4 group">
              <div className="flex items-start gap-4">
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0 pt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                  {idx < sorted.length - 1 && (
                    <span
                      className="w-px flex-1 bg-slate-200 mt-1"
                      style={{ minHeight: "40px" }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-base">{targetMeta?.icon || "📦"}</span>
                    <span className="text-sm font-medium text-slate-900">
                      {targetMeta?.label || d.target}
                    </span>
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded border",
                        statusMeta.bg,
                        statusMeta.color
                      )}
                    >
                      {statusIcon(d.status)}
                      {statusMeta.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
                        Current
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {d.environment}
                    </span>
                  </div>

                  {d.url && (
                    <div className="flex items-center gap-2 mb-1">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-terracotta-600 hover:text-terracotta-700 truncate font-mono"
                      >
                        {d.url}
                      </a>
                      <ExternalLink className="w-3 h-3 text-slate-300 shrink-0" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                    <span>{timeAgo(d.created_at)}</span>
                    {d.health_check_status !== null && (
                      <span className="text-slate-500">
                        HTTP {d.health_check_status}
                      </span>
                    )}
                    {d.health_check_error && (
                      <span className="text-red-500 truncate max-w-xs">
                        {d.health_check_error}
                      </span>
                    )}
                    {d.commit_sha && (
                      <span className="font-mono">
                        {d.commit_sha.slice(0, 7)}
                      </span>
                    )}
                    {d.version_tag && (
                      <span className="font-mono">{d.version_tag}</span>
                    )}
                    {Object.keys(d.env_vars_masked).length > 0 && (
                      <span>
                        {Object.keys(d.env_vars_masked).length} env var
                        {Object.keys(d.env_vars_masked).length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {d.url && (
                    <button
                      onClick={() => onRefreshHealth(d.id)}
                      disabled={refreshingId === d.id}
                      className="p-1.5 text-slate-400 hover:text-slate-700 transition"
                      title="Re-run health check"
                    >
                      <RefreshCw
                        className={clsx(
                          "w-3.5 h-3.5",
                          refreshingId === d.id && "animate-spin"
                        )}
                      />
                    </button>
                  )}

                  {isRollbackCandidate && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "Roll back to this deployment? This creates a new current deployment with the same URL."
                          )
                        ) {
                          onRollback(d.id);
                        }
                      }}
                      disabled={rollingBackId === d.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-amber-700 transition"
                      title="Roll back to this deployment"
                    >
                      {rollingBackId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm("Delete this record?")) onDelete(d.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-600 transition"
                    title="Delete record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
