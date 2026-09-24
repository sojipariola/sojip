import { apiFetch } from "./api-client";

export type Severity = "patch" | "minor" | "major";

export type Release = {
  id: string;
  project_id: string;
  created_by: string | null;
  version_tag: string;
  severity: Severity;
  changelog: string;
  commit_sha: string | null;
  deployed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReleaseCreate = {
  version_tag: string;
  severity: Severity;
  changelog: string;
  commit_sha?: string | null;
};

export type VersionSuggestion = {
  suggested: string;
  reason: string;
};

export function listReleases(projectId: string) {
  return apiFetch<Release[]>(`/projects/${projectId}/releases`);
}

export function suggestVersion(projectId: string, severity: Severity) {
  return apiFetch<VersionSuggestion>(
    `/projects/${projectId}/releases/suggest-version?severity=${severity}`
  );
}

export function createRelease(projectId: string, payload: ReleaseCreate) {
  return apiFetch<Release>(`/projects/${projectId}/releases`, {
    method: "POST",
    body: payload,
  });
}

export function deleteRelease(projectId: string, releaseId: string) {
  return apiFetch<void>(
    `/projects/${projectId}/releases/${releaseId}`,
    { method: "DELETE" }
  );
}

export const SEVERITY_META: Record<
  Severity,
  { label: string; hint: string; color: string; bg: string }
> = {
  patch: {
    label: "Patch",
    hint: "Bug fixes, small tweaks",
    color: "text-slate-600",
    bg: "bg-slate-100 border-slate-200",
  },
  minor: {
    label: "Minor",
    hint: "New features, backwards compatible",
    color: "text-terracotta-700",
    bg: "bg-terracotta-50 border-terracotta-200",
  },
  major: {
    label: "Major",
    hint: "Breaking changes",
    color: "text-rose-700",
    bg: "bg-rose-50 border-rose-200",
  },
};
