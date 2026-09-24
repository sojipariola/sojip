"use client";

import { useMemo, useState } from "react";
import { Link2, Star, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { TaskWithTimeline } from "@/lib/plan-api";

interface Props {
  tasks: TaskWithTimeline[];
  locked: boolean;
  selectedTaskId: string | null;
  onSelect: (taskId: string | null) => void;
  onAddDependency: (fromId: string, toId: string) => Promise<void>;
  onRemoveDependency: (fromId: string, toId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

const ROW_HEIGHT = 88;

export function DependencyCanvas({
  tasks,
  locked,
  selectedTaskId,
  onSelect,
  onAddDependency,
  onRemoveDependency,
  onDeleteTask,
}: Props) {
  const [linkMode, setLinkMode] = useState<string | null>(null);

  const rowIndex = useMemo(() => {
    const m: Record<string, number> = {};
    tasks.forEach((t, i) => {
      m[t.id] = i;
    });
    return m;
  }, [tasks]);

  const arrows = useMemo(() => {
    const result: {
      fromId: string;
      toId: string;
      fromRow: number;
      toRow: number;
      isCritical: boolean;
    }[] = [];
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (rowIndex[depId] !== undefined) {
          result.push({
            fromId: depId,
            toId: task.id,
            fromRow: rowIndex[depId],
            toRow: rowIndex[task.id],
            isCritical:
              tasks[rowIndex[depId]]?.critical_path_index !== null &&
              tasks[rowIndex[task.id]]?.critical_path_index !== null,
          });
        }
      }
    }
    return result;
  }, [tasks, rowIndex]);

  async function handleLinkClick(taskId: string) {
    if (linkMode === null) {
      setLinkMode(taskId);
      toast.info("Now click the task that depends on this one.");
      return;
    }
    if (linkMode === taskId) {
      setLinkMode(null);
      return;
    }

    const fromTask = tasks.find((t) => t.id === linkMode);
    const toTask = tasks.find((t) => t.id === taskId);

    try {
      await onAddDependency(linkMode, taskId);
      toast.success(
        `Linked: "${fromTask?.name ?? "task"}" → "${toTask?.name ?? "task"}"`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add dependency";
      if (msg.toLowerCase().includes("cycle")) {
        toast.error("Circular dependency", {
          description:
            "That link would create a loop. Every task must eventually finish.",
        });
      } else {
        toast.error("Could not add dependency", { description: msg });
      }
    } finally {
      setLinkMode(null);
    }
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="relative bg-white border border-slate-200 rounded-xl">
      <svg
        className="absolute inset-0 pointer-events-none w-full"
        style={{ height: tasks.length * ROW_HEIGHT, zIndex: 1 }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
          </marker>
          <marker
            id="arrowhead-critical"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 6 3, 0 6" fill="#c85a3a" />
          </marker>
        </defs>
        {arrows.map((a, i) => {
          const x1 = 24;
          const y1 = a.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
          const x2 = 24;
          const y2 = a.toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
          const midY = (y1 + y2) / 2;
          const stroke = a.isCritical ? "#c85a3a" : "#94a3b8";
          const marker = a.isCritical
            ? "url(#arrowhead-critical)"
            : "url(#arrowhead)";
          const path = `M ${x1} ${y1} L ${x1 - 8} ${y1} L ${x1 - 8} ${midY} L ${x2 - 8} ${y2} L ${x2} ${y2}`;
          return (
            <path
              key={i}
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={a.isCritical ? 2 : 1.5}
              markerEnd={marker}
              opacity={0.7}
            />
          );
        })}
      </svg>

      <ul className="relative" style={{ zIndex: 2 }}>
        {tasks.map((task, i) => {
          const isSelected = selectedTaskId === task.id;
          const isLinkSource = linkMode === task.id;
          const isCritical = task.critical_path_index !== null;

          return (
            <li
              key={task.id}
              className={clsx(
                "relative flex items-center gap-3 px-4 border-b border-slate-100 transition",
                isSelected && "bg-slate-50",
                isLinkSource && "bg-terracotta-50"
              )}
              style={{ height: ROW_HEIGHT }}
              onClick={() => onSelect(isSelected ? null : task.id)}
            >
              <div className="shrink-0 relative z-10" style={{ width: 32 }}>
                <div
                  className={clsx(
                    "w-3 h-3 rounded-full border-2",
                    isCritical
                      ? "bg-terracotta-500 border-terracotta-500"
                      : "bg-white border-slate-300"
                  )}
                />
              </div>

              <div className="flex-1 min-w-0 pl-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {task.must_have && (
                    <span title="Must-have" className="shrink-0 inline-flex">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    </span>
                  )}
                  <span className="text-sm text-slate-800 font-medium truncate">
                    {task.name}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {task.estimate_days}d
                  </span>
                  {isCritical && (
                    <span className="text-[10px] text-terracotta-600 shrink-0 font-semibold uppercase tracking-wide">
                      critical #{task.critical_path_index! + 1}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                  {task.latest_start_date && (
                    <span>Start by {task.latest_start_date}</span>
                  )}
                  {task.dependencies.length > 0 && (
                    <span>{task.dependencies.length} dep</span>
                  )}
                </div>
              </div>

              {!locked && (
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleLinkClick(task.id)}
                    className={clsx(
                      "p-1.5 rounded transition",
                      isLinkSource
                        ? "bg-terracotta-100 text-terracotta-700"
                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    )}
                    title={
                      isLinkSource
                        ? "Click another task to complete the link"
                        : "Start a dependency from this task"
                    }
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {linkMode && (
        <div className="px-4 py-2 bg-terracotta-50 border-t border-terracotta-200 flex items-center justify-between text-xs">
          <span className="text-terracotta-800">
            Click another task to link from{" "}
            <strong>
              {tasks.find((t) => t.id === linkMode)?.name}
            </strong>
          </span>
          <button
            onClick={() => setLinkMode(null)}
            className="text-terracotta-700 hover:text-terracotta-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
