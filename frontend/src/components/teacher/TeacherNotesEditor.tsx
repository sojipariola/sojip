"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PHASE_ORDER } from "@/lib/phases";
import {
  NoteLink,
  NoteLinkKind,
  TeacherNote,
  createNote,
  deleteNote,
  listNotes,
  updateNote,
} from "@/lib/teacher-notes-api";

const LINK_KINDS: NoteLinkKind[] = ["article", "video", "tool", "docs", "example"];

export function TeacherNotesEditor() {
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPhase, setEditingPhase] = useState<string | null>(null);

  // Editor state for the currently-edited phase
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [links, setLinks] = useState<NoteLink[]>([]);
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listNotes(true);
      setNotes(list);
    } catch (e) {
      toast.error("Could not load notes", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(phase: string) {
    const existing = notes.find((n) => n.phase === phase);
    if (existing) {
      setTitle(existing.title);
      setBody(existing.body);
      setLinks(existing.links || []);
      setIsPublished(existing.is_published);
    } else {
      setTitle("");
      setBody("");
      setLinks([]);
      setIsPublished(true);
    }
    setEditingPhase(phase);
  }

  function cancelEdit() {
    setEditingPhase(null);
    setTitle("");
    setBody("");
    setLinks([]);
  }

  async function save() {
    if (!editingPhase) return;
    if (title.trim().length < 3) {
      toast.error("Title is required");
      return;
    }
    if (body.trim().length < 10) {
      toast.error("Body must be at least 10 characters");
      return;
    }

    setSaving(true);
    try {
      const existing = notes.find((n) => n.phase === editingPhase);
      if (existing) {
        await updateNote(existing.id, {
          title: title.trim(),
          body: body.trim(),
          links,
          is_published: isPublished,
        });
        toast.success("Note updated");
      } else {
        await createNote({
          phase: editingPhase,
          title: title.trim(),
          body: body.trim(),
          links,
          is_published: isPublished,
        });
        toast.success("Note created");
      }
      cancelEdit();
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("already exists")) {
        toast.error("A published note already exists for this phase", {
          description: "Unpublish it first, or edit the existing one.",
        });
      } else {
        toast.error("Could not save", { description: msg });
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(noteId: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteNote(noteId);
      toast.success("Note deleted");
      await load();
    } catch (e) {
      toast.error("Could not delete", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  function addLink() {
    setLinks([...links, { label: "", url: "", kind: "article" }]);
  }

  function updateLink(i: number, patch: Partial<NoteLink>) {
    setLinks(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLink(i: number) {
    setLinks(links.filter((_, idx) => idx !== i));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {PHASE_ORDER.map((phase) => {
        const note = notes.find((n) => n.phase === phase);
        const isEditing = editingPhase === phase;

        return (
          <div
            key={phase}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="phase-chip capitalize">{phase}</span>
                {note ? (
                  note.is_published ? (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3" strokeWidth={3} />
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      <EyeOff className="w-3 h-3" />
                      Draft
                    </span>
                  )
                ) : (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                    No note yet
                  </span>
                )}
                {note && (
                  <span className="text-xs text-slate-500 truncate max-w-xs">
                    {note.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {note && !isEditing && (
                  <button
                    onClick={() => remove(note.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {!isEditing && (
                  <button
                    onClick={() => startEdit(phase)}
                    className="text-xs font-medium text-terracotta-600 hover:text-terracotta-700 px-2.5 py-1 rounded hover:bg-terracotta-50 transition"
                  >
                    {note ? "Edit" : "Add note"}
                  </button>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="px-5 py-4 space-y-4">
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">
                    Title
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., How to write a strong Problem statement"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">
                    Body
                  </Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    placeholder="Write the note. Plain text, blank lines separate paragraphs."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-slate-600">
                      Links ({links.length})
                    </Label>
                    <button
                      onClick={addLink}
                      disabled={links.length >= 20}
                      className="inline-flex items-center gap-1 text-xs font-medium text-terracotta-600 hover:text-terracotta-700 disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      Add link
                    </button>
                  </div>
                  {links.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No links yet. Add articles, videos, tools, or docs.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {links.map((link, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 bg-slate-50 rounded-lg p-2"
                        >
                          <select
                            value={link.kind}
                            onChange={(e) =>
                              updateLink(i, {
                                kind: e.target.value as NoteLinkKind,
                              })
                            }
                            className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white shrink-0"
                          >
                            {LINK_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={link.label}
                            onChange={(e) =>
                              updateLink(i, { label: e.target.value })
                            }
                            placeholder="Label"
                            className="text-xs h-8"
                          />
                          <Input
                            value={link.url}
                            onChange={(e) =>
                              updateLink(i, { url: e.target.value })
                            }
                            placeholder="https://…"
                            className="text-xs h-8 font-mono"
                          />
                          <button
                            onClick={() => removeLink(i)}
                            className="p-1.5 text-slate-400 hover:text-red-600 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="accent-terracotta-600"
                    />
                    Publish (visible to students)
                  </label>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={save} disabled={saving}>
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
