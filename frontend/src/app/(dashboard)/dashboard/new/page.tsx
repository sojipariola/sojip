"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SOJIPButton as Button } from "@/components/ui/SOJIPButton";
import { SOJIPInput as Input } from "@/components/ui/SOJIPInput";
import { ApiError, apiFetch } from "@/lib/api-client";

type Project = {
  id: string;
  name: string;
  slug: string;
  current_phase: string;
};

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const project = await apiFetch<Project>("/projects", {
        method: "POST",
        body: { name, description: description || null },
      });
      router.push(`/projects/${project.slug}/idea`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <span className="phase-chip mb-3 inline-block">Phase 1 — Idea</span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Start a new project
          </h1>
          <p className="mt-2 text-slate-500">
            Give it a working name. You can refine it later — the AI Mentor
            will help you sharpen the idea in the Idea phase.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <Input
            label="Project name"
            name="name"
            placeholder="e.g. Neighborhood Solar Tracker"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={255}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-700"
            >
              Short description
              <span className="text-slate-400 font-normal ml-2">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={2000}
              placeholder="One or two sentences about what this project is and who it's for."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 transition resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/dashboard">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={loading}>
              Create project
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
