"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import clsx from "clsx";

import { DeleteProjectDialog } from "./DeleteProjectDialog";

interface Props {
  projectId: string;
  projectSlug: string;
  projectName: string;
  /** Only the owner or an admin sees the danger zone. */
  canDelete: boolean;
}

export function DangerZone({
  projectId,
  projectSlug,
  projectName,
  canDelete,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!canDelete) return null;

  return (
    <>
      <div className="mt-8 border border-red-200 rounded-xl bg-red-50/30 overflow-hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-red-50 transition"
        >
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="w-4 h-4 text-red-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm font-semibold text-red-900">
              Danger zone
            </span>
            <span className="text-xs text-red-600/70">
              (hidden by default)
            </span>
          </div>
        </button>

        {open && (
          <div className="px-5 pb-5 pt-1 border-t border-red-100">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-900 mb-1">
                  Delete this project
                </p>
                <p className="text-xs text-red-700/80 leading-relaxed max-w-md">
                  Permanently removes the project and every artifact inside
                  it. You'll be asked to type the project slug to confirm.
                </p>
              </div>
              <button
                onClick={() => setDialogOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 border-2 border-red-300 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete project…
              </button>
            </div>
          </div>
        )}
      </div>

      {dialogOpen && (
        <DeleteProjectDialog
          projectId={projectId}
          projectSlug={projectSlug}
          projectName={projectName}
          onClose={() => setDialogOpen(false)}
          onDeleted={() => {
            setDialogOpen(false);
            router.push("/dashboard");
          }}
        />
      )}
    </>
  );
}
