"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, LogOut, ArrowRight } from "lucide-react";

import { SOJIPButton as Button } from "@/components/ui/SOJIPButton";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import { getGitHubStatus } from "@/lib/github-api";
import { Github } from "lucide-react";
import { PHASE_LABEL, PHASE_ORDER, phaseLabel } from "@/lib/phases";
import { PlanBadge } from "@/components/billing/PlanBadge";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: string;
  owner_id: string;
};

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<Project[]>("/projects");
        if (!cancelled) setProjects(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load projects");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    getGitHubStatus()
      .then((s) => {
        if (!cancelled) setGithubConnected(s.connected);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight">
              SOJIP<span className="text-terracotta-500">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <PlanBadge />

            {user?.role === "admin" && (
              <Link
                href="/admin/billing"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
                title="Manage plans"
              >
                Admin
              </Link>
            )}

            {/* Teacher notes link — teachers and admins only */}
            {(user?.role === "teacher" || user?.role === "admin") && (
              <Link
                href="/settings/teacher-notes"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition"
                title="Write teacher notes for each phase"
              >
                Notes
              </Link>
            )}

            <Link
              href="/settings/github"
              className={
                githubConnected
                  ? "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                  : "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition"
              }
              title={githubConnected ? "GitHub connected" : "Connect your GitHub account"}
            >
              <Github className="w-3.5 h-3.5" />
              {githubConnected ? "GitHub" : "Connect GitHub"}
            </Link>

            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-900">
                {user?.full_name}
              </div>
              <div className="text-xs text-slate-500 capitalize">
                {user?.role} · {user?.skill_tier}
              </div>
            </div>
            <Button variant="ghost" onClick={logout} aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Your projects
            </h1>
            <p className="mt-1.5 text-slate-500">
              Every project walks the seven phases from Idea to Maintenance.
            </p>
          </div>
          <Link href="/dashboard/new">
            <Button>
              <Plus className="w-4 h-4" />
              New project
            </Button>
          </Link>
        </div>

        {/* States */}
        {loading && (
          <div className="text-slate-500 text-sm">Loading projects…</div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-16 border border-dashed border-slate-300 rounded-xl bg-white">
            <p className="text-slate-600 mb-4">
              You don't have any projects yet.
            </p>
            <Link href="/dashboard/new">
              <Button>
                <Plus className="w-4 h-4" />
                Create your first project
              </Button>
            </Link>
          </div>
        )}

        {/* Grid */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-terracotta-300 hover:shadow-sm transition"
              >
                <Link
                  href={`/projects/${p.slug}/${p.current_phase}`}
                  className="block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="phase-chip">
                      {phaseLabel(p.current_phase)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-terracotta-500 transition" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-terracotta-700 transition">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-sm text-slate-500 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </Link>

                {/* Phase jump links */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
                  {PHASE_ORDER.map((phase) => (
                    <Link
                      key={phase}
                      href={`/projects/${p.slug}/${phase}`}
                      className="text-[10px] px-2 py-0.5 rounded text-slate-500 hover:bg-terracotta-50 hover:text-terracotta-700 transition uppercase tracking-wide font-medium"
                    >
                      {PHASE_LABEL[phase]}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
