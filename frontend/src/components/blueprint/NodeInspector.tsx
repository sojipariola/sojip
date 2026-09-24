"use client";

import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

import { DiagramNode, NODE_KINDS } from "@/lib/blueprint-api";

interface Props {
  node: DiagramNode | null;
  onClose: () => void;
  onSave: (nodeId: string, updates: Partial<DiagramNode>) => Promise<void>;
}

export function NodeInspector({ node, onClose, onSave }: Props) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("backend");
  const [description, setDescription] = useState("");
  const [techInput, setTechInput] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setKind(node.kind);
      setDescription(node.description || "");
      setTechStack(node.tech_stack || []);
      setTechInput("");
    }
  }, [node]);

  if (!node) return null;

  function addTech() {
    const t = techInput.trim();
    if (!t) return;
    if (techStack.includes(t)) return;
    setTechStack([...techStack, t]);
    setTechInput("");
  }

  function removeTech(t: string) {
    setTechStack(techStack.filter((x) => x !== t));
  }

  async function save() {
    if (!node) return;
    if (label.trim().length < 1) {
      toast.error("Label cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await onSave(node.id, {
        label: label.trim(),
        kind,
        description: description.trim() || null,
        tech_stack: techStack,
      });
      toast.success("Node updated");
      onClose();
    } catch (e) {
      toast.error("Could not save node", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-terracotta-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Edit node</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Label
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Kind
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
          >
            {NODE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What does this node do?"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Tech stack
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTech();
                }
              }}
              placeholder="e.g., PostgreSQL"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
            />
            <button
              onClick={addTech}
              className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
            >
              Add
            </button>
          </div>
          {techStack.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {techStack.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[10px] bg-terracotta-50 border border-terracotta-200 text-terracotta-700 px-1.5 py-0.5 rounded"
                >
                  {t}
                  <button
                    onClick={() => removeTech(t)}
                    className="text-terracotta-500 hover:text-terracotta-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
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
  );
}
