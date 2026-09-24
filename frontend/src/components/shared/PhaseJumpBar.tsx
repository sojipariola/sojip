"use client";

import Link from "next/link";
import clsx from "clsx";

import {
  PHASE_LABEL,
  PHASE_ORDER,
  PhaseId,
  phaseUrl,
} from "@/lib/phases";

interface Props {
  projectSlug: string;
  currentPhase: PhaseId;
  viewedPhase: PhaseId;
}

export function PhaseJumpBar({ projectSlug, currentPhase, viewedPhase }: Props) {
  return (
    <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-1 overflow-x-auto">
        <span className="text-xs text-slate-400 font-medium shrink-0 pr-3">
          Jump to:
        </span>
        {PHASE_ORDER.map((phase) => {
          const isViewed = phase === viewedPhase;
          const isCurrent = phase === currentPhase;
          return (
            <Link
              key={phase}
              href={phaseUrl(projectSlug, phase)}
              className={clsx(
                "text-xs px-3 py-1.5 rounded-md transition shrink-0 relative",
                isViewed
                  ? "bg-terracotta-100 text-terracotta-800 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {PHASE_LABEL[phase]}
              {isCurrent && !isViewed && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-terracotta-500" />
              )}
            </Link>
          );
        })}

        <span className="text-slate-300 mx-2">·</span>

        <Link
          href={`/projects/${projectSlug}/workspace`}
          className={clsx(
            "text-xs px-3 py-1.5 rounded-md transition shrink-0 font-medium border",
            "text-terracotta-700 border-terracotta-200 bg-terracotta-50/50 hover:bg-terracotta-100"
          )}
          title="Build a UI visually"
        >
          UI Workspace
        </Link>
      </div>
    </div>
  );
}
