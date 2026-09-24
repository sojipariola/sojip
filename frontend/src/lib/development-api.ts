import { apiFetch } from "./api-client";

export type CommitReview = {
  id: string;
  commit_sha: string;
  commit_short_sha: string;
  passed: boolean;
  severity: "info" | "warning" | "error";
  concern: string | null;
  reasoning: string;
  model: string;
  created_at: string;
};

export function reviewCommit(projectId: string, sha: string) {
  return apiFetch<CommitReview>(
    `/projects/${projectId}/development/review-commit`,
    { method: "POST", body: { sha } }
  );
}

export function listReviews(projectId: string) {
  return apiFetch<CommitReview[]>(
    `/projects/${projectId}/development/reviews`
  );
}
