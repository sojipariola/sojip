import { apiFetch } from "./api-client";

// ─── Types ───────────────────────────────────────────────
export type Artifact = {
  id: string;
  project_id: string;
  phase: string;
  kind: string;
  data: Record<string, unknown>;
  version: number;
  is_current: boolean;
  locked_at: string | null;
  locked_by: string | null;
};

export type Remark = {
  id: string;
  project_id: string;
  artifact_id: string;
  author_id: string | null;
  field_path: string;
  body: string;
  author_role: "student" | "teacher" | "innovator" | "admin" | "ai";
  kind: "comment" | "critique" | "approval";
  created_at: string;
};

// ─── Artifacts ───────────────────────────────────────────
export function getArtifact(projectId: string, kind: string) {
  return apiFetch<Artifact>(`/projects/${projectId}/artifacts/${kind}`);
}

export function patchArtifact(
  projectId: string,
  kind: string,
  data: Record<string, unknown>
) {
  return apiFetch<Artifact>(`/projects/${projectId}/artifacts/${kind}`, {
    method: "PATCH",
    body: { data },
  });
}

export function lockArtifact(projectId: string, kind: string) {
  return apiFetch<Artifact>(
    `/projects/${projectId}/artifacts/${kind}/lock`,
    { method: "POST" }
  );
}

export function unlockArtifact(projectId: string, kind: string) {
  return apiFetch<Artifact>(
    `/projects/${projectId}/artifacts/${kind}/unlock`,
    { method: "POST" }
  );
}

// ─── Remarks ─────────────────────────────────────────────
export function listRemarks(projectId: string) {
  return apiFetch<Remark[]>(`/projects/${projectId}/remarks`);
}

export function createRemark(
  projectId: string,
  fieldPath: string,
  body: string
) {
  return apiFetch<Remark>(`/projects/${projectId}/remarks`, {
    method: "POST",
    body: { field_path: fieldPath, body },
  });
}

export function deleteRemark(projectId: string, remarkId: string) {
  return apiFetch<void>(`/projects/${projectId}/remarks/${remarkId}`, {
    method: "DELETE",
  });
}

// ─── AI Critique ─────────────────────────────────────────
export function critiqueField(
  projectId: string,
  kind: string,
  fieldPath: string
) {
  return apiFetch<Remark>(
    `/projects/${projectId}/artifacts/${kind}/critique`,
    {
      method: "POST",
      body: { field_path: fieldPath },
    }
  );
}
