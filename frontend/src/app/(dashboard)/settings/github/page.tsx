"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Github,
  Loader2,
  LogOut,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

import {
  GitHubOrgsResponse,
  GitHubStatus,
  disconnectGitHub,
  getGitHubOrgs,
  getGitHubStatus,
  startGitHubOAuth,
} from "@/lib/github-api";

export default function GitHubSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wasJustConnected = searchParams.get("connected") === "1";

  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [orgs, setOrgs] = useState<GitHubOrgsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([getGitHubStatus(), getGitHubOrgs()]);
      setStatus(s);
      setOrgs(o);
    } catch (e) {
      toast.error("Could not load GitHub status", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Show success toast and clear the query param on first load after OAuth
  useEffect(() => {
    if (wasJustConnected && status?.connected) {
      toast.success("GitHub connected", {
        description: "You are now connected as @" + status.username,
      });
      router.replace("/settings/github");
    }
  }, [wasJustConnected, status, router]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await startGitHubOAuth();
      // Redirect the browser to GitHub's authorize page
      window.location.href = result.authorize_url;
    } catch (e) {
      toast.error("Could not start GitHub connection", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect GitHub? You will not be able to generate repositories until you reconnect.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await disconnectGitHub();
      toast.success("GitHub disconnected");
      setStatus({ connected: false, username: null, connected_at: null });
      setOrgs({ orgs: [], connected: false });
    } catch (e) {
      toast.error("Could not disconnect", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-sm text-slate-500">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            GitHub
          </h1>
          <p className="mt-2 text-slate-500">
            Connect your GitHub account to generate repositories, push starter
            code, and configure CI/CD pipelines from the Scaffold phase.
          </p>
        </div>

        {/* Connection card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          {status?.connected ? (
            <>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Github className="w-6 h-6 text-slate-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        @{status.username}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" strokeWidth={3} />
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {status.connected_at &&
                        "Connected " +
                          new Date(status.connected_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <a
                  href={"https://github.com/" + status.username}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-terracotta-600 hover:text-terracotta-700"
                >
                  View profile
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Orgs */}
              {orgs && orgs.orgs.length > 0 && (
                <div className="mb-6 pt-6 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-900 mb-2">
                    Organizations
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    When you generate a repository, you can choose to create
                    it under your personal account or any of these orgs.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {orgs.orgs.map((o) => (
                      <div
                        key={o.id}
                        className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
                      >
                        {o.avatar_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={o.avatar_url}
                            alt=""
                            className="w-4 h-4 rounded"
                          />
                        )}
                        <span className="text-xs font-medium text-slate-700">
                          {o.login}
                        </span>
                        {o.login === "sojip-projects" && (
                          <span className="text-[10px] text-terracotta-600 uppercase tracking-wide font-semibold">
                            SOJIP
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Github className="w-8 h-8 text-slate-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Connect your GitHub account
                </h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                  SOJIP uses your GitHub account to create private repositories
                  for your projects. Your token is encrypted and never leaves
                  the platform.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Github className="w-4 h-4" />
                  )}
                  Connect GitHub
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-700">
                      What permissions SOJIP asks for
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      <li>
                        · <strong>Repositories</strong> — create and update
                        private repos for your projects
                      </li>
                      <li>
                        · <strong>Workflows</strong> — add CI pipelines to
                        your generated repositories
                      </li>
                      <li>
                        · <strong>Email addresses</strong> — read-only, used
                        to display your account
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
