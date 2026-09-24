"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseId } from "@/lib/phases";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { DangerZone } from "@/components/projects/DangerZone";
import { AIMentorPanel } from "@/components/shared/AIMentorPanel";
import { GitHubBanner } from "@/components/scaffold/GitHubBanner";
import { TemplatePicker } from "@/components/scaffold/TemplatePicker";
import { OwnerPicker } from "@/components/scaffold/OwnerPicker";
import { RepoNameInput } from "@/components/scaffold/RepoNameInput";
import { PrivacyToggle } from "@/components/scaffold/PrivacyToggle";
import { ScaffoldProgress } from "@/components/scaffold/ScaffoldProgress";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import {
  getGitHubOrgs,
  getGitHubStatus,
  startGitHubOAuth,
} from "@/lib/github-api";
import {
  OwnerType,
  ScaffoldJob,
  TemplateInfo,
  getScaffoldJob,
  listTemplates,
  startScaffold,
} from "@/lib/scaffold-api";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
};

const SOJIP_ORG = "sojip-projects";

export default function ScaffoldPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();

  // Project

  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);

  // GitHub connection
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubOrgs, setGithubOrgs] = useState<string[]>([]);
  const [loadingGithub, setLoadingGithub] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Setup form
  const [ownerType, setOwnerType] = useState<OwnerType>("personal");
  const [repoName, setRepoName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [starting, setStarting] = useState(false);

  // Job
  const [job, setJob] = useState<ScaffoldJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Load project + templates + github status ───
  const load = useCallback(async () => {
    try {
      const [all, tmpls, status, orgsResp] = await Promise.all([
        apiFetch<Project[]>("/projects"),
        listTemplates(),
        getGitHubStatus().catch(() => ({
          connected: false,
          username: null,
          connected_at: null,
        })),
        getGitHubOrgs().catch(() => ({ orgs: [], connected: false })),
      ]);

      const found = all.find((p) => p.slug === projectSlug);
      if (found) {
        setProject(found);
        setRepoName(found.slug);
      }
      setTemplates(tmpls);
      setGithubConnected(status.connected);
      setGithubUsername(status.username);
      setGithubOrgs(orgsResp.orgs.map((o) => o.login));
    } catch (e) {
      toast.error("Could not load", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoadingProject(false);
      setLoadingGithub(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Reset owner type when GitHub state changes ───
  useEffect(() => {
    if (ownerType === "org" && !githubOrgs.includes(SOJIP_ORG)) {
      setOwnerType("personal");
    }
  }, [githubOrgs, ownerType]);

  // ─── Poll job ───
  useEffect(() => {
    if (!job || !project) return;
    if (job.status === "completed" || job.status === "failed") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const updated = await getScaffoldJob(project.id, job.id);
        setJob(updated);
        if (updated.status === "completed") {
          toast.success("Repository ready", {
            description: updated.repo_full_name || "",
          });
        }
        if (updated.status === "failed") {
          toast.error("Generation failed", {
            description: updated.error_message || "",
          });
        }
      } catch {
        // ignore transient polling errors
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job, project]);

  // ─── Actions ───
  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await startGitHubOAuth();
      window.location.href = result.authorize_url;
    } catch (e) {
      toast.error("Could not start GitHub connection", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
      setConnecting(false);
    }
  }

  async function handleStart() {
    if (!project || !selectedTemplate) return;
    if (!githubConnected) {
      toast.error("Connect GitHub first");
      return;
    }
    if (!repoName.trim()) {
      toast.error("Repository name is required");
      return;
    }

    setStarting(true);
    try {
      const created = await startScaffold(project.id, {
        template_id: selectedTemplate,
        owner_type: ownerType,
        repo_name: repoName.trim(),
        private: isPrivate,
      });
      setJob(created);
      toast.success("Generation started");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("already exists")) {
        toast.error("Repository name already exists", {
          description:
            "Choose a different name — GitHub requires unique names per account.",
        });
      } else {
        toast.error("Could not start generation", { description: msg });
      }
    } finally {
      setStarting(false);
    }
  }

  function handleReset() {
    setJob(null);
    setSelectedTemplate(null);
    setRepoName(project?.slug || "");
    setOwnerType("personal");
    setIsPrivate(true);
  }

  // ─── Render ───
  if (loadingProject) {
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

  const orgAvailable = githubOrgs.includes(SOJIP_ORG);
  const ownerLogin =
    ownerType === "org"
      ? SOJIP_ORG
      : githubUsername || "you";
  const canStart =
    !!selectedTemplate &&
    repoName.trim().length > 0 &&
    githubConnected &&
    !starting;

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase="scaffold"
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
          viewedPhase="scaffold"
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <span className="phase-chip mb-3 inline-block">
              Phase 4 — Scaffold
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Turn your Blueprint into a real repository. Pick a template,
              choose where it lives, and SOJIP creates the repo with starter
              code and a CI/CD pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-6">
              {!job ? (
                <>
                  {/* GitHub connection banner */}
                  <GitHubBanner
                    connected={githubConnected}
                    username={githubUsername}
                    loading={loadingGithub}
                    onConnect={handleConnect}
                    connecting={connecting}
                  />

                  {/* Template picker */}
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 mb-3">
                      1. Choose a template
                    </h2>
                    <TemplatePicker
                      templates={templates}
                      selectedId={selectedTemplate}
                      onSelect={setSelectedTemplate}
                    />
                  </div>

                  {/* Setup form */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                    <h2 className="text-sm font-semibold text-slate-900">
                      2. Configure the repository
                    </h2>

                    <OwnerPicker
                      value={ownerType}
                      onChange={setOwnerType}
                      username={githubUsername}
                      orgAvailable={orgAvailable}
                      orgName={SOJIP_ORG}
                    />

                    <RepoNameInput
                      value={repoName}
                      onChange={setRepoName}
                      ownerLogin={ownerLogin}
                    />

                    <PrivacyToggle
                      value={isPrivate}
                      onChange={setIsPrivate}
                    />
                  </div>

                  {/* Generate button */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-xs text-slate-500">
                      {!githubConnected
                        ? "Connect GitHub to enable generation."
                        : !selectedTemplate
                        ? "Pick a template above to continue."
                        : "Ready when you are."}
                    </p>
                    <button
                      onClick={handleStart}
                      disabled={!canStart}
                      className="inline-flex items-center gap-2 bg-terracotta-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-terracotta-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {starting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Rocket className="w-4 h-4" />
                      )}
                      Generate repository
                    </button>
                  </div>
                </>
              ) : (
                <ScaffoldProgress job={job} onReset={handleReset} />
              )}
            </div>

            <aside className="space-y-4">
              <SupportPanel projectId={project.id} phase="scaffold" />

              <AIMentorPanel projectId={project.id} gate="scaffold" />
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
