"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  PlayCircle,
  Wrench,
} from "lucide-react";
import clsx from "clsx";

import { NoteLink, TeacherNote, getNoteForPhase } from "@/lib/teacher-notes-api";
import { PhaseId } from "@/lib/phases";

interface Props {
  phase: PhaseId;
}

const LINK_META: Record<
  NoteLink["kind"],
  { icon: typeof FileText; color: string }
> = {
  video: { icon: PlayCircle, color: "text-rose-500" },
  article: { icon: FileText, color: "text-sky-500" },
  tool: { icon: Wrench, color: "text-amber-600" },
  docs: { icon: BookOpen, color: "text-emerald-600" },
  example: { icon: GraduationCap, color: "text-terracotta-600" },
};

export function TeacherNotesPanel({ phase }: Props) {
  const [note, setNote] = useState<TeacherNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const n = await getNoteForPhase(phase);
      setNote(n);
    } catch {
      // 404 = no note for this phase, treat as null
      setNote(null);
    } finally {
      setLoading(false);
    }
  }, [phase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
        <span className="text-xs text-slate-400">Loading teacher notes…</span>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-4 h-4 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-400">
            Teacher notes
          </h3>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Your teacher hasn't published notes for this phase yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-terracotta-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-start justify-between gap-2 hover:bg-terracotta-50/50 transition"
      >
        <div className="flex items-start gap-2.5 min-w-0 text-left">
          <GraduationCap className="w-4 h-4 text-terracotta-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-terracotta-600">
              Teacher notes
            </div>
            <div className="text-sm font-medium text-slate-900 truncate">
              {note.title}
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-terracotta-100 pt-3">
          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {note.body}
          </div>

          {note.links.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-2">
                Helpful links
              </div>
              <ul className="space-y-1.5">
                {note.links.map((link, i) => {
                  const meta = LINK_META[link.kind] || LINK_META.article;
                  const Icon = meta.icon;
                  return (
                    <li key={i}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-xs text-slate-700 hover:text-terracotta-700 transition group"
                      >
                        <Icon className={clsx("w-3.5 h-3.5 shrink-0 mt-0.5", meta.color)} />
                        <span className="flex-1 min-w-0">
                          <span className="underline decoration-slate-200 group-hover:decoration-terracotta-400">
                            {link.label}
                          </span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-terracotta-500 shrink-0 mt-0.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}