"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Files,
  GitBranch,
  GitCommit,
  Github,
  LayoutDashboard,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  RefreshCw,
  Sparkles,
  Terminal,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseId } from "@/lib/phases";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { DangerZone } from "@/components/projects/DangerZone";
import { AIMentorPanel } from "@/components/shared/AIMentorPanel";
import { FileTree } from "@/components/development/FileTree";
import { CodeEditor } from "@/components/development/CodeEditor";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import {
  CommitInfo,
  FileContents,
  RepoInfo,
  TreeEntry,
  getFileContents,
  getRepoInfo,
  getRepoTree,
  listCommits,
} from "@/lib/github-api";
import { CommitReview, reviewCommit } from "@/lib/development-api";
import { TaskGraph, getPlan } from "@/lib/plan-api";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
  github_repo: string | null;
};

type WorkspaceTab = "overview" | "files";

function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const cleaned = url.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

export default function DevelopmentPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();


  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<FileContents | null>(null);
  const [plan, setPlan] = useState<TaskGraph | null>(null);
  const [reviewsByCommit, setReviewsByCommit] = useState<Record<string, CommitReview>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [reviewingSha, setReviewingSha] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parsed = project?.github_repo ? parseOwnerRepo(project.github_repo) : null;

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    else setRefreshing(true);

    try {
      const all = await apiFetch<Project[]>("/projects");
      const found = all.find((p) => p.slug === projectSlug);
      if (!found) {
        setError("Project not found");
        return;
      }
      setProject(found);

      // Load plan
      try {
        const t = await getPlan(found.id);
        setPlan(t);
      } catch {}

      // Load GitHub data
      const parsedLocal = found.github_repo ? parseOwnerRepo(found.github_repo) : null;
      if (parsedLocal) {
        try {
          const [info, cmts] = await Promise.all([
            getRepoInfo(parsedLocal.owner, parsedLocal.repo),
            listCommits(parsedLocal.owner, parsedLocal.repo, 20),
          ]);
          setRepoInfo(info);
          setCommits(cmts);
        } catch (e) {
          console.warn("Could not load repo info", e);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const loadTree = useCallback(async () => {
    if (!parsed) return;
    setTreeLoading(true);
    try {
      const res = await getRepoTree(parsed.owner, parsed.repo);
      setTree(res.entries);
    } catch (e) {
      toast.error("Could not load file tree", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setTreeLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    if (activeTab === "files" && tree.length === 0 && parsed) {
      loadTree();
    }
  }, [activeTab, tree.length, parsed, loadTree]);

  async function handleSelectFile(path: string) {
    if (!parsed) return;
    setFileLoading(true);
    try {
      const file = await getFileContents(parsed.owner, parsed.repo, path);
      setCurrentFile(file);
    } catch (e) {
      toast.error("Could not load file", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setFileLoading(false);
    }
  }

  async function handleReview(sha: string) {
    if (!project) return;
    setReviewingSha(sha);
    try {
      const review = await reviewCommit(project.id, sha);
      setReviewsByCommit((prev) => ({ ...prev, [sha]: review }));
      if (review.passed) {
        toast.success("Review passed", {
          description: review.reasoning || "No issues found.",
        });
      } else {
        toast.warning("Review found something", {
          description: review.concern || review.reasoning,
        });
      }
    } catch (e) {
      toast.error("Review failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setReviewingSha(null);
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

  const ownerLogin = parsed?.owner || "";
  const repoName = parsed?.repo || "";

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase="development"
      />

      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
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

      <div className="max-w-[1600px] mx-auto px-6 py-10 flex gap-10">
        <SOJIPStepper
          currentPhase={project.current_phase}
          viewedPhase="development"
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="phase-chip mb-3 inline-block">
                Phase 5 — Development
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {project.name}
              </h1>
              <p className="mt-2 text-slate-500 max-w-2xl">
                Your repository is the source of truth. Browse files, edit
                code, review commits — all from here.
              </p>
            </div>
          </div>

          {!project.github_repo ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    No repository linked yet
                  </p>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Generate a repository from the Scaffold phase to start
                    writing code.
                  </p>
                  <Link
                    href={`/projects/${project.slug}/scaffold`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-amber-900 hover:text-amber-800"
                  >
                    Go to Scaffold
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
              <div className="min-w-0">
                {/* Repo card + quick actions */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
                  <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Github className="w-5 h-5 text-slate-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {repoInfo?.full_name || ownerLogin + "/" + repoName}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          {repoInfo && (
                            <>
                              <span className="inline-flex items-center gap-1">
                                <GitBranch className="w-3 h-3" />
                                {repoInfo.default_branch}
                              </span>
                              <span>
                                {repoInfo.private ? "Private" : "Public"}
                              </span>
                            </>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <GitCommit className="w-3 h-3" />
                            {commits.length} commit
                            {commits.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => load({ silent: true })}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition"
                      >
                        <RefreshCw
                          className={"w-3 h-3 " + (refreshing ? "animate-spin" : "")}
                        />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-2">
                    <a
                      href={project.github_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition"
                    >
                      <Github className="w-3 h-3" />
                      GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={"https://github.dev/" + ownerLogin + "/" + repoName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white transition"
                    >
                      <Terminal className="w-3 h-3" />
                      Web Editor
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={
                        "https://codespaces.new/" + ownerLogin + "/" + repoName
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white transition"
                    >
                      <Terminal className="w-3 h-3" />
                      Codespaces
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-4">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition",
                      activeTab === "overview"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab("files")}
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition",
                      activeTab === "files"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Files className="w-3.5 h-3.5" />
                    Files
                  </button>
                </div>

                {/* Overview tab */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {plan && plan.tasks && plan.tasks.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <h2 className="text-sm font-semibold text-slate-900">
                            Task progress
                          </h2>
                        </div>
                        <ul className="divide-y divide-slate-100">
                          {plan.tasks.slice(0, 8).map((t) => {
                            const isCritical =
                              t.critical_path_index !== null &&
                              t.critical_path_index !== undefined;
                            return (
                              <li
                                key={t.id}
                                className="px-5 py-2.5 flex items-center gap-3"
                              >
                                <span className="w-3.5 h-3.5 rounded-full border-2 bg-white border-slate-300 shrink-0" />
                                <span className="text-sm text-slate-800 truncate flex-1">
                                  {t.name}
                                </span>
                                <span className="text-xs text-slate-400 shrink-0">
                                  {t.estimate_days}d
                                </span>
                                {isCritical && (
                                  <span className="text-[10px] text-terracotta-600 uppercase tracking-wide font-semibold shrink-0">
                                    critical
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100">
                        <h2 className="text-sm font-semibold text-slate-900">
                          Recent commits
                        </h2>
                      </div>
                      {commits.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-slate-500">
                          No commits yet.
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {commits.map((c) => (
                            <li key={c.sha} className="px-5 py-3">
                              <div className="flex items-start gap-3">
                                {c.author_avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={c.author_avatar}
                                    alt=""
                                    className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-800 truncate">
                                    {c.message}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    <span className="font-mono text-slate-600">
                                      {c.short_sha}
                                    </span>
                                    {" · "}
                                    {c.author_name}
                                    {c.date && (
                                      <>
                                        {" · "}
                                        {new Date(c.date).toLocaleDateString()}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {!reviewsByCommit[c.sha] && (
                                    <button
                                      onClick={() => handleReview(c.sha)}
                                      disabled={reviewingSha === c.sha}
                                      className="inline-flex items-center gap-1 text-xs text-terracotta-600 hover:text-terracotta-700 px-2 py-1 rounded hover:bg-terracotta-50 transition disabled:opacity-50"
                                    >
                                      {reviewingSha === c.sha ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3 h-3" />
                                      )}
                                      Review
                                    </button>
                                  )}
                                  <a
                                    href={c.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-slate-700 transition p-1"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                              {reviewsByCommit[c.sha] && (
                                <div
                                  className={clsx(
                                    "mt-2 ml-9 rounded-lg border px-3 py-2 text-xs",
                                    reviewsByCommit[c.sha].passed
                                      ? "bg-emerald-50 border-emerald-200"
                                      : reviewsByCommit[c.sha].severity === "error"
                                      ? "bg-red-50 border-red-200"
                                      : "bg-amber-50 border-amber-200"
                                  )}
                                >
                                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1">
                                    AI:{" "}
                                    {reviewsByCommit[c.sha].passed
                                      ? "passed"
                                      : reviewsByCommit[c.sha].severity}
                                  </div>
                                  <p>
                                    {reviewsByCommit[c.sha].concern ||
                                      reviewsByCommit[c.sha].reasoning}
                                  </p>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* Files tab */}
                {activeTab === "files" && (
                  <div className="flex gap-4 h-[680px]">
                    {/* File tree sidebar */}
                    <div
                      className={clsx(
                        "bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-200 shrink-0",
                        sidebarOpen ? "w-56" : "w-0 border-0"
                      )}
                    >
                      {sidebarOpen && (
                        <div className="h-full overflow-y-auto">
                          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                              Files
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {tree.filter((t) => t.type === "blob").length}
                            </span>
                          </div>
                          <FileTree
                            entries={tree}
                            selectedPath={currentFile?.path || null}
                            onSelect={handleSelectFile}
                            loading={treeLoading}
                          />
                        </div>
                      )}
                    </div>

                    {/* File content area */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <button
                        onClick={() => setSidebarOpen((s) => !s)}
                        className="self-start inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                      >
                        {sidebarOpen ? (
                          <>
                            <PanelLeftClose className="w-3.5 h-3.5" />
                            Hide tree
                          </>
                        ) : (
                          <>
                            <PanelLeftOpen className="w-3.5 h-3.5" />
                            Show tree
                          </>
                        )}
                      </button>
                      <div className="flex-1 min-h-0">
                        <CodeEditor
                          owner={ownerLogin}
                          repo={repoName}
                          file={currentFile}
                          loading={fileLoading}
                          onSaved={() => {
                            // Refresh tree + commits after save
                            loadTree();
                            load({ silent: true });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
              <SupportPanel projectId={project.id} phase="development" />

                <AIMentorPanel projectId={project.id} gate="development" />
              </aside>
            </div>
          )}
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
