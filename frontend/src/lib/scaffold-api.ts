import { apiFetch } from "./api-client";

export type TemplateInfo = {
  id: string;
  name: string;
  description: string;
  tech_stack: string[];
  node_kinds: string[];
  icon: string;
};

export type ScaffoldJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ScaffoldJob = {
  id: string;
  project_id: string;
  template_id: string;
  status: ScaffoldJobStatus;
  progress: number;
  current_stage: string | null;
  repo_url: string | null;
  repo_full_name: string | null;
  preview_url: string | null;
  error_message: string | null;
  log: Array<{ at: string; stage: string; progress: number }>;
  completed_at: string | null;
  created_at: string;
};

export type OwnerType = "personal" | "org";

export type StartScaffoldPayload = {
  template_id: string;
  owner_type: OwnerType;
  repo_name: string;
  private: boolean;
};

export function listTemplates() {
  return apiFetch<TemplateInfo[]>("/scaffold/templates");
}

export function startScaffold(
  projectId: string,
  payload: StartScaffoldPayload
) {
  return apiFetch<ScaffoldJob>(
    `/projects/${projectId}/scaffold/start`,
    { method: "POST", body: payload }
  );
}

export function getScaffoldJob(projectId: string, jobId: string) {
  return apiFetch<ScaffoldJob>(
    `/projects/${projectId}/scaffold/jobs/${jobId}`
  );
}

export function listScaffoldJobs(projectId: string) {
  return apiFetch<ScaffoldJob[]>(
    `/projects/${projectId}/scaffold/jobs`
  );
}

export const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  generating_files: "Generating project files",
  creating_repo: "Creating GitHub repository",
  pushing_commit: "Pushing initial commit",
  finalizing: "Finalizing",
  done: "Complete",
};

export const STAGE_ORDER = [
  "generating_files",
  "creating_repo",
  "pushing_commit",
  "finalizing",
];
