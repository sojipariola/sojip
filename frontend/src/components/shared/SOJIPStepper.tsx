"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import clsx from "clsx";

import {
  PHASE_LABEL_LONG,
  PHASE_NUMBER,
  PHASE_ORDER,
  PhaseId,
} from "@/lib/phases";

// Re-export so existing `import { PhaseId } from ".../SOJIPStepper"`
// continues to work during the migration. Remove once all importers
// pull from @/lib/phases.
export type { PhaseId };

interface Props {
  /** The project's formal current phase (where it "lives"). */
  currentPhase: PhaseId;
  /** The phase the user is currently viewing. Defaults to currentPhase. */
  viewedPhase?: PhaseId;
  /** The project slug — required to build hrefs. */
  projectSlug: string;
}

export function SOJIPStepper({
  currentPhase,
  viewedPhase,
  projectSlug,
}: Props) {
  const viewed = viewedPhase || currentPhase;
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <nav className="sticky top-24 w-64 shrink-0 hidden lg:block">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-widest uppercase text-slate-400">
          The journey
        </h2>
      </div>
      <ol className="space-y-1">
        {PHASE_ORDER.map((phase, i) => {
          const isCurrent = phase === currentPhase;
          const isViewed = phase === viewed;
          const isBeforeCurrent = i < currentIndex;
          const href = `/projects/${projectSlug}/${phase}`;

          return (
            <li key={phase} className="relative">
              {i < PHASE_ORDER.length - 1 && (
                <span
                  className={clsx(
                    "absolute left-[15px] top-8 w-px h-6",
                    isBeforeCurrent ? "bg-terracotta-400" : "bg-slate-200"
                  )}
                  aria-hidden
                />
              )}

              <Link
                href={href}
                prefetch={false}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition cursor-pointer",
                  isViewed && "bg-terracotta-50 border border-terracotta-200",
                  !isViewed && "hover:bg-slate-50"
                )}
              >
                <span
                  className={clsx(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition shrink-0 relative",
                    isCurrent &&
                      "bg-terracotta-500 border-terracotta-500 text-white",
                    !isCurrent &&
                      isViewed &&
                      "bg-white border-terracotta-500 text-terracotta-600",
                    !isCurrent &&
                      !isViewed &&
                      "bg-white border-slate-300 text-slate-400"
                  )}
                >
                  {isBeforeCurrent ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <span className="text-xs font-semibold">
                      {PHASE_NUMBER[phase]}
                    </span>
                  )}
                  {isCurrent && !isViewed && (
                    <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 rounded-full bg-terracotta-600 ring-2 ring-white" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div
                    className={clsx(
                      "text-sm font-medium truncate",
                      isCurrent
                        ? "text-terracotta-900"
                        : isViewed
                        ? "text-terracotta-800"
                        : "text-slate-700"
                    )}
                  >
                    {PHASE_LABEL_LONG[phase]}
                  </div>
                  {isCurrent && (
                    <div className="text-[10px] text-terracotta-600 uppercase tracking-wide font-medium">
                      Current
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          All phases are open. Advance only when the gate is met.
        </p>
      </div>
    </nav>
  );
}
