import { apiFetch } from "./api-client";

// ─── Types ───────────────────────────────────────────────
export type Task = {
  id: string;
  name: string;
  description: string | null;
  estimate_days: number;
  dependencies: string[];
  owner_id: string | null;
  status: string;
  must_have: boolean;
};

export type TaskWithTimeline = Task & {
  latest_start_date: string | null;
  earliest_start_day: number | null;
  critical_path_index: number | null;
};

export type TaskGraph = {
  tasks: TaskWithTimeline[];
  deadline: string | null;
  budget_days: number | null;
};

export type CriticalPath = {
  path_task_ids: string[];
  total_days: number;
  has_cycle: boolean;
};

// ─── API calls ───────────────────────────────────────────
export function getPlan(projectId: string) {
  return apiFetch<TaskGraph>(`/projects/${projectId}/plan`);
}

export function updatePlanMeta(
  projectId: string,
  payload: { deadline?: string | null; budget_days?: number | null }
) {
  return apiFetch<TaskGraph>(`/projects/${projectId}/plan/meta`, {
    method: "PATCH",
    body: payload,
  });
}

export function addTask(
  projectId: string,
  payload: {
    name: string;
    description?: string | null;
    estimate_days?: number;
    owner_id?: string | null;
    must_have?: boolean;
  }
) {
  return apiFetch<Task>(`/projects/${projectId}/plan/tasks`, {
    method: "POST",
    body: payload,
  });
}

export function updateTask(
  projectId: string,
  taskId: string,
  payload: Partial<{
    name: string;
    description: string | null;
    estimate_days: number;
    owner_id: string | null;
    status: string;
    must_have: boolean;
  }>
) {
  return apiFetch<Task>(
    `/projects/${projectId}/plan/tasks/${taskId}`,
    { method: "PATCH", body: payload }
  );
}

export function deleteTask(projectId: string, taskId: string) {
  return apiFetch<void>(
    `/projects/${projectId}/plan/tasks/${taskId}`,
    { method: "DELETE" }
  );
}

export function reorderTasks(projectId: string, taskIds: string[]) {
  return apiFetch<{ status: string; count: number }>(
    `/projects/${projectId}/plan/tasks/reorder`,
    { method: "POST", body: taskIds }
  );
}

export function addDependency(
  projectId: string,
  fromTaskId: string,
  toTaskId: string
) {
  return apiFetch<{ status: string; dependencies: string[] }>(
    `/projects/${projectId}/plan/dependencies`,
    {
      method: "POST",
      body: { from_task_id: fromTaskId, to_task_id: toTaskId },
    }
  );
}

export function removeDependency(
  projectId: string,
  fromTaskId: string,
  toTaskId: string
) {
  return apiFetch<{ status: string }>(
    `/projects/${projectId}/plan/dependencies?from_task_id=${fromTaskId}&to_task_id=${toTaskId}`,
    { method: "DELETE" }
  );
}

export function getCriticalPath(projectId: string) {
  return apiFetch<CriticalPath>(
    `/projects/${projectId}/plan/critical-path`
  );
}

export type PlanScheduleSummary = {
  total_duration_days: number;
  critical_path_task_ids: string[];
  has_cycle: boolean;
  parallelizable_task_ids: string[];
  terminal_task_ids: string[];
};

export type PlanDetailed = {
  tasks: TaskWithTimeline[];
  deadline: string | null;
  budget_days: number | null;
  schedule: PlanScheduleSummary;
};

export function getPlanDetailed(projectId: string) {
  return apiFetch<PlanDetailed>(`/projects/${projectId}/plan/detailed`);
}

// ─── Tenant users ───────────────────────────────────────
export type TenantUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  skill_tier: string;
};

export function listTenantUsers() {
  return apiFetch<TenantUser[]>("/tenants/me/users");
}

// ─── AI Planner ─────────────────────────────────────────
export type ProposedTask = {
  id: string;
  name: string;
  description: string | null;
  estimate_days: number;
  dependencies: string[];
  must_have: boolean;
};

export type PlannerResponse = {
  tasks: ProposedTask[];
  reasoning: string;
  model: string;
};

export function aiProposeTasks(projectId: string) {
  return apiFetch<PlannerResponse>(
    `/projects/${projectId}/plan/ai-propose`,
    { method: "POST" }
  );
}

export function aiAcceptTasks(projectId: string, tasks: ProposedTask[]) {
  return apiFetch<{ status: string; count: number }>(
    `/projects/${projectId}/plan/ai-accept`,
    { method: "POST", body: tasks }
  );
}
