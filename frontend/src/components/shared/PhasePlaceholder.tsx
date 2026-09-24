"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, LucideIcon } from "lucide-react";
import { useParams } from "next/navigation";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { AIMentorPanel } from "@/components/shared/AIMentorPanel";
import { PhaseId } from "@/lib/phases";
import { apiFetch } from "@/lib/api-client";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
};

interface Props {
  phase: PhaseId;
  phaseLabel: string;
  phaseNumber: number;
  title: string;
  description: string;
  comingSoon: string[];
  Icon: LucideIcon;
}

export function PhasePlaceholder({
  phase,
  phaseLabel,
  phaseNumber,
  title,
  description,
  comingSoon,
  Icon,
}: Props) {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Project[]>("/projects")
      .then((all) => {
        const found = all.find((p) => p.slug === projectSlug);
        if (!cancelled) setProject(found || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Project not found</p>
          <Link
            href="/dashboard"
            className="text-terracotta-600 hover:text-terracotta-700 font-medium text-sm"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase={phase}
      />

      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="text-sm text-slate-500 truncate max-w-xs">
            {project.name}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-10">
        <SOJIPStepper
          currentPhase={project.current_phase}
          viewedPhase={phase}
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="phase-chip">
                Phase {phaseNumber} — {phaseLabel}
              </span>
              {project.current_phase !== phase && (
                <span className="text-xs text-slate-400">
                  (not the project's current phase)
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-2 text-slate-500 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
              <Icon className="w-6 h-6 text-terracotta-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                {title}
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed mb-6">
                {description}
              </p>

              <div className="text-left max-w-md mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Coming soon
                </p>
                <ul className="space-y-1.5">
                  {comingSoon.map((item, i) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-terracotta-400">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <aside className="space-y-4">
              <AIMentorPanel projectId={project.id} gate={phase} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
