"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseId } from "@/lib/phases";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { DangerZone } from "@/components/projects/DangerZone";
import { ReleaseForm } from "@/components/maintenance/ReleaseForm";
import { ReleaseTimeline } from "@/components/maintenance/ReleaseTimeline";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import {
  CritiqueResponse,
  RetrospectiveArtifact,
  RetrospectiveContent,
  WordCount,
  critiqueRetrospective,
  getRetrospective,
  getWordCount,
  patchRetrospective,
} from "@/lib/maintenance-api";
import {
  Release,
  deleteRelease,
  listReleases,
} from "@/lib/releases-api";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
  github_repo: string | null;
};

const PROMPTS: {
  key: keyof RetrospectiveContent;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: "surprise",
    label: "What surprised you?",
    hint: "The moment reality diverged from your expectations.",
    placeholder:
      "Something you didn't see coming — a technical hurdle, a user reaction, an assumption that turned out to be wrong.",
  },
  {
    key: "differently",
    label: "What would you do differently?",
    hint: "The decision you'd reverse if you could.",
    placeholder:
      "A choice that cost you time, or a path you'd skip next time. Be specific about what you'd change and why.",
  },
  {
    key: "lesson",
    label: "What's the biggest lesson?",
    hint: "The transferable insight you'll carry into the next project.",
    placeholder:
      "One principle you'll apply from now on. Something you can articulate in a sentence and use again.",
  },
];

export default function MaintenancePage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();


  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [artifact, setArtifact] = useState<RetrospectiveArtifact | null>(null);
  const [wordCount, setWordCount] = useState<WordCount | null>(null);
  const [critique, setCritique] = useState<CritiqueResponse | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);

  const [content, setContent] = useState<RetrospectiveContent>({
    surprise: "",
    differently: "",
    lesson: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [critiquing, setCritiquing] = useState(false);

  const pendingRef = useRef<RetrospectiveContent | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await apiFetch<Project[]>("/projects");
      const found = all.find((p) => p.slug === projectSlug);
      if (!found) {
        setError("Project not found");
        return;
      }
      setProject(found);

      const [art, wc, rels] = await Promise.all([
        getRetrospective(found.id),
        getWordCount(found.id),
        listReleases(found.id).catch(() => [] as Release[]),
      ]);
      setArtifact(art);
      setContent(art.data.content);
      setWordCount(wc);
      setReleases(rels);

      if (art.data.ai_passed !== null) {
        setCritique({
          passed: art.data.ai_passed,
          severity: "info",
          concern: art.data.ai_critique,
          reasoning: art.data.ai_critique || "",
          model: "",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);

  function update(key: keyof RetrospectiveContent, value: string) {
    const next = { ...content, [key]: value };
    setContent(next);
    pendingRef.current = next;
    setDirty(true);

    const total =
      next.surprise.split(/\s+/).filter(Boolean).length +
      next.differently.split(/\s+/).filter(Boolean).length +
      next.lesson.split(/\s+/).filter(Boolean).length;
    setWordCount({
      total_words: total,
      min_words: 100,
      passes_gate: total >= 100,
    });
  }

  async function handleSave() {
    if (!project || !pendingRef.current) return;
    setSaving(true);
    try {
      const updated = await patchRetrospective(project.id, pendingRef.current);
      setArtifact(updated);
      pendingRef.current = null;
      setDirty(false);
      toast.success("Retrospective saved");
    } catch (e) {
      toast.error("Could not save", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCritique() {
    if (!project) return;
    if (dirty) {
      await handleSave();
    }
    setCritiquing(true);
    try {
      const result = await critiqueRetrospective(project.id);
      setCritique(result);
      if (result.passed) {
        toast.success("AI approved your retrospective");
      } else {
        toast.warning("AI has a follow-up question", {
          description: result.concern || result.reasoning,
        });
      }
    } catch (e) {
      toast.error("Could not get critique", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setCritiquing(false);
    }
  }

  async function handleDeleteRelease(id: string) {
    if (!project) return;
    try {
      await deleteRelease(project.id, id);
      setReleases((prev) => prev.filter((r) => r.id !== id));
      toast.success("Release deleted");
    } catch (e) {
      toast.error("Could not delete release", {
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

  if (error || !project || !artifact || !wordCount) {
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

  const aiPassed = critique?.passed === true;
  const hasRelease = releases.length > 0;
  const allComplete = aiPassed && hasRelease;

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase="maintenance"
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
          viewedPhase="maintenance"
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <span className="phase-chip mb-3 inline-block">
              Phase 6 — Maintenance
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Reflect, then ship. A retrospective and a release together
              mark this project as complete.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-6">
              {/* Retrospective header */}
              <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <NotebookPen className="w-5 h-5 text-terracotta-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Retrospective
                    </p>
                    <p className="text-xs text-slate-500">
                      Three prompts. Answer honestly.
                    </p>
                  </div>
                </div>
                {dirty && (
                  <span className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">
                    Modified
                  </span>
                )}
              </div>

              {/* The three prompts */}
              {PROMPTS.map((p, idx) => (
                <div
                  key={p.key}
                  className="bg-white border border-slate-200 rounded-xl p-6"
                >
                  <div className="mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-mono text-slate-400">
                        {idx + 1}.
                      </span>
                      <label className="text-sm font-semibold text-slate-900">
                        {p.label}
                      </label>
                    </div>
                    <p className="text-xs text-slate-400 italic mt-1 ml-5">
                      {p.hint}
                    </p>
                  </div>
                  <textarea
                    value={content[p.key]}
                    onChange={(e) => update(p.key, e.target.value)}
                    rows={4}
                    placeholder={p.placeholder}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 resize-none leading-relaxed"
                  />
                </div>
              ))}

              {/* Action bar */}
              <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      "text-sm font-mono",
                      wordCount.passes_gate
                        ? "text-emerald-600 font-semibold"
                        : "text-slate-500"
                    )}
                  >
                    {wordCount.total_words} / {wordCount.min_words} words
                  </div>
                  {wordCount.passes_gate && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {dirty && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      Save draft
                    </button>
                  )}
                  <button
                    onClick={handleCritique}
                    disabled={!wordCount.passes_gate || critiquing}
                    className="inline-flex items-center gap-1.5 bg-terracotta-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terracotta-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {critiquing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Reading…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Ask the AI
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AI critique card */}
              {critique && (
                <div
                  className={clsx(
                    "rounded-xl border px-6 py-5",
                    aiPassed
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {aiPassed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={clsx(
                          "text-sm font-semibold mb-1",
                          aiPassed ? "text-emerald-900" : "text-amber-900"
                        )}
                      >
                        {aiPassed ? "AI approved" : "AI has a follow-up"}
                      </p>
                      {critique.concern && (
                        <p
                          className={clsx(
                            "text-sm leading-relaxed",
                            aiPassed ? "text-emerald-800" : "text-amber-900"
                          )}
                        >
                          {critique.concern}
                        </p>
                      )}
                      {critique.reasoning &&
                        critique.reasoning !== critique.concern && (
                          <p
                            className={clsx(
                              "text-xs leading-relaxed mt-2 italic",
                              aiPassed ? "text-emerald-700" : "text-amber-800"
                            )}
                          >
                            {critique.reasoning}
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Release form */}
              <ReleaseForm projectId={project.id} onCreated={load} />

              {/* Release timeline */}
              <ReleaseTimeline
                releases={releases}
                repoUrl={project.github_repo}
                onDelete={handleDeleteRelease}
              />
            </div>

            {/* Sidebar */}
            <aside className="space-y-4">
              <SupportPanel projectId={project.id} phase="maintenance" />

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Completion
                </h3>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2.5">
                    {aiPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={clsx(
                        "text-xs leading-relaxed",
                        aiPassed ? "text-slate-500" : "text-slate-700"
                      )}
                    >
                      Retrospective written and approved
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    {hasRelease ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={clsx(
                        "text-xs leading-relaxed",
                        hasRelease ? "text-slate-500" : "text-slate-700"
                      )}
                    >
                      First release published
                    </span>
                  </li>
                </ul>

                {allComplete ? (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        Project shipped
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                      This project is complete. Keep iterating with new
                      releases, or start your next idea.
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100 leading-relaxed">
                    Complete both items to mark this project as shipped.
                  </p>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-terracotta-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    AI Mentor
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your AI Mentor reads the retrospective and asks one
                  pointed question. Answer it, and the phase completes.
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
