"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { NODE_KINDS, NodeKind } from "@/lib/blueprint-api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  onAdd: (kind: string) => void;
}

export function NodePalette({ onAdd }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Node types</h3>
          <span className="text-[10px] text-slate-400">hover for help</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {NODE_KINDS.map((kind) => (
            <NodeKindButton
              key={kind.id}
              kind={kind}
              onAdd={() => onAdd(kind.id)}
              expanded={expanded === kind.id}
              onToggle={() =>
                setExpanded((e) => (e === kind.id ? null : kind.id))
              }
            />
          ))}
        </div>

        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
          Click to add. Drag nodes to reposition. Drag from a node's bottom
          dot to another node's top dot to connect.
        </p>
      </div>
    </TooltipProvider>
  );
}

function NodeKindButton({
  kind,
  onAdd,
  expanded,
  onToggle,
}: {
  kind: NodeKind;
  onAdd: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 hover:border-terracotta-300 transition overflow-hidden">
      <div className="flex items-stretch">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onAdd}
              className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-terracotta-50 transition text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: kind.color }}
              />
              <span className="text-xs font-medium text-slate-700 truncate">
                {kind.label}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="font-medium text-xs mb-1">{kind.label}</p>
            <p className="text-xs text-slate-500">{kind.tooltip}</p>
          </TooltipContent>
        </Tooltip>

        <button
          onClick={onToggle}
          className="px-2 text-slate-400 hover:text-terracotta-600 hover:bg-terracotta-50 transition"
          title="More info"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-terracotta-50 border-t border-terracotta-100">
          <p className="text-[11px] text-slate-700 leading-relaxed mb-2">
            {kind.description}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">
            Common choices
          </p>
          <div className="flex flex-wrap gap-1">
            {kind.examples.map((ex) => (
              <span
                key={ex}
                className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
