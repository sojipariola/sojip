"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  Gamepad2,
  GraduationCap,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { AIMentorPanel } from "@/components/shared/AIMentorPanel";
import { TeacherNotesPanel } from "@/components/shared/TeacherNotesPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { PHASE_LABEL_LONG, PhaseId } from "@/lib/phases";
import { createRemark, listRemarks, Remark } from "@/lib/workspace-api";

type Tab = "games" | "teacher" | "mentor";

type Variant = "sidebar" | "inline";

interface Props {
  projectId: string;
  phase: PhaseId;
  /**
   * "sidebar" (default) renders the vertical card for phase page asides.
   * "inline" renders a compact horizontal bar for the workspace page.
   */
  variant?: Variant;
}

export function SupportPanel({ projectId, phase, variant = "sidebar" }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("mentor");

  function openTo(next: Tab) {
    setTab(next);
    setOpen(true);
  }

  return (
    <>
      {/* Desktop sidebar launcher — only in sidebar variant */}
      <div
        className={clsx(
          variant === "sidebar" ? "hidden lg:block" : "block",
          "bg-white border border-slate-200 rounded-xl p-4"
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-terracotta-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Need help?
          </h3>
          <span className="text-xs text-slate-400 ml-1">
            Three ways to keep moving.
          </span>
        </div>

        <div
          className={
            variant === "inline"
              ? "grid grid-cols-1 md:grid-cols-3 gap-2"
              : "space-y-2"
          }
        >
          <LauncherButton
            icon={Gamepad2}
            label="Games"
            hint="Bored? Take a 2-minute focus break."
            accent="rose"
            onClick={() => openTo("games")}
          />
          <LauncherButton
            icon={GraduationCap}
            label="Ask Teacher"
            hint="Learn it yourself. Notes + Q&A."
            accent="amber"
            onClick={() => openTo("teacher")}
          />
          <LauncherButton
            icon={Bot}
            label="AI Mentor"
            hint="Stuck? Get guidance with explanations."
            accent="terracotta"
            onClick={() => openTo("mentor")}
          />
        </div>
      </div>

      {/* Mobile floating bar — only in sidebar variant */}
      {variant === "sidebar" && (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          <MobileLauncher
            icon={Gamepad2}
            label="Games"
            onClick={() => openTo("games")}
          />
          <MobileLauncher
            icon={GraduationCap}
            label="Teacher"
            onClick={() => openTo("teacher")}
          />
          <MobileLauncher
            icon={Bot}
            label="AI Mentor"
            onClick={() => openTo("mentor")}
          />
        </div>
      </div>
      )}

      {/* Drawer */}
      {open && (
        <SupportDrawer
          projectId={projectId}
          phase={phase}
          activeTab={tab}
          onTabChange={setTab}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─── Launcher buttons (desktop) ──────────────────────────

const ACCENT_CLASSES: Record<
  "rose" | "amber" | "terracotta",
  { border: string; iconBg: string; iconColor: string }
> = {
  rose: {
    border: "border-rose-200 hover:border-rose-300 hover:bg-rose-50",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
  amber: {
    border: "border-amber-200 hover:border-amber-300 hover:bg-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  terracotta: {
    border: "border-terracotta-200 hover:border-terracotta-300 hover:bg-terracotta-50",
    iconBg: "bg-terracotta-100",
    iconColor: "text-terracotta-600",
  },
};

function LauncherButton({
  icon: Icon,
  label,
  hint,
  accent,
  onClick,
}: {
  icon: typeof Gamepad2;
  label: string;
  hint: string;
  accent: "rose" | "amber" | "terracotta";
  onClick: () => void;
}) {
  const cls = ACCENT_CLASSES[accent];
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 transition text-left",
        cls.border
      )}
    >
      <span
        className={clsx(
          "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
          cls.iconBg
        )}
      >
        <Icon className={clsx("w-4 h-4", cls.iconColor)} />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
          {hint}
        </div>
      </div>
    </button>
  );
}

// ─── Launcher buttons (mobile) ───────────────────────────

function MobileLauncher({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Gamepad2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-3 hover:bg-slate-50 active:bg-slate-100 transition"
    >
      <Icon className="w-5 h-5 text-slate-600" />
      <span className="text-[11px] font-medium text-slate-700">{label}</span>
    </button>
  );
}

// ─── Drawer ───────────────────────────────────────────────

function SupportDrawer({
  projectId,
  phase,
  activeTab,
  onTabChange,
  onClose,
}: {
  projectId: string;
  phase: PhaseId;
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const tabs: { id: Tab; label: string; icon: typeof Gamepad2 }[] = [
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "teacher", label: "Ask Teacher", icon: GraduationCap },
    { id: "mentor", label: "AI Mentor", icon: Bot },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Support
            </h2>
            <p className="text-xs text-slate-500">
              {PHASE_LABEL_LONG[phase]} phase
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 transition"
            aria-label="Close support panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={clsx(
                  "flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "games" && <GamesTab phase={phase} />}
          {activeTab === "teacher" && (
            <TeacherTab projectId={projectId} phase={phase} />
          )}
          {activeTab === "mentor" && (
            <div className="p-4">
              <AIMentorPanel projectId={projectId} gate={phase} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Games tab ────────────────────────────────────────────

function GamesTab({ phase }: { phase: PhaseId }) {
  const GAME_CATALOG: Record<PhaseId, { title: string; teaches: string }> = {
    idea: {
      title: "Idea Spark",
      teaches: "Sharpen a vague problem into a specific one.",
    },
    plan: {
      title: "Critical Path",
      teaches: "Spot which task is actually on the critical path.",
    },
    blueprint: {
      title: "Boxes & Arrows",
      teaches: "Match a system diagram to its described behaviour.",
    },
    scaffold: {
      title: "Template Match",
      teaches: "Pick the right starter template for a given project.",
    },
    development: {
      title: "Commit Detective",
      teaches: "Find the bug the commit message is hiding.",
    },
    deployment: {
      title: "Health Check Hero",
      teaches: "Diagnose why a URL isn't returning 200.",
    },
    maintenance: {
      title: "Changelog Racer",
      teaches: "Write a changelog that a user would actually read.",
    },
  };

  const game = GAME_CATALOG[phase];

  return (
    <div className="p-5">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gamepad2 className="w-5 h-5 text-rose-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Focus break
          </span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">
          {game.title}
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed">
          {game.teaches}
        </p>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-6 text-center">
        <p className="text-sm text-slate-500 mb-1">
          This game is being built.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          It will take about 2 minutes and reward you with a small badge when
          you finish.
        </p>
      </div>
    </div>
  );
}

// ─── Ask Teacher tab ──────────────────────────────────────

function TeacherTab({
  projectId,
  phase,
}: {
  projectId: string;
  phase: PhaseId;
}) {
  const [questions, setQuestions] = useState<Remark[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const fieldPath = `phase:${phase}`;

  async function load() {
    setLoading(true);
    try {
      const all = await listRemarks(projectId);
      setQuestions(
        all.filter(
          (r) => r.field_path === fieldPath && r.author_role !== "ai"
        )
      );
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, phase]);

  async function post() {
    const text = draft.trim();
    if (text.length < 5) {
      toast.error("Write a bit more", {
        description: "A question needs at least five characters.",
      });
      return;
    }
    setPosting(true);
    try {
      await createRemark(projectId, fieldPath, text);
      setDraft("");
      await load();
      toast.success("Question posted", {
        description: "Your teacher will see it with the phase notes.",
      });
    } catch (e) {
      toast.error("Could not post question", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Teacher notes for this phase */}
      <TeacherNotesPanel phase={phase} />

      {/* Post a question */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquarePlus className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Ask a question
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          Post a question about the {PHASE_LABEL_LONG[phase]} phase. Your
          teacher sees it alongside the notes.
        </p>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="What's unclear? Be specific — the sharper the question, the better the answer."
          className="text-sm resize-none"
        />
        <div className="flex items-center justify-end mt-2">
          <Button
            onClick={post}
            disabled={posting || draft.trim().length < 5}
            size="sm"
          >
            {posting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Post question
          </Button>
        </div>
      </div>

      {/* Q&A list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Phase questions
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {questions.length}
          </span>
        </div>

        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          </div>
        ) : questions.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-400">
              No questions yet for this phase. Yours will be the first.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {questions.map((q) => (
              <li key={q.id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold flex items-center justify-center mt-0.5">
                    Q
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {q.body}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(q.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
