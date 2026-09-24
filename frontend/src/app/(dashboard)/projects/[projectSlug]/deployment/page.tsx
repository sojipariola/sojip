"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseId } from "@/lib/phases";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { DangerZone } from "@/components/projects/DangerZone";
import {
  DeploymentPath,
  PathSelector,
} from "@/components/deployment/PathSelector";
import { DeployForm } from "@/components/deployment/DeployForm";
import { EnvVarEditor } from "@/components/deployment/EnvVarEditor";
import { DeploymentTimeline } from "@/components/deployment/DeploymentTimeline";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import {
  Deployment,
  deleteDeployment,
  listDeployments,
  rollbackDeployment,
  runHealthCheck,
} from "@/lib/deployment-api";
import { useDeploymentPolling } from "@/hooks/useDeploymentPolling";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
  github_repo: string | null;
};

export default function DeploymentPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();


  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [path, setPath] = useState<DeploymentPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await apiFetch<Project[]>("/projects");
      const found = all.find((p) => p.slug === projectSlug);
      if (!found) {
        setError("Project not found");
        return;
      }
      setProject(found);
      const deps = await listDeployments(found.id).catch(
        () => [] as Deployment[]
      );
      setDeployments(deps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for status changes while the tab is visible
  useDeploymentPolling({
    intervalMs: 30000,
    enabled: !loading && !!project,
    onPoll: load,
  });

  async function handleRefreshHealth(deploymentId: string) {
    if (!project) return;
    setRefreshingId(deploymentId);
    try {
      const result = await runHealthCheck(project.id, deploymentId);
      if (result.is_healthy) {
        toast.success("Healthy", {
          description: "HTTP " + result.status_code,
        });
      } else {
        toast.warning("Not healthy", {
          description: result.error || "HTTP " + result.status_code,
        });
      }
      await load();
    } catch (e) {
      toast.error("Health check failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleRollback(deploymentId: string) {
    if (!project) return;
    const source = deployments.find((d) => d.id === deploymentId);
    if (!source || !source.url) {
      toast.error("Cannot roll back — no URL on that deployment");
      return;
    }

    setRollingBackId(deploymentId);
    try {
      const created = await rollbackDeployment(project.id, deploymentId, {
        url: source.url,
        target: source.target,
        environment: "production",
      });

      const check = await runHealthCheck(project.id, created.id);
      if (check.is_healthy) {
        toast.success("Rolled back", {
          description: source.url + " is live again.",
        });
      } else {
        toast.warning("Rollback recorded but URL is not 200", {
          description: check.error || "HTTP " + check.status_code,
        });
      }
      await load();
    } catch (e) {
      toast.error("Rollback failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setRollingBackId(null);
    }
  }

  async function handleDelete(deploymentId: string) {
    if (!project) return;
    if (!confirm("Delete this deployment record?")) return;
    try {
      await deleteDeployment(project.id, deploymentId);
      toast.success("Deployment record deleted");
      await load();
    } catch (e) {
      toast.error("Could not delete", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{error || "Project not found"}</p>
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

  const hasDeployments = deployments.length > 0;
  const healthyDeployment = deployments.find((d) => d.status === "healthy");
  const hasEnvVars = deployments.some(
    (d) => Object.keys(d.env_vars_masked).length > 0
  );
  const envDeployment = deployments.find(
    (d) => Object.keys(d.env_vars_masked).length > 0
  );

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase="deployment"
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
          viewedPhase="deployment"
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <span className="phase-chip mb-3 inline-block">
              Phase 6 — Deployment
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Make your project available at a public URL. Pick a path —
              script, direct URL, or Codespaces.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-6">
              {/* Path selector */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <PathSelector selected={path} onSelect={setPath} />
              </div>

              {/* Deploy form */}
              {path && (
                <DeployForm
                  projectId={project.id}
                  githubRepo={project.github_repo}
                  path={path}
                  onDeployed={load}
                />
              )}

              {/* Env var editor for the deployment that has env vars */}
              {envDeployment && (
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <EnvVarEditor
                    projectId={project.id}
                    deploymentId={envDeployment.id}
                    maskedVars={envDeployment.env_vars_masked}
                    onChanged={load}
                  />
                </div>
              )}

              {/* Deployment timeline */}
              <DeploymentTimeline
                deployments={deployments}
                refreshingId={refreshingId}
                rollingBackId={rollingBackId}
                onRefreshHealth={handleRefreshHealth}
                onRollback={handleRollback}
                onDelete={handleDelete}
              />
            </div>

            <aside className="space-y-4">
              <SupportPanel projectId={project.id} phase="deployment" />

              {/* Current status */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Current status
                </h3>
                {healthyDeployment ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-700">
                        Healthy
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 break-all mb-3">
                      {healthyDeployment.url}
                    </p>
                    <a
                      href={healthyDeployment.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-terracotta-600 hover:text-terracotta-700 font-medium"
                    >
                      Open URL →
                    </a>
                  </>
                ) : hasDeployments ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">
                        Not healthy yet
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      A deployment record exists, but no URL is returning
                      200. Fix the deployment, then re-run the health check.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    No deployment yet. Choose a path to the left to get
                    started.
                  </p>
                )}
              </div>

              {/* Completion */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Completion
                </h3>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2.5">
                    <span
                      className={
                        "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 " +
                        (hasDeployments
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white border-slate-300")
                      }
                    />
                    <span
                      className={
                        "text-xs leading-relaxed " +
                        (hasDeployments ? "text-slate-500" : "text-slate-700")
                      }
                    >
                      First deployment attempt
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span
                      className={
                        "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 " +
                        (healthyDeployment
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white border-slate-300")
                      }
                    />
                    <span
                      className={
                        "text-xs leading-relaxed " +
                        (healthyDeployment
                          ? "text-slate-500"
                          : "text-slate-700")
                      }
                    >
                      URL returns HTTP 200
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span
                      className={
                        "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 " +
                        (hasEnvVars
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white border-slate-300")
                      }
                    />
                    <span
                      className={
                        "text-xs leading-relaxed " +
                        (hasEnvVars ? "text-slate-500" : "text-slate-700")
                      }
                    >
                      Environment variables documented
                    </span>
                  </li>
                </ul>
                <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100 leading-relaxed">
                  All three complete when you can advance to Maintenance.
                </p>
              </div>

              {/* Tips */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Rocket className="w-4 h-4 text-terracotta-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Deployment tips
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Not sure which path? Most students use the script path —
                  SOJIP writes the commands and you run them.
                </p>
              </div>
            </aside>
          </div>
          <DangerZone
          projectId={project.id}
          projectSlug={project.slug}
          projectName={project.name}
          canDelete={
            user?.id === project.owner_id || user?.role === "admin"
          }
        />
      </main>
      </div>
    </div>
  );
}
