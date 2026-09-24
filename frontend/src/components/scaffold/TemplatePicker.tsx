"use client";

import { Check } from "lucide-react";
import clsx from "clsx";

import { TemplateInfo } from "@/lib/scaffold-api";

interface Props {
  templates: TemplateInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function TemplatePicker({ templates, selectedId, onSelect, disabled }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((t) => {
        const isSelected = t.id === selectedId;
        return (
          <button
            key={t.id}
            onClick={() => !disabled && onSelect(t.id)}
            disabled={disabled}
            className={clsx(
              "text-left rounded-xl border-2 p-5 transition relative",
              isSelected
                ? "border-terracotta-500 bg-terracotta-50"
                : "border-slate-200 bg-white hover:border-terracotta-300",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-terracotta-500 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </div>
            )}
            <div className="text-3xl mb-2">{t.icon}</div>
            <h3 className="font-semibold text-slate-900 mb-1">{t.name}</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              {t.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {t.tech_stack.map((tech) => (
                <span
                  key={tech}
                  className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono"
                >
                  {tech}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
