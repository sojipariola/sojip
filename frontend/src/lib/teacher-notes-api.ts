import { apiFetch } from "./api-client";

export type NoteLinkKind = "video" | "article" | "tool" | "docs" | "example";

export type NoteLink = {
  label: string;
  url: string;
  kind: NoteLinkKind;
};

export type TeacherNote = {
  id: string;
  tenant_id: string;
  phase: string;
  author_id: string | null;
  title: string;
  body: string;
  links: NoteLink[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export function listNotes(includeDrafts = false) {
  const q = includeDrafts ? "?include_drafts=true" : "";
  return apiFetch<TeacherNote[]>(`/teacher-notes${q}`);
}

export function getNoteForPhase(phase: string) {
  return apiFetch<TeacherNote | null>(`/teacher-notes/phase/${phase}`);
}

export function createNote(payload: {
  phase: string;
  title: string;
  body: string;
  links: NoteLink[];
  is_published: boolean;
}) {
  return apiFetch<TeacherNote>("/teacher-notes", {
    method: "POST",
    body: payload,
  });
}

export function updateNote(
  noteId: string,
  payload: Partial<{
    title: string;
    body: string;
    links: NoteLink[];
    is_published: boolean;
  }>
) {
  return apiFetch<TeacherNote>(`/teacher-notes/${noteId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteNote(noteId: string) {
  return apiFetch<void>(`/teacher-notes/${noteId}`, { method: "DELETE" });
}
