"use client";

import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProposedTask,
  aiAcceptTasks,
  aiProposeTasks,
} from "@/lib/plan-api";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void | Promise<void>;
}

export function AIPlannerDialog({
  projectId,
  open,
  onOpenChange,
  onAccepted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState<ProposedTask[] | null>(null);
  const [reasoning, setReasoning] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [accepting, setAccepting] = useState(false);

  async function propose() {
    setLoading(true);
    setProposed(null);
    try {
      const res = await aiProposeTasks(projectId);
      setProposed(res.tasks);
      setReasoning(res.reasoning);
      const sel: Record<string, boolean> = {};
      res.tasks.forEach((t) => (sel[t.id] = true));
      setSelected(sel);
    } catch (e) {
      toast.error("Could not generate tasks", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!proposed) return;
    const chosen = proposed.filter((t) => selected[t.id]);
    if (chosen.length === 0) {
      toast.error("Select at least one task");
      return;
    }
    setAccepting(true);
    try {
      await aiAcceptTasks(projectId, chosen);
      toast.success(`Added ${chosen.length} task${chosen.length === 1 ? "" : "s"}`);
      onOpenChange(false);
      setProposed(null);
      await onAccepted();
    } catch (e) {
      toast.error("Could not add tasks", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-terracotta-600" />
            AI Planner
          </DialogTitle>
          <DialogDescription>
            The AI reads your Idea canvas and proposes a starter task list.
            Keep what fits, discard the rest.
          </DialogDescription>
        </DialogHeader>

        {!proposed && !loading && (
          <div className="py-8 text-center">
            <Sparkles className="w-6 h-6 text-terracotta-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
              Reading your Lean Canvas usually takes 30–90 seconds on CPU
              inference.
            </p>
            <button
              onClick={propose}
              className="inline-flex items-center gap-2 bg-terracotta-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-terracotta-700 transition"
            >
              <Sparkles className="w-4 h-4" />
              Generate starter tasks
            </button>
          </div>
        )}

        {loading && (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-terracotta-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600">
              Reading your canvas and drafting tasks…
            </p>
          </div>
        )}

        {proposed && (
          <div className="space-y-3">
            {reasoning && (
              <div className="text-xs text-slate-500 italic border-l-2 border-terracotta-300 pl-3">
                {reasoning}
              </div>
            )}

            <div className="space-y-2">
              {proposed.map((t) => (
                <label
                  key={t.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[t.id]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [t.id]: e.target.checked }))
                    }
                    className="mt-0.5 accent-terracotta-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">
                        {t.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t.estimate_days}d
                      </span>
                      {t.must_have && (
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
                          Must-have
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        {t.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {proposed && (
            <>
              <button
                onClick={() => setProposed(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Start over
              </button>
              <button
                onClick={accept}
                disabled={accepting}
                className="inline-flex items-center gap-2 bg-terracotta-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terracotta-700 transition disabled:opacity-50"
              >
                {accepting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add {Object.values(selected).filter(Boolean).length} task
                {Object.values(selected).filter(Boolean).length === 1 ? "" : "s"}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
