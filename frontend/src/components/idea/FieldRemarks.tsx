"use client";

import { useState } from "react";
import { Bot, Loader2, MessageSquare, Trash2, User } from "lucide-react";
import clsx from "clsx";

import { Remark } from "@/lib/workspace-api";

interface Props {
  remarks: Remark[];
  canPost: boolean;
  onPost: (body: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  currentUserId?: string;
  currentUserRole?: string;
}

export function FieldRemarks({
  remarks,
  canPost,
  onPost,
  onDelete,
  currentUserId,
  currentUserRole,
}: Props) {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      await onPost(text);
      setDraft("");
    } finally {
      setPosting(false);
    }
  }

  if (remarks.length === 0 && !canPost) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-slate-100">
      {remarks.map((r) => {
        const isAI = r.author_role === "ai";
        const isTeacher = r.author_role === "teacher" || r.author_role === "admin";
        const canDelete =
          onDelete &&
          (r.author_id === currentUserId ||
            currentUserRole === "teacher" ||
            currentUserRole === "admin");

        return (
          <div
            key={r.id}
            className={clsx(
              "rounded-lg px-3 py-2.5 text-sm leading-relaxed",
              isAI && "bg-terracotta-50 border border-terracotta-100",
              isTeacher && !isAI && "bg-amber-50 border border-amber-100",
              !isAI && !isTeacher && "bg-slate-50 border border-slate-100"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {isAI ? (
                  <>
                    <Bot className="w-3.5 h-3.5 text-terracotta-600" />
                    <span className="text-terracotta-700">AI Mentor</span>
                  </>
                ) : isTeacher ? (
                  <>
                    <User className="w-3.5 h-3.5 text-amber-700" />
                    <span className="text-amber-800">Teacher</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-600">Peer</span>
                  </>
                )}
              </div>
              {canDelete && (
                <button
                  onClick={async () => {
                    setDeleting(r.id);
                    try {
                      await onDelete!(r.id);
                    } finally {
                      setDeleting(null);
                    }
                  }}
                  disabled={deleting === r.id}
                  className="text-slate-300 hover:text-red-500 transition p-0.5"
                  title="Delete remark"
                >
                  {deleting === r.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
            <p
              className={clsx(
                isAI && "text-terracotta-900",
                isTeacher && !isAI && "text-amber-900",
                !isAI && !isTeacher && "text-slate-700"
              )}
            >
              {r.body}
            </p>
          </div>
        );
      })}

      {canPost && (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a remark for this field…"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={posting || !draft.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {posting && <Loader2 className="w-3 h-3 animate-spin" />}
              Post remark
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
