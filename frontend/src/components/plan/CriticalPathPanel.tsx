"use client";

import { AlertTriangle, Clock, Route } from "lucide-react";

import { CriticalPath, Task } from "@/lib/plan-api";

interface Props {
  criticalPath: CriticalPath | null;
  tasks: Task[];
}

export function CriticalPathPanel({ criticalPath, tasks }: Props) {
  if (!criticalPath) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Route className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Critical path</h3>
        </div>
        <p className="text-xs text-slate-500">
          Loading…
        </p>
      </div>
    );
  }

  if (criticalPath.has_cycle) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-semibold text-red-900">
            Circular dependency
          </h3>
        </div>
        <p className="text-xs text-red-700">
          Some tasks depend on each other in a loop. Remove one of the
          dependencies to fix it.
        </p>
      </div>
    );
  }

  const pathTasks = criticalPath.path_task_ids
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);

  if (pathTasks.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Route className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Critical path</h3>
        </div>
        <p className="text-xs text-slate-500">
          Add tasks with dependencies to see the critical path.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-terracotta-500" />
          <h3 className="text-sm font-semibold text-slate-900">
            Critical path
          </h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">{criticalPath.total_days} days</span>
        </div>
      </div>

      <ol className="space-y-1.5">
        {pathTasks.map((t, i) => (
          <li key={t.id} className="flex items-start gap-2 text-xs">
            <span className="w-4 h-4 rounded-full bg-terracotta-100 text-terracotta-700 text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-slate-700 flex-1 truncate">{t.name}</span>
            <span className="text-slate-400 shrink-0">{t.estimate_days}d</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
