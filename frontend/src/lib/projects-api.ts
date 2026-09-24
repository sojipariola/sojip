import { apiFetch } from "./api-client";

/**
 * Delete a project. Requires the caller to pass the exact slug as a
 * confirmation phrase, and — if the project has any work in progress —
 * `force: true`.
 *
 * Throws an ApiError with status 409 and a structured detail when the
 * project has content and force was not passed.
 */
export function deleteProject(
  projectId: string,
  confirmSlug: string,
  force: boolean = false
) {
  return apiFetch<void>(`/projects/${projectId}`, {
    method: "DELETE",
    body: { confirm_slug: confirmSlug, force },
  });
}
