"use client";

import { useEffect, useState } from "react";
import { Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { DiagramEdge } from "@/lib/blueprint-api";

interface Props {
  edge: DiagramEdge | null;
  sourceLabel: string;
  targetLabel: string;
  onClose: () => void;
  onSave: (edgeId: string, updates: Partial<DiagramEdge>) => Promise<void>;
  onDelete: (edgeId: string) => Promise<void>;
}

const EDGE_KINDS = [
  { id: "api_call", label: "API Call", hint: "An HTTP request from one service to another" },
  { id: "data_flow", label: "Data Flow", hint: "A directional movement of data" },
  { id: "event", label: "Event", hint: "An async message published on a bus" },
  { id: "dependency", label: "Dependency", hint: "One service depends on another for existence" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function EdgeInspector({
  edge,
  sourceLabel,
  targetLabel,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [kind, setKind] = useState("data_flow");
  const [label, setLabel] = useState("");
  const [method, setMethod] = useState("");
  const [path, setPath] = useState("");
  const [authenticated, setAuthenticated] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (edge) {
      setKind(edge.kind || "data_flow");
      setLabel(edge.label || "");
      setMethod(edge.method || "");
      setPath(edge.path || "");
      setAuthenticated(edge.authenticated ?? true);
      setRateLimited(edge.rate_limited ?? false);
    }
  }, [edge]);

  if (!edge) return null;

  const kindMeta = EDGE_KINDS.find((k) => k.id === kind) || EDGE_KINDS[1];
  const showHttpFields = kind === "api_call";

  async function save() {
    if (!edge) return;
    setSaving(true);
    try {
      await onSave(edge.id, {
        kind,
        label: label.trim() || null,
        method: showHttpFields ? method || null : null,
        path: showHttpFields ? path.trim() || null : null,
        authenticated: showHttpFields ? authenticated : true,
        rate_limited: showHttpFields ? rateLimited : false,
      } as any);
      toast.success("Edge updated");
      onClose();
    } catch (e) {
      toast.error("Could not save edge", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!edge) return;
    if (!confirm("Delete this edge?")) return;
    try {
      await onDelete(edge.id);
      toast.success("Edge deleted");
      onClose();
    } catch (e) {
      toast.error("Could not delete edge", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return (
    <div className="bg-white border border-terracotta-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Edit edge</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="text-xs text-slate-500 mb-3">
        <span className="font-medium text-slate-700">{sourceLabel}</span>
        <span className="mx-1">→</span>
        <span className="font-medium text-slate-700">{targetLabel}</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Kind
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
          >
            {EDGE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1 italic">
            {kindMeta.hint}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Label <span className="text-slate-400">(optional)</span>
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., fetch user data"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
          />
        </div>

        {showHttpFields && (
          <>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
                >
                  <option value="">—</option>
                  {HTTP_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Path
                </label>
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/api/users/:id"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 font-mono text-xs"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Method and path feed the OpenAPI generator and the security linter.
            </p>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authenticated}
                  onChange={(e) => setAuthenticated(e.target.checked)}
                  className="accent-terracotta-600"
                />
                Requires authentication
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rateLimited}
                  onChange={(e) => setRateLimited(e.target.checked)}
                  className="accent-terracotta-600"
                />
                Rate limited
              </label>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={remove}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
