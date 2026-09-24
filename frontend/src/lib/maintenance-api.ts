import { apiFetch } from "./api-client";

export type RetrospectiveContent = {
  surprise: string;
  differently: string;
  lesson: string;
};

export type RetrospectiveDocument = {
  schema_version: number;
  content: RetrospectiveContent;
  submitted_at: string | null;
  ai_critique: string | null;
  ai_passed: boolean | null;
};

export type RetrospectiveArtifact = {
  id: string;
  project_id: string;
  phase: string;
  kind: string;
  data: RetrospectiveDocument;
  version: number;
  is_current: boolean;
  locked_at: string | null;
  locked_by: string | null;
};

export type WordCount = {
  total_words: number;
  min_words: number;
  passes_gate: boolean;
};

export type CritiqueResponse = {
  passed: boolean;
  severity: string;
  concern: string | null;
  reasoning: string;
  model: string;
};

export function getRetrospective(projectId: string) {
  return apiFetch<RetrospectiveArtifact>(
    `/projects/${projectId}/maintenance`
  );
}

export function patchRetrospective(
  projectId: string,
  payload: {
    surprise?: string;
    differently?: string;
    lesson?: string;
  }
) {
  return apiFetch<RetrospectiveArtifact>(
    `/projects/${projectId}/maintenance`,
    { method: "PATCH", body: payload }
  );
}

export function getWordCount(projectId: string) {
  return apiFetch<WordCount>(
    `/projects/${projectId}/maintenance/word-count`
  );
}

export function critiqueRetrospective(projectId: string) {
  return apiFetch<CritiqueResponse>(
    `/projects/${projectId}/maintenance/critique`,
    { method: "POST" }
  );
}
