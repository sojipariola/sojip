"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Network } from "lucide-react";
import { toast } from "sonner";

import { SOJIPStepper } from "@/components/shared/SOJIPStepper";
import { PhaseId } from "@/lib/phases";
import { PhaseJumpBar } from "@/components/shared/PhaseJumpBar";
import { SupportPanel } from "@/components/shared/SupportPanel";
import { DangerZone } from "@/components/projects/DangerZone";
import { AIMentorPanel } from "@/components/shared/AIMentorPanel";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { NodePalette } from "@/components/blueprint/NodePalette";
import { NodeInspector } from "@/components/blueprint/NodeInspector";
import { EdgeInspector } from "@/components/blueprint/EdgeInspector";
import { SecurityLinterPanel } from "@/components/blueprint/SecurityLinterPanel";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import {
  BlueprintArtifact,
  DiagramEdge,
  DiagramNode,
  getBlueprint,
  saveBlueprint,
} from "@/lib/blueprint-api";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  current_phase: PhaseId;
  owner_id: string;
};

export default function BlueprintPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();

  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [artifact, setArtifact] = useState<BlueprintArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await apiFetch<Project[]>("/projects");
      const found = all.find((p) => p.slug === projectSlug);
      if (!found) {
        setError("Project not found");
        return;
      }
      setProject(found);
      const art = await getBlueprint(found.id);
      setArtifact(art);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = useCallback(
    async (nodes: DiagramNode[], edges: DiagramEdge[]) => {
      if (!project || !artifact) return;
      setSaving(true);
      try {
        const updated = await saveBlueprint(project.id, { nodes, edges });
        setArtifact(updated);
      } catch (e) {
        toast.error("Could not save diagram", {
          description: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        setSaving(false);
      }
    },
    [project, artifact]
  );

  const handleAddNode = useCallback(
    (kind: string) => {
      if (!project || !artifact) return;
      const id = `n-${Date.now()}`;
      const newNode: DiagramNode = {
        id,
        label: `New ${kind}`,
        kind,
        description: null,
        tech_stack: [],
        position: {
          x: 100 + Math.random() * 400,
          y: 100 + Math.random() * 300,
        },
      };
      handleChange([...artifact.data.nodes, newNode], artifact.data.edges);
    },
    [project, artifact, handleChange]
  );

  const handleUpdateNode = useCallback(
    async (nodeId: string, updates: Partial<DiagramNode>) => {
      if (!project || !artifact) return;
      const nextNodes = artifact.data.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n
      );
      await handleChange(nextNodes, artifact.data.edges);
    },
    [project, artifact, handleChange]
  );

  const handleUpdateEdge = useCallback(
    async (edgeId: string, updates: Partial<DiagramEdge>) => {
      if (!project || !artifact) return;
      const nextEdges = artifact.data.edges.map((e) =>
        e.id === edgeId ? { ...e, ...updates } : e
      );
      await handleChange(artifact.data.nodes, nextEdges);
    },
    [project, artifact, handleChange]
  );

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!project || !artifact) return;
      const nextEdges = artifact.data.edges.filter((e) => e.id !== edgeId);
      await handleChange(artifact.data.nodes, nextEdges);
    },
    [project, artifact, handleChange]
  );

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

  const locked = !!artifact.locked_at;

  return (
    <div className="min-h-screen bg-offwhite">
      <PhaseJumpBar
        projectSlug={project.slug}
        currentPhase={project.current_phase}
        viewedPhase="blueprint"
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
          viewedPhase="blueprint"
          projectSlug={project.slug}
        />

        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="phase-chip">Phase 3 — Blueprint</span>
              {saving && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving…
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Draw the boxes and arrows of your system. Every box gets a
              tech stack. Every arrow becomes an API, a data flow, or an
              event.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            <div>
              <BlueprintCanvas
                nodes={artifact.data.nodes}
                edges={artifact.data.edges}
                onChange={handleChange}
                locked={locked}
                onNodeDoubleClick={(nodeId) => {
                  setSelectedEdgeId(null);
                  setSelectedNodeId(nodeId);
                }}
                onEdgeClick={(edgeId) => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(edgeId);
                }}
              />

              {artifact.data.nodes.length === 0 && (
                <div className="mt-6 bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
                  <Network className="w-6 h-6 text-terracotta-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">
                    Start by adding a Frontend and a Backend node from the
                    palette on the right.
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <SupportPanel projectId={project.id} phase="blueprint" />

              {selectedEdgeId && (
                <EdgeInspector
                  edge={
                    artifact.data.edges.find((e) => e.id === selectedEdgeId) ||
                    null
                  }
                  sourceLabel={
                    artifact.data.nodes.find(
                      (n) =>
                        n.id ===
                        artifact.data.edges.find(
                          (e) => e.id === selectedEdgeId
                        )?.source
                    )?.label || "source"
                  }
                  targetLabel={
                    artifact.data.nodes.find(
                      (n) =>
                        n.id ===
                        artifact.data.edges.find(
                          (e) => e.id === selectedEdgeId
                        )?.target
                    )?.label || "target"
                  }
                  onClose={() => setSelectedEdgeId(null)}
                  onSave={handleUpdateEdge}
                  onDelete={handleDeleteEdge}
                />
              )}
              {selectedNodeId && (
                <NodeInspector
                  node={
                    artifact.data.nodes.find((n) => n.id === selectedNodeId) ||
                    null
                  }
                  onClose={() => setSelectedNodeId(null)}
                  onSave={handleUpdateNode}
                />
              )}
              <NodePalette onAdd={handleAddNode} />
              <SecurityLinterPanel projectId={project.id} />
              <AIMentorPanel projectId={project.id} gate="blueprint" />
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
