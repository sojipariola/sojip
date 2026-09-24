"use client";

import Link from "next/link";
import { CheckCircle2, Github, Loader2, Settings } from "lucide-react";

interface Props {
  connected: boolean;
  username: string | null;
  loading: boolean;
  onConnect: () => void;
  connecting: boolean;
}

export function GitHubBanner({
  connected,
  username,
  loading,
  onConnect,
  connecting,
}: Props) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">
          Checking GitHub connection…
        </span>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-900">
              GitHub connected as @{username}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              You can generate repositories under your account.
            </p>
          </div>
        </div>
        <Link
          href="/settings/github"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-900"
        >
          <Settings className="w-3.5 h-3.5" />
          Manage
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <Github className="w-5 h-5 text-amber-700 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-900">
            Connect GitHub to generate a repository
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            SOJIP creates a private repo with starter code and CI/CD for your
            project.
          </p>
        </div>
      </div>
      <button
        onClick={onConnect}
        disabled={connecting}
        className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition disabled:opacity-50"
      >
        {connecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Github className="w-3.5 h-3.5" />
        )}
        Connect GitHub
      </button>
    </div>
  );
}
