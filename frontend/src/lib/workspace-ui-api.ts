import { apiFetch } from "./api-client";

export type LayoutMode = "free" | "stacked" | "grid";

export type ComponentLayout = {
  order?: number | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  col?: number | null;
  row?: number | null;
  col_span?: number | null;
  row_span?: number | null;
};

export type WorkspaceComponent = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  layout: ComponentLayout;
};

export type WorkspaceDocument = {
  schema_version: number;
  mode: LayoutMode;
  components: WorkspaceComponent[];
  meta: Record<string, unknown>;
};

export type WorkspaceArtifact = {
  id: string;
  project_id: string;
  phase: string;
  kind: string;
  data: WorkspaceDocument;
  version: number;
  is_current: boolean;
  locked_at: string | null;
  locked_by: string | null;
};

export function getWorkspace(projectId: string) {
  return apiFetch<WorkspaceArtifact>(`/projects/${projectId}/workspace`);
}

export function patchWorkspace(
  projectId: string,
  payload: { mode?: LayoutMode; components?: WorkspaceComponent[]; meta?: Record<string, unknown> }
) {
  return apiFetch<WorkspaceArtifact>(`/projects/${projectId}/workspace`, {
    method: "PATCH",
    body: payload,
  });
}

export function addComponent(
  projectId: string,
  payload: { type: string; props?: Record<string, unknown>; layout?: ComponentLayout }
) {
  return apiFetch<WorkspaceComponent>(
    `/projects/${projectId}/workspace/components`,
    { method: "POST", body: payload }
  );
}

export function updateComponent(
  projectId: string,
  componentId: string,
  payload: { props?: Record<string, unknown>; layout?: ComponentLayout }
) {
  return apiFetch<WorkspaceComponent>(
    `/projects/${projectId}/workspace/components/${componentId}`,
    { method: "PATCH", body: payload }
  );
}

export function deleteComponent(projectId: string, componentId: string) {
  return apiFetch<void>(
    `/projects/${projectId}/workspace/components/${componentId}`,
    { method: "DELETE" }
  );
}

export function reorderComponents(projectId: string, orderedIds: string[]) {
  return apiFetch<WorkspaceArtifact>(
    `/projects/${projectId}/workspace/reorder`,
    { method: "POST", body: { ordered_ids: orderedIds } }
  );
}
