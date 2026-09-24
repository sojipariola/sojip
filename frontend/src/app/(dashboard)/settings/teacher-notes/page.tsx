"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TeacherNotesEditor } from "@/components/teacher/TeacherNotesEditor";
import { useAuthStore } from "@/store/authStore";

export default function TeacherNotesPage() {
  const { user } = useAuthStore();

  if (user && user.role !== "teacher" && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">
            Only teachers and admins can edit notes.
          </p>
          <Link
            href="/dashboard"
            className="text-terracotta-600 hover:text-terracotta-700 font-medium text-sm"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-sm text-slate-500">Settings</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Teacher notes
          </h1>
          <p className="mt-2 text-slate-500">
            Write one note per phase. Students in your institution see the
            published note in the sidebar of that phase's workspace.
          </p>
        </div>

        <TeacherNotesEditor />
      </main>
    </div>
  );
}