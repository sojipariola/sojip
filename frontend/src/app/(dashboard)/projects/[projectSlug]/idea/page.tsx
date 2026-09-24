"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseId } from "@/lib/phases";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { DangerZone } from "@/components/projects/DangerZone";
import { EditableField } from "@/components/idea/EditableField";
import { FieldRemarks } from "@/components/idea/FieldRemarks";
import { CanvasActions } from "@/components/idea/CanvasActions";
import { AISuggestionsPanel } from "@/components/idea/AISuggestionsPanel";
import { GateModal } from "@/components/idea/GateModal";
import { PeerValidationList } from "@/components/idea/PeerValidationList";
import { AIMentorPanel } from "@/components/idea/AIMentorPanel";
import { apiFetch } from "@/lib/api-client";
import {
  Artifact,
  Remark,
  createRemark,
  critiqueField,
  deleteRemark,
  getArtifact,
  listRemarks,
  lockArtifact,
  patchArtifact,
  unlockArtifact,
} from "@/lib/workspace-api";
import { useAuthStore } from "@/store/authStore";

const KIND = "lean_canvas";

const FIELDS: {
  key: string;
  label: string;
  prompt: string;
  placeholder: string;
}[] = [
  {
    key: "problem",
    label: "Problem",
    prompt: "Who specifically has this problem?",
    placeholder: "Be narrow — which students, where, and why does it matter?",
  },
  {
    key: "solution",
    label: "Solution",
    prompt: "What does it do?",
    placeholder: "Concrete and verifiable. What will users actually do?",
  },
  {
    key: "unique_value",
    label: "Unique Value",
    prompt: "Why this, and not the obvious alternative?",
    placeholder: "What makes this different from what already exists?",
  },
  {
    key: "unfair_advantage",
    label: "Unfair Advantage",
    prompt: "What can't be easily copied?",
    placeholder: "A partnership, dataset, community — something others can't copy.",
  },
];

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
};

type GateResult = {
  gate: string;
  passed: boolean;
  reason: string;
  missing: string[];
  ai_feedback: string | null;
};

export default function IdeaWorkspacePage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const { user } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [critiquingField, setCritiquingField] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [gateModal, setGateModal] = useState<{
    open: boolean;
    missing: string[];
  }>({ open: false, missing: [] });

  // ─── Load project, artifact, remarks ───
  const load = useCallback(async () => {
    try {
      const all = await apiFetch<Project[]>("/projects");
      const found = all.find((p) => p.slug === projectSlug);
      if (!found) {
        setError("Project not found");
        return;
      }
      setProject(found);

      const [art, rem] = await Promise.all([
        getArtifact(found.id, KIND),
        listRemarks(found.id),
      ]);
      setArtifact(art);
      setRemarks(rem);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);


  // ─── Group remarks by field ───
  const remarksByField = useMemo(() => {
    const map: Record<string, Remark[]> = {};
    for (const r of remarks) {
      if (!map[r.field_path]) map[r.field_path] = [];
      map[r.field_path].push(r);
    }
    return map;
  }, [remarks]);

  // ─── Save a single field ───
  async function saveField(key: string, value: string) {
    if (!project || !artifact) throw new Error("No artifact");
    const updated = await patchArtifact(project.id, KIND, { [key]: value });
    setArtifact(updated);
  }

  // ─── Post a remark ───
  async function postRemark(fieldPath: string, body: string) {
    if (!project) return;
    const created = await createRemark(project.id, fieldPath, body);
    setRemarks((prev) => [...prev, created]);
  }

  // ─── Delete a remark ───
  async function handleDeleteRemark(id: string) {
    if (!project) return;
    await deleteRemark(project.id, id);
    setRemarks((prev) => prev.filter((r) => r.id !== id));
  }

  // ─── AI critique ───
  async function handleCritique(fieldPath: string) {
    if (!project) return;
    setCritiquingField(fieldPath);
    try {
      const created = await critiqueField(project.id, KIND, fieldPath);
      setRemarks((prev) => [...prev, created]);
    } catch (e) {
      // Optimistic — silently ignore; a toast would be better
      console.error(e);
    } finally {
      setCritiquingField(null);
    }
  }

  // ─── Lock / unlock ───
  async function handleLock() {
    if (!project) return;
    const updated = await lockArtifact(project.id, KIND);
    setArtifact(updated);
  }

  async function handleUnlock() {
    if (!project) return;
    const updated = await unlockArtifact(project.id, KIND);
    setArtifact(updated);
  }

  // ─── Advance to Plan ───
  async function handleAdvance() {
    if (!project) return;
    setAdvancing(true);
    try {
      const result = await apiFetch<GateResult>(
        `/projects/${project.id}/gates/idea/validate`,
        { method: "POST" }
      );
      if (result.passed) {
        setGateModal({
          open: true,
          missing: [
            "Gate passed! Advance endpoint lands in Step 11.4.",
          ],
        });
      } else {
        setGateModal({ open: true, missing: result.missing });
      }
    } catch (e) {
      setGateModal({
        open: true,
        missing: [e instanceof Error ? e.message : "Gate check failed"],
      });
    } finally {
      setAdvancing(false);
    }
  }

  // ─── Loading / error states ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (error || !project || !artifact) {
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

  const isOwner = project.owner_id === user?.id;
  const isTeacher =
    user?.role === "teacher" || user?.role === "admin";
  const canPostRemarks = !!user;
  const canLock = isOwner && !artifact.locked_at;
  const canUnlock = isOwner || isTeacher;

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase="idea"
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
          viewedPhase="idea"
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-8">
            <span className="phase-chip mb-3 inline-block">Phase 1 — Idea</span>
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
            {/* Center: canvas */}
            <div>
              <AISuggestionsPanel remarks={remarks} />

              <div className="space-y-4">
                {FIELDS.map((f) => {
                  const value = (artifact.data[f.key] as string) || "";
                  const fieldRemarks = remarksByField[f.key] || [];
                  return (
                    <EditableField
                      key={f.key}
                      label={f.label}
                      prompt={f.prompt}
                      placeholder={f.placeholder}
                      value={value}
                      onSave={(next) => saveField(f.key, next)}
                      onRequestCritique={() => handleCritique(f.key)}
                      critiquing={critiquingField === f.key}
                      locked={!!artifact.locked_at}
                    >
                      <FieldRemarks
                        remarks={fieldRemarks}
                        canPost={canPostRemarks && !artifact.locked_at}
                        onPost={(body) => postRemark(f.key, body)}
                        onDelete={handleDeleteRemark}
                        currentUserId={user?.id}
                        currentUserRole={user?.role}
                      />
                    </EditableField>
                  );
                })}
              </div>

              {/* Actions row */}
              <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
                <CanvasActions
                  locked={!!artifact.locked_at}
                  canLock={canLock}
                  canUnlock={canUnlock}
                  onLock={handleLock}
                  onUnlock={handleUnlock}
                />

                <button
                  onClick={handleAdvance}
                  disabled={advancing}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {advancing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking the gate…
                    </>
                  ) : (
                    <>
                      Advance to Plan
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: AI + peer validations */}
            <aside className="space-y-4">
              <SupportPanel projectId={project.id} phase="idea" />

              <AIMentorPanel projectId={project.id} />
              <PeerValidationList projectId={project.id} />
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

      <GateModal
        open={gateModal.open}
        onClose={() => setGateModal({ open: false, missing: [] })}
        currentPhaseName="Idea"
        nextPhaseName="Plan"
        missing={gateModal.missing}
      />
    </div>
  );
}
