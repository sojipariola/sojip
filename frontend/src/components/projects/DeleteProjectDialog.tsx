"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { deleteProject } from "@/lib/projects-api";
import { ApiError } from "@/lib/api-client";

interface Props {
  projectId: string;
  projectSlug: string;
  projectName: string;
  /** Called after successful deletion, before navigation. */
  onDeleted: () => void;
  onClose: () => void;
}

type Stage = "confirm-slug" | "final-warning";

export function DeleteProjectDialog({
  projectId,
  projectSlug,
  projectName,
  onDeleted,
  onClose,
}: Props) {
  const [stage, setStage] = useState<Stage>("confirm-slug");
  const [typedSlug, setTypedSlug] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const slugMatches = typedSlug.trim() === projectSlug;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function next() {
    if (!slugMatches) return;
    setStage("final-warning");
  }

  async function doDelete(force: boolean) {
    setSubmitting(true);
    try {
      await deleteProject(projectId, typedSlug.trim(), force);
      toast.success("Project deleted", {
        description: `"${projectName}" and everything in it has been removed.`,
      });
      onDeleted();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Server detected content and wants force=true. Bounce into the
        // final-warning stage if we weren't already there.
        setHasContent(true);
        setStage("final-warning");
        toast.warning("Work in progress detected", {
          description:
            "This project has unsaved work. Confirm again to force deletion.",
        });
      } else if (e instanceof ApiError) {
        toast.error("Could not delete", { description: e.detail });
      } else {
        toast.error("Could not delete");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Delete project
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              This action cannot be undone.
            </p>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            className="text-slate-400 hover:text-slate-700 transition p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — stage 1: confirm slug */}
        {stage === "confirm-slug" && (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900 leading-relaxed">
              Deleting <strong>{projectName}</strong> permanently removes:
              <ul className="mt-2 ml-4 space-y-0.5 list-disc text-red-800">
                <li>Every phase artifact (canvas, tasks, diagram, retrospective)</li>
                <li>All peer validations and teacher comments</li>
                <li>Scaffold jobs, releases, and deployment records</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                To confirm, type the project's URL slug:
              </label>
              <div className="text-xs text-slate-500 mb-2 font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 inline-block">
                {projectSlug}
              </div>
              <input
                autoFocus
                value={typedSlug}
                onChange={(e) => setTypedSlug(e.target.value)}
                placeholder="type the slug exactly"
                className={clsx(
                  "w-full px-3.5 py-2.5 rounded-lg border text-sm font-mono transition",
                  "focus:outline-none focus:ring-2 focus:ring-red-500/40",
                  slugMatches
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-slate-300"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && slugMatches) next();
                }}
              />
              {typedSlug.length > 0 && !slugMatches && (
                <p className="text-xs text-red-600 mt-1.5">
                  Doesn't match yet.
                </p>
              )}
              {slugMatches && (
                <p className="text-xs text-emerald-600 mt-1.5 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" strokeWidth={3} />
                  Slug matches
                </p>
              )}
            </div>
          </div>
        )}

        {/* Body — stage 2: final warning */}
        {stage === "final-warning" && (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-900 mb-1">
                    {hasContent
                      ? "This project has work in progress"
                      : "Last chance"}
                  </div>
                  <p className="text-sm text-red-800 leading-relaxed">
                    {hasContent ? (
                      <>
                        Every artifact, task, diagram, and comment will be
                        destroyed permanently. There is no recovery.
                      </>
                    ) : (
                      <>
                        You are about to permanently delete{" "}
                        <strong>{projectName}</strong>. This cannot be undone.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 accent-red-600"
              />
              <span className="text-sm text-slate-700 leading-relaxed">
                I understand this is permanent and I want to delete{" "}
                <strong>{projectName}</strong>.
              </span>
            </label>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => !submitting && onClose()}
            className="text-sm text-slate-600 hover:text-slate-900 transition"
            disabled={submitting}
          >
            Cancel
          </button>

          {stage === "confirm-slug" && (
            <button
              onClick={next}
              disabled={!slugMatches}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition",
                slugMatches
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              Continue
            </button>
          )}

          {stage === "final-warning" && (
            <button
              onClick={() => doDelete(hasContent)}
              disabled={!acknowledged || submitting}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition",
                acknowledged && !submitting
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete forever
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
