"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock, Plus, Printer, Sparkles } from "lucide-react";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseId } from "@/lib/phases";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { DangerZone } from "@/components/projects/DangerZone";
import { DependencyCanvas } from "@/components/plan/DependencyCanvas";
import { CriticalPathPanel } from "@/components/plan/CriticalPathPanel";
import { PlanMetaPanel } from "@/components/plan/PlanMetaPanel";
import { PlanDiagram } from "@/components/plan/PlanDiagram";
import { AIPlannerDialog } from "@/components/plan/AIPlannerDialog";
import { AIMentorPanel } from "@/components/shared/AIMentorPanel";
import { apiFetch } from "@/lib/api-client";
import {
  CriticalPath,
  TaskGraph,
  TaskWithTimeline,
  addDependency,
  addTask,
  deleteTask,
  getCriticalPath,
  getPlan,
  getPlanDetailed,
  PlanDetailed,
  removeDependency,
  updatePlanMeta,
} from "@/lib/plan-api";
import { useAuthStore } from "@/store/authStore";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
};

export default function PlanWorkspacePage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const { user } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [graph, setGraph] = useState<TaskGraph | null>(null);
  const [criticalPath, setCriticalPath] = useState<CriticalPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDays, setNewTaskDays] = useState(3);
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "diagram">("list");
  const [detailed, setDetailed] = useState<PlanDetailed | null>(null);
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await apiFetch<Project[]>("/projects");
      const found = all.find((p) => p.slug === projectSlug);
      if (!found) {
        setError("Project not found");
        return;
      }
      setProject(found);

      const [g, cp, det] = await Promise.all([
        getPlan(found.id),
        getCriticalPath(found.id),
        getPlanDetailed(found.id),
      ]);
      setGraph(g);
      setCriticalPath(cp);
      setDetailed(det);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const tasks = graph?.tasks ?? [];
  const locked = false;

  async function handleAdd() {
    if (!project || newTaskName.trim().length < 2) return;
    setAdding(true);
    try {
      await addTask(project.id, {
        name: newTaskName.trim(),
        estimate_days: newTaskDays,
      });
      setNewTaskName("");
      setNewTaskDays(3);
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(taskId: string) {
    if (!project) return;
    await deleteTask(project.id, taskId);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    await load();
  }

  async function handleAddDependency(fromId: string, toId: string) {
    if (!project) return;
    try {
      await addDependency(project.id, fromId, toId);
      await load();
    } catch (e) {
      // Cycle error — surface briefly
      alert(e instanceof Error ? e.message : "Could not add dependency");
    }
  }

  async function handleRemoveDependency(fromId: string, toId: string) {
    if (!project) return;
    await removeDependency(project.id, fromId, toId);
    await load();
  }

  async function handleSaveMeta(payload: {
    deadline: string | null;
    budget_days: number | null;
  }) {
    if (!project) return;
    await updatePlanMeta(project.id, payload);
    await load();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (error || !project || !graph) {
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

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase="plan"
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
          viewedPhase="plan"
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          <div className="mb-8">
            <span className="phase-chip mb-3 inline-block">
              Phase 2 — Plan
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Every task has a duration. Every dependency is an arrow.
              The critical path shows what can't slip.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            <div>
              {/* Toolbar */}
              <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={
                    viewMode === "list"
                      ? "px-3 py-1.5 text-xs font-medium bg-white text-slate-900 rounded-md shadow-sm"
                      : "px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md"
                  }
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("diagram")}
                  className={
                    viewMode === "diagram"
                      ? "px-3 py-1.5 text-xs font-medium bg-white text-slate-900 rounded-md shadow-sm"
                      : "px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md"
                  }
                >
                  Diagram
                </button>
              </div>

              <button
                onClick={() => setAiPlannerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-terracotta-300 text-terracotta-700 rounded-md hover:bg-terracotta-50 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate tasks with AI
              </button>
              </div>
              </div>

              {/* Add task bar — only in list mode */}
              {viewMode === "list" && (
              <div className="mb-4 flex items-center gap-2">
                <input
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  placeholder="Add a task…"
                  className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
                />
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={newTaskDays}
                  onChange={(e) => setNewTaskDays(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-2.5 text-sm border border-slate-300 rounded-lg text-center"
                />
                <span className="text-xs text-slate-500">days</span>
                <button
                  onClick={handleAdd}
                  disabled={adding || newTaskName.trim().length < 2}
                  className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </button>
              </div>
              )}

              {viewMode === "list" && (
                <DependencyCanvas
                  tasks={tasks}
                  locked={locked}
                  selectedTaskId={selectedTaskId}
                  onSelect={setSelectedTaskId}
                  onAddDependency={handleAddDependency}
                  onRemoveDependency={handleRemoveDependency}
                  onDeleteTask={handleDelete}
                />
              )}

              {viewMode === "diagram" && detailed && (
                <PlanDiagram plan={detailed} />
              )}

              <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {locked ? (
                    <div className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <Lock className="w-3.5 h-3.5" />
                      Locked for review
                    </div>
                  ) : null}
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                </div>

                <button
                  disabled
                  title="Step 12.5C delivers the Plan → Blueprint gate"
                  className="inline-flex items-center gap-2 bg-slate-200 text-slate-500 px-5 py-3 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  Advance to Blueprint
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            </div>

            <aside className="space-y-4">
              <SupportPanel projectId={project.id} phase="plan" />

              <AIMentorPanel projectId={project.id} gate="plan" />
              <CriticalPathPanel
                criticalPath={criticalPath}
                tasks={tasks}
              />
              <PlanMetaPanel
                deadline={graph.deadline}
                budgetDays={graph.budget_days}
                locked={locked}
                onSave={handleSaveMeta}
              />
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
      <AIPlannerDialog
        projectId={project.id}
        open={aiPlannerOpen}
        onOpenChange={setAiPlannerOpen}
        onAccepted={load}
      />
    </div>
  );
}
