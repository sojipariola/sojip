"use client";

import { useMemo } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";

import { PlanDetailed } from "@/lib/plan-api";

interface Props {
  plan: PlanDetailed;
}

// Grid layout constants
const LEFT_LABEL_WIDTH = 220;
const DAY_WIDTH = 32;       // pixels per day
const ROW_HEIGHT = 52;
const ROW_GAP = 4;
const HEADER_HEIGHT = 36;

export function PlanDiagram({ plan }: Props) {
  const tasks = plan.tasks;

  // Compute the longest horizontal extent
  const maxDay = useMemo(() => {
    let max = 0;
    for (const t of tasks) {
      const end = (t.earliest_start_day ?? 0) + t.estimate_days;
      if (end > max) max = end;
    }
    return Math.max(max + 1, 30); // at least 30 days wide
  }, [tasks]);

  const criticalSet = new Set(plan.schedule.critical_path_task_ids);
  const terminalSet = new Set(plan.schedule.terminal_task_ids);

  // Rows sorted by earliest start (stable ordering)
  const rows = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aStart = a.earliest_start_day ?? 0;
      const bStart = b.earliest_start_day ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return a.name.localeCompare(b.name);
    });
  }, [tasks]);

  const rowIndex = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((t, i) => {
      m[t.id] = i;
    });
    return m;
  }, [rows]);

  // Dependency arrows
  const arrows = useMemo(() => {
    const list: {
      fromId: string;
      toId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isCritical: boolean;
    }[] = [];

    for (const task of rows) {
      const toRow = rowIndex[task.id];
      const toStartDay = task.earliest_start_day ?? 0;
      for (const depId of task.dependencies) {
        const fromTask = rows.find((r) => r.id === depId);
        if (!fromTask) continue;
        const fromRow = rowIndex[depId];
        const fromStartDay = fromTask.earliest_start_day ?? 0;
        const fromEndDay = fromStartDay + fromTask.estimate_days;

        // Arrow endpoint: the left side of the target bar
        const x1 = LEFT_LABEL_WIDTH + fromEndDay * DAY_WIDTH;
        const y1 = HEADER_HEIGHT + fromRow * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
        const x2 = LEFT_LABEL_WIDTH + toStartDay * DAY_WIDTH;
        const y2 = HEADER_HEIGHT + toRow * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;

        list.push({
          fromId: depId,
          toId: task.id,
          x1,
          y1,
          x2,
          y2,
          isCritical:
            criticalSet.has(depId) && criticalSet.has(task.id),
        });
      }
    }
    return list;
  }, [rows, rowIndex, criticalSet]);

  const totalWidth = LEFT_LABEL_WIDTH + maxDay * DAY_WIDTH + 40;
  const totalHeight =
    HEADER_HEIGHT + rows.length * (ROW_HEIGHT + ROW_GAP) + 40;

  // Day markers every 5 days
  const dayMarkers: number[] = [];
  for (let d = 0; d <= maxDay; d += 5) dayMarkers.push(d);

  if (plan.schedule.has_cycle) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-sm text-red-800">
          Your plan has a circular dependency. Remove one of the arrows to
          see the diagram.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Plan diagram
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Each bar is a task. Length is the estimate. Arrows are
            dependencies. Total duration: {plan.schedule.total_duration_days} days.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-terracotta-500" />
            Critical
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-300" />
            Standard
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-300" />
            Terminal
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="relative"
          style={{ width: totalWidth, height: totalHeight }}
        >
          {/* Day header */}
          <div
            className="absolute top-0 left-0 right-0 flex border-b border-slate-100"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              className="shrink-0 border-r border-slate-100"
              style={{ width: LEFT_LABEL_WIDTH }}
            />
            {dayMarkers.map((d) => (
              <div
                key={d}
                className="absolute text-[10px] text-slate-400 top-2"
                style={{ left: LEFT_LABEL_WIDTH + d * DAY_WIDTH + 4 }}
              >
                Day {d}
              </div>
            ))}
          </div>

          {/* Row grid background */}
          {rows.map((t, i) => (
            <div
              key={t.id}
              className={clsx(
                "absolute left-0 right-0 border-b border-slate-50",
                i % 2 === 1 && "bg-slate-50/30"
              )}
              style={{
                top: HEADER_HEIGHT + i * (ROW_HEIGHT + ROW_GAP),
                height: ROW_HEIGHT + ROW_GAP,
              }}
            />
          ))}

          {/* SVG arrows (under bars) */}
          <svg
            className="absolute pointer-events-none"
            style={{
              top: 0,
              left: 0,
              width: totalWidth,
              height: totalHeight,
            }}
          >
            <defs>
              <marker
                id="pl-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 7 3.5, 0 7" fill="#94a3b8" />
              </marker>
              <marker
                id="pl-arrow-critical"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 7 3.5, 0 7" fill="#c85a3a" />
              </marker>
            </defs>

            {arrows.map((a, i) => {
              const stroke = a.isCritical ? "#c85a3a" : "#94a3b8";
              const marker = a.isCritical
                ? "url(#pl-arrow-critical)"
                : "url(#pl-arrow)";

              // Simple bezier curve
              const dx = Math.abs(a.x2 - a.x1) * 0.4;
              const path = `M ${a.x1} ${a.y1} C ${a.x1 + dx} ${a.y1}, ${a.x2 - dx} ${a.y2}, ${a.x2} ${a.y2}`;
              return (
                <path
                  key={i}
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={a.isCritical ? 2 : 1.4}
                  markerEnd={marker}
                  opacity={0.65}
                />
              );
            })}
          </svg>

          {/* Task bars */}
          {rows.map((t, i) => {
            const startDay = t.earliest_start_day ?? 0;
            const barLeft = LEFT_LABEL_WIDTH + startDay * DAY_WIDTH;
            const barWidth = Math.max(t.estimate_days * DAY_WIDTH, 24);
            const top = HEADER_HEIGHT + i * (ROW_HEIGHT + ROW_GAP);
            const isCritical = criticalSet.has(t.id);
            const isTerminal = terminalSet.has(t.id);

            return (
              <div key={t.id}>
                {/* Left label */}
                <div
                  className="absolute flex items-center gap-2 pr-3"
                  style={{
                    left: 12,
                    top,
                    width: LEFT_LABEL_WIDTH - 24,
                    height: ROW_HEIGHT,
                  }}
                >
                  {t.must_have && (
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                  <span className="text-xs text-slate-700 font-medium truncate">
                    {t.name}
                  </span>
                </div>

                {/* Bar */}
                <div
                  className={clsx(
                    "absolute rounded-md flex items-center px-2 transition",
                    isCritical
                      ? "bg-terracotta-500 text-white"
                      : isTerminal
                      ? "bg-amber-200 text-amber-900"
                      : "bg-slate-300 text-slate-700"
                  )}
                  style={{
                    left: barLeft,
                    top,
                    width: barWidth,
                    height: ROW_HEIGHT,
                  }}
                  title={`${t.name} — ${t.estimate_days} days${
                    t.latest_start_date ? ` · start by ${t.latest_start_date}` : ""
                  }`}
                >
                  <span className="text-[11px] font-semibold truncate">
                    {t.estimate_days}d
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {plan.schedule.parallelizable_task_ids.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-500">
            {plan.schedule.parallelizable_task_ids.length} standalone task
            {plan.schedule.parallelizable_task_ids.length !== 1 ? "s" : ""}{" "}
            can run anytime — they don't block anything.
          </p>
        </div>
      )}
    </div>
  );
}
