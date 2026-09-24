"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { ComponentRenderer } from "@/components/workspace/ComponentRenderer";
import { apiFetch } from "@/lib/api-client";
import { WorkspaceArtifact, getWorkspace } from "@/lib/workspace-ui-api";

export default function PreviewPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const projects = await apiFetch<Array<{ id: string }>>("/projects");
        for (const p of projects) {
          try {
            const ws = await getWorkspace(p.id);
            if (ws.id === workspaceId) {
              setWorkspace(ws);
              return;
            }
          } catch {
            // ignore
          }
        }
        setError("Workspace not found");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-slate-500 text-sm">
          {error || "Workspace not found"}
        </p>
      </div>
    );
  }

  const sorted = [...workspace.data.components].sort(
    (a, b) => (a.layout.order ?? 0) - (b.layout.order ?? 0)
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-24">
            This workspace is empty.
          </p>
        ) : (
          sorted.map((c) => (
            <div key={c.id}>
              <ComponentRenderer type={c.type} props={c.props} />
            </div>
          ))
        )}
      </div>
      <div className="text-center py-6 text-[10px] text-slate-300">
        Powered by SOJIP
      </div>
    </div>
  );
}
