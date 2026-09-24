"use client";

import { Check } from "lucide-react";
import clsx from "clsx";

export type DeploymentPath = "script" | "url" | "codespaces";

interface PathOption {
  id: DeploymentPath;
  icon: string;
  title: string;
  subtitle: string;
  bullets: string[];
}

const PATHS: PathOption[] = [
  {
    id: "script",
    icon: "📜",
    title: "Generate a deploy script",
    subtitle: "Run it from your laptop",
    bullets: [
      "Pick your hosting provider",
      "SOJIP writes the script",
      "Run it, paste the URL back",
    ],
  },
  {
    id: "url",
    icon: "🔗",
    title: "I've already deployed",
    subtitle: "Paste your URL",
    bullets: [
      "Any provider works",
      "SOJIP validates HTTP 200",
      "Recorded as production URL",
    ],
  },
  {
    id: "codespaces",
    icon: "⚡",
    title: "Open in Codespaces",
    subtitle: "Zero setup",
    bullets: [
      "GitHub runs the dev server",
      "Codespaces shows a public URL",
      "Paste it back — done",
    ],
  },
];

interface Props {
  selected: DeploymentPath | null;
  onSelect: (path: DeploymentPath) => void;
  disabled?: boolean;
}

export function PathSelector({ selected, onSelect, disabled }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        How do you want to deploy?
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PATHS.map((p) => {
          const isSelected = p.id === selected;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => !disabled && onSelect(p.id)}
              disabled={disabled}
              className={clsx(
                "text-left rounded-xl border-2 p-5 transition relative",
                isSelected
                  ? "border-terracotta-500 bg-terracotta-50"
                  : "border-slate-200 bg-white hover:border-slate-300",
                disabled && "opacity-60 cursor-not-allowed"
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-terracotta-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}

              <div className="text-3xl mb-3">{p.icon}</div>

              <div className="mb-1">
                <div className="text-sm font-semibold text-slate-900">
                  {p.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.subtitle}
                </div>
              </div>

              <ul className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                {p.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-slate-600 leading-relaxed flex gap-1.5"
                  >
                    <span className="text-slate-300 shrink-0">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
