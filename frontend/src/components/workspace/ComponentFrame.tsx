"use client";

import { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Trash2,
} from "lucide-react";
import clsx from "clsx";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { getComponentDef } from "./registry";

interface Props {
  id: string;
  type: string;
  selected: boolean;
  isDragging: boolean;
  isDropTarget?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  children: ReactNode;
  showDragHandle?: boolean;
  extraBadges?: ReactNode;
}

export function ComponentFrame({
  id,
  type,
  selected,
  isDragging,
  isDropTarget = false,
  onSelect,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  children,
  showDragHandle = true,
  extraBadges,
}: Props) {
  const def = getComponentDef(type);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={clsx(
            "group relative rounded-lg border-2 p-4 transition cursor-pointer",
            selected
              ? "border-terracotta-500 bg-terracotta-50/30"
              : "border-transparent hover:border-slate-200 hover:bg-slate-50/50",
            isDragging && "opacity-40",
            isDropTarget && !isDragging && "border-t-4 border-t-terracotta-500"
          )}
        >
          {showDragHandle && (
            <div
              className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing p-1"
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5 text-slate-400" />
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete this component?")) onDelete();
            }}
            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition p-1 text-slate-400 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition text-[9px] font-mono text-slate-400 uppercase tracking-wide">
            {def?.label || type}
          </div>

          {extraBadges}

          <div className="pl-5 pr-4">{children}</div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={onDuplicate}>
          <Copy className="w-3.5 h-3.5 mr-2" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onSelect={onMoveUp}>
          <ArrowUp className="w-3.5 h-3.5 mr-2" />
          Move up
        </ContextMenuItem>
        <ContextMenuItem onSelect={onMoveDown}>
          <ArrowDown className="w-3.5 h-3.5 mr-2" />
          Move down
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            if (confirm("Delete this component?")) onDelete();
          }}
          className="text-red-600 focus:text-red-700"
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
