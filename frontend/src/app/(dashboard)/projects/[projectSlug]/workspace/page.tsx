"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { WorkspaceToolbar } from "@/components/workspace/WorkspaceToolbar";
import { ComponentRenderer } from "@/components/workspace/ComponentRenderer";
import { ComponentInspector } from "@/components/workspace/ComponentInspector";
import { ComponentFrame } from "@/components/workspace/ComponentFrame";
import { apiFetch } from "@/lib/api-client";
import {
  LayoutMode,
  WorkspaceArtifact,
  WorkspaceComponent,
  addComponent,
  deleteComponent,
  getWorkspace,
  patchWorkspace,
  reorderComponents,
  updateComponent,
} from "@/lib/workspace-ui-api";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: any;
  owner_id: string;
};

export default function WorkspacePage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceArtifact | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Pending changes (before Save is clicked)
  const pendingComponentsRef = useRef<WorkspaceComponent[] | null>(null);
  const pendingModeRef = useRef<LayoutMode | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await apiFetch<Project[]>("/projects");
      const found = all.find((p) => p.slug === projectSlug);
      if (!found) {
        setError("Project not found");
        return;
      }
      setProject(found);
      const ws = await getWorkspace(found.id);
      // Normalize layout.order — some components may have null orders
      // from earlier testing. Assign sequential 0..N-1.
      const normalized = [...ws.data.components]
        .sort((a, b) => (a.layout.order ?? 0) - (b.layout.order ?? 0))
        .map((c, i) => ({
          ...c,
          layout: { ...c.layout, order: i },
        }));
      ws.data.components = normalized;
      setWorkspace(ws);
      pendingComponentsRef.current = null;
      pendingModeRef.current = null;
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Local state helpers ──────────────────────────────
  function updateLocal(
    updater: (c: WorkspaceComponent[]) => WorkspaceComponent[]
  ) {
    if (!workspace) return;
    const current = pendingComponentsRef.current ?? workspace.data.components;
    const next = updater(current);
    pendingComponentsRef.current = next;
    setWorkspace({
      ...workspace,
      data: { ...workspace.data, components: next },
    });
    setDirty(true);
  }

  function updateModeLocal(mode: LayoutMode) {
    if (!workspace) return;
    if (workspace.data.mode === mode) return;
    pendingModeRef.current = mode;
    setWorkspace({ ...workspace, data: { ...workspace.data, mode } });
    setDirty(true);
  }

  // ─── Actions ──────────────────────────────────────────
  async function handleAdd(type: string) {
    if (!project || !workspace) return;
    try {
      // Create the component on the server (so we get a real ID),
      // then add it to the pending list.
      const created = await addComponent(project.id, { type });
      updateLocal((c) => [...c, created]);
      setSelectedId(created.id);
    } catch (e) {
      toast.error("Could not add component", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  async function handleSave() {
    if (!project || !workspace) return;
    setSaving(true);
    try {
      // 1. Save mode if changed
      if (pendingModeRef.current) {
        await patchWorkspace(project.id, { mode: pendingModeRef.current });
        pendingModeRef.current = null;
      }

      // 2. Save component list if changed
      if (pendingComponentsRef.current) {
        // Persist each changed component individually — the workspace
        // backend already supports PATCH per component. For simplicity
        // we send a full replace of the component list.
        await patchWorkspace(project.id, {
          components: pendingComponentsRef.current,
        });
        pendingComponentsRef.current = null;
      }

      const refreshed = await getWorkspace(project.id);
      setWorkspace(refreshed);
      setDirty(false);
      toast.success("Workspace saved");
    } catch (e) {
      toast.error("Could not save", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDuplicate(id: string) {
    const current = pendingComponentsRef.current ?? workspace?.data.components ?? [];
    const source = current.find((c) => c.id === id);
    if (!source) return;
    // Optimistic ID — replaced with server ID after save
    const draft: WorkspaceComponent = {
      id: "c-" + Math.random().toString(36).slice(2, 12),
      type: source.type,
      props: { ...source.props },
      layout: { ...source.layout },
    };
    updateLocal((c) => [...c, draft]);
    setSelectedId(draft.id);
  }

  function handleMoveUp(id: string) {
    const current = pendingComponentsRef.current ?? workspace?.data.components ?? [];
    const sorted = [...current].sort(
      (a, b) => (a.layout.order ?? 0) - (b.layout.order ?? 0)
    );
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx <= 0) return;
    [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
    const reordered = sorted.map((c, i) => ({
      ...c,
      layout: { ...c.layout, order: i },
    }));
    updateLocal(() => reordered);
  }

  function handleMoveDown(id: string) {
    const current = pendingComponentsRef.current ?? workspace?.data.components ?? [];
    const sorted = [...current].sort(
      (a, b) => (a.layout.order ?? 0) - (b.layout.order ?? 0)
    );
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
    const reordered = sorted.map((c, i) => ({
      ...c,
      layout: { ...c.layout, order: i },
    }));
    updateLocal(() => reordered);
  }

  async function handleDelete(id: string) {
    if (!project || !workspace) return;
    try {
      await deleteComponent(project.id, id);
      updateLocal((c) => c.filter((x) => x.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      toast.error("Could not delete", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  function handleUpdateProps(id: string, props: Record<string, unknown>) {
    updateLocal((cs) =>
      cs.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...props } } : c))
    );
  }

  function handleReorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const current = pendingComponentsRef.current ?? workspace?.data.components ?? [];
    const sorted = [...current].sort(
      (a, b) => (a.layout.order ?? 0) - (b.layout.order ?? 0)
    );
    const fromIdx = sorted.findIndex((c) => c.id === fromId);
    const toIdx = sorted.findIndex((c) => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const reordered = sorted.map((c, i) => ({
      ...c,
      layout: { ...c.layout, order: i },
    }));
    updateLocal(() => reordered);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (error || !project || !workspace) {
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

  const sorted = [...workspace.data.components].sort(
    (a, b) => (a.layout.order ?? 0) - (b.layout.order ?? 0)
  );
  const selected = sorted.find((c) => c.id === selectedId) || null;
  const previewUrl = "/preview/" + workspace.id;

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase={project.current_phase}
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

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="mb-4">
          <span className="phase-chip mb-2 inline-block">UI Workspace</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {project.name}
          </h1>
        </div>

        {/* Support launcher — same three tabs as every phase page */}
        <div className="mb-4">
          <SupportPanel
            projectId={project.id}
            phase={project.current_phase}
            variant="inline"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <WorkspaceToolbar
            mode={workspace.data.mode}
            onModeChange={(m) => updateModeLocal(m)}
            onAdd={handleAdd}
            onSave={handleSave}
            saving={saving}
            dirty={dirty}
            previewUrl={previewUrl}
          />

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px]">
            {/* Canvas */}
            <div
              className="p-8 min-h-[600px] bg-slate-50/30"
              onClick={() => setSelectedId(null)}
            >
              {sorted.length === 0 ? (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center max-w-sm">
                    <Sparkles className="w-6 h-6 text-terracotta-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      Your canvas is empty
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Click <strong>Add component</strong> at the top to place
                      your first element.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-3">
                  {sorted.map((c) => (
                    <ComponentFrame
                      key={c.id}
                      id={c.id}
                      type={c.type}
                      selected={c.id === selectedId}
                      isDragging={c.id === dragId}
                      onSelect={() => setSelectedId(c.id)}
                      onDuplicate={() => handleDuplicate(c.id)}
                      onMoveUp={() => handleMoveUp(c.id)}
                      onMoveDown={() => handleMoveDown(c.id)}
                      onDelete={() => handleDelete(c.id)}
                      isDropTarget={dropTargetId === c.id}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropTargetId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (dragId && dragId !== c.id) {
                          setDropTargetId(c.id);
                        }
                      }}
                      onDragLeave={(e) => {
                        // Only clear if we're leaving the frame entirely
                        if (
                          e.currentTarget &&
                          e.relatedTarget &&
                          e.currentTarget.contains(e.relatedTarget as Node)
                        ) {
                          return;
                        }
                        if (dropTargetId === c.id) {
                          setDropTargetId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId && dragId !== c.id) {
                          handleReorder(dragId, c.id);
                        }
                        setDropTargetId(null);
                      }}
                    >
                      <ComponentRenderer type={c.type} props={c.props} />
                    </ComponentFrame>
                  ))}
                </div>
              )}
            </div>

            {/* Inspector */}
            <aside className="border-l border-slate-200 bg-white">
              <ComponentInspector
                component={selected}
                onChange={(props) =>
                  selected && handleUpdateProps(selected.id, props)
                }
                onDelete={() => selected && handleDelete(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            </aside>
          </div>
        </div>

        {dirty && (
          <p className="text-xs text-amber-600 mt-3 text-center">
            You have unsaved changes. Click <strong>Save</strong> to persist.
          </p>
        )}
      </div>
    </div>
  );
}
