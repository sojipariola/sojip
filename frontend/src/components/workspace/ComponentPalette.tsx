"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import clsx from "clsx";

import {
  CATEGORY_ORDER,
  COMPONENT_REGISTRY,
  ComponentDef,
} from "./registry";

interface Props {
  onAdd: (type: string) => void;
  disabled?: boolean;
}

export function ComponentPalette({ onAdd, disabled }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Typography: true,
    Buttons: true,
    Inputs: true,
    Display: true,
    Containers: false,
  });

  const grouped: Record<string, ComponentDef[]> = {};
  for (const cat of CATEGORY_ORDER) {
    grouped[cat] = COMPONENT_REGISTRY.filter((c) => c.category === cat);
  }

  return (
    <div className="text-sm">
      <div className="px-3 py-2.5 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Components
        </h3>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Click to add to the canvas
        </p>
      </div>

      <div className="py-1">
        {CATEGORY_ORDER.map((cat) => {
          const isOpen = expanded[cat];
          return (
            <div key={cat}>
              <button
                onClick={() =>
                  setExpanded((e) => ({ ...e, [cat]: !e[cat] }))
                }
                className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-600 uppercase tracking-wide hover:bg-slate-50 transition"
              >
                {isOpen ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {cat}
              </button>
              {isOpen && (
                <ul className="pb-1">
                  {grouped[cat].map((def) => (
                    <li key={def.type}>
                      <button
                        onClick={() => !disabled && onAdd(def.type)}
                        disabled={disabled}
                        className={clsx(
                          "w-full text-left px-3 py-2 rounded-md mx-1 transition group flex items-center justify-between gap-2",
                          "hover:bg-terracotta-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        title={def.previewText}
                        style={{ width: "calc(100% - 8px)" }}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-800">
                            {def.label}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {def.previewText}
                          </div>
                        </div>
                        <Plus className="w-3 h-3 text-slate-300 group-hover:text-terracotta-500 shrink-0 transition" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
