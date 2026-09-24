"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";

import { Task } from "@/lib/plan-api";
import { TaskOwnerPicker } from "./TaskOwnerPicker";

interface Props {
  tasks: Task[];
  criticalTaskIds: Set<string>;
  locked: boolean;
  onAdd: (payload: { name: string; estimate_days: number; description?: string }) => Promise<void>;
  onUpdate: (taskId: string, payload: Partial<Task>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onMoveUp: (taskId: string) => Promise<void>;
  onMoveDown: (taskId: string) => Promise<void>;
}

export function TaskEditor({
  tasks,
  criticalTaskIds,
  locked,
  onAdd,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newDays, setNewDays] = useState(3);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDays, setEditDays] = useState(1);

  async function submitNew() {
    if (newName.trim().length < 2) return;
    setAdding(true);
    try {
      await onAdd({
        name: newName.trim(),
        estimate_days: newDays,
      });
      setNewName("");
      setNewDays(3);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditName(task.name);
    setEditDays(task.estimate_days);
  }

  async function commitEdit(taskId: string) {
    await onUpdate(taskId, {
      name: editName.trim(),
      estimate_days: editDays,
    });
    setEditingId(null);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Tasks ({tasks.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Each task has a duration. Dependencies make the order explicit.
          </p>
        </div>
      </div>

      {/* Task list */}
      <ul className="divide-y divide-slate-100">
        {tasks.map((task, i) => {
          const isEditing = editingId === task.id;
          const isCritical = criticalTaskIds.has(task.id);
          return (
            <li
              key={task.id}
              className={clsx(
                "px-5 py-3 flex items-start gap-3 group",
                isCritical && "bg-terracotta-50/40"
              )}
            >
              {/* Reorder controls */}
              <div className="flex flex-col shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => onMoveUp(task.id)}
                  disabled={i === 0 || locked}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onMoveDown(task.id)}
                  disabled={i === tasks.length - 1 || locked}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={editDays}
                        onChange={(e) => setEditDays(parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 text-sm border border-slate-300 rounded"
                      />
                      <span className="text-xs text-slate-500">days</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => commitEdit(task.id)}
                          className="p-1 text-terracotta-600 hover:text-terracotta-700"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => !locked && startEdit(task)}
                    disabled={locked}
                    className="text-left w-full"
                  >
                    <div className="flex items-center gap-2">
                      {task.must_have && (
                        <span
                          title="Must-have milestone"
                          className="shrink-0 inline-flex"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        </span>
                      )}
                      <span className="text-sm text-slate-800 font-medium truncate">
                        {task.name}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {task.estimate_days}d
                      </span>
                      {!locked && (
                        <TaskOwnerPicker
                          currentOwnerId={task.owner_id}
                          onChange={(ownerId) =>
                            onUpdate(task.id, { owner_id: ownerId })
                          }
                        />
                      )}
                      {isCritical && (
                        <span className="text-xs text-terracotta-600 shrink-0 font-medium">
                          critical
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </button>
                )}
              </div>

              {/* Delete */}
              {!locked && (
                <button
                  onClick={() => onDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition p-1 shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          );
        })}

        {tasks.length === 0 && (
          <li className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500 mb-1">No tasks yet.</p>
            <p className="text-xs text-slate-400">
              Break the project into 5–12 concrete tasks.
            </p>
          </li>
        )}
      </ul>

      {/* Add task */}
      {!locked && (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
              }}
              placeholder="Add a task…"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500"
            />
            <input
              type="number"
              min={1}
              max={180}
              value={newDays}
              onChange={(e) => setNewDays(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-2 text-sm border border-slate-300 rounded-lg text-center"
            />
            <span className="text-xs text-slate-500">days</span>
            <button
              onClick={submitNew}
              disabled={adding || newName.trim().length < 2}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
