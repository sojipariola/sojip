"use client";

import { Check, Eye, Loader2, Plus, Save } from "lucide-react";
import clsx from "clsx";

import {
  CATEGORY_ORDER,
  COMPONENT_REGISTRY,
  ComponentDef,
} from "./registry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Mode = "stacked" | "grid" | "free";

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onAdd: (type: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  previewUrl: string;
  disabled?: boolean;
}

export function WorkspaceToolbar({
  mode,
  onModeChange,
  onAdd,
  onSave,
  saving,
  dirty,
  previewUrl,
  disabled,
}: Props) {
  const grouped: Record<string, ComponentDef[]> = {};
  for (const cat of CATEGORY_ORDER) {
    grouped[cat] = COMPONENT_REGISTRY.filter((c) => c.category === cat);
  }

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={disabled}
              className="inline-flex items-center gap-1.5 bg-terracotta-600 text-white px-3.5 py-2 rounded-lg text-xs font-medium hover:bg-terracotta-700 transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add component
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 max-h-[500px] overflow-y-auto"
          >
            {CATEGORY_ORDER.map((cat, idx) => (
              <div key={cat}>
                {idx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-400">
                  {cat}
                </DropdownMenuLabel>
                {grouped[cat].map((def) => (
                  <DropdownMenuItem
                    key={def.type}
                    onSelect={() => onAdd(def.type)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-slate-800">
                        {def.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {def.previewText}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-slate-300 mx-1">·</span>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {(["stacked", "grid", "free"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              disabled={disabled}
              className={clsx(
                "px-2.5 py-1 rounded text-xs font-medium capitalize transition",
                mode === m
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {dirty && (
          <span className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">
            Modified
          </span>
        )}

        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition",
            dirty && !saving
              ? "bg-terracotta-600 text-white hover:bg-terracotta-700"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving…
            </>
          ) : dirty ? (
            <>
              <Save className="w-3.5 h-3.5" />
              Save
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Saved
            </>
          )}
        </button>

        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </a>
      </div>
    </div>
  );
}
