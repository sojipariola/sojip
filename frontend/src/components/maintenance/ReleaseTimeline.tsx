"use client";

import { ExternalLink, Package, Trash2 } from "lucide-react";
import clsx from "clsx";

import { Release, SEVERITY_META } from "@/lib/releases-api";

interface Props {
  releases: Release[];
  repoUrl: string | null;
  onDelete: (id: string) => void;
}

export function ReleaseTimeline({ releases, repoUrl, onDelete }: Props) {
  if (releases.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <Package className="w-6 h-6 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          No releases yet. Publish your first above.
        </p>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...releases].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Release timeline
        </h2>
        <span className="text-xs text-slate-400">
          {releases.length} release{releases.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {sorted.map((r) => {
          const meta = SEVERITY_META[r.severity] || SEVERITY_META.minor;
          return (
            <li key={r.id} className="px-6 py-4 group">
              <div className="flex items-start gap-4">
                {/* Left: version badge + severity */}
                <div className="shrink-0 w-24">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono font-semibold text-slate-900">
                      {r.version_tag}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border",
                      meta.bg,
                      meta.color
                    )}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Right: changelog + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {r.changelog}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    {r.deployed_at && (
                      <span>
                        {new Date(r.deployed_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {r.commit_sha && (
                      <span className="font-mono">
                        commit {r.commit_sha.slice(0, 7)}
                      </span>
                    )}
                    {r.commit_sha && repoUrl && (
                      <a
                        href={repoUrl + "/commit/" + r.commit_sha}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-terracotta-600 hover:text-terracotta-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                        view
                      </a>
                    )}
                  </div>
                </div>

                {/* Right: delete */}
                <button
                  onClick={() => {
                    if (confirm("Delete release " + r.version_tag + "?"))
                      onDelete(r.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition p-1 text-slate-400 hover:text-red-600 shrink-0"
                  title="Delete release"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
