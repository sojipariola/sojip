import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { PHASE_LABEL_LONG, PHASE_ORDER } from "@/lib/phases";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-2xl font-bold tracking-tight">
            SOJIP<span className="text-terracotta-500">.</span>
          </span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/features" className="text-slate-600 hover:text-slate-900">Features</Link>
            <Link href="/pricing" className="text-slate-600 hover:text-slate-900">Pricing</Link>
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">Sign in</Link>
            <Link href="/register" className="bg-terracotta-600 text-white px-4 py-2 rounded-lg hover:bg-terracotta-700 transition">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terracotta-50 border border-terracotta-200 text-terracotta-700 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Phase-gated from Idea to Maintenance
          </div>
          <h1 className="text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
            From idea to code,
            <br />
            <span className="text-terracotta-600">guided at every step.</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 leading-relaxed">
            SOJIP turns abstract ideas into deployable software through seven
            disciplined phases, AI mentors at every gate, and block-based
            editors that meet beginners and innovators where they are.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 bg-terracotta-600 text-white px-6 py-3 rounded-lg hover:bg-terracotta-700 transition font-medium">
              Start your journey
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/features" className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-6 py-3 rounded-lg hover:bg-white transition font-medium">
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-6">
            The journey
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {PHASE_ORDER.map((phase, i) => (
              <div key={phase} className="flex items-center gap-3">
                <span className="phase-chip">{PHASE_LABEL_LONG[phase]}</span>
                {i < PHASE_ORDER.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-slate-500 flex justify-between">
          <span>© {new Date().getFullYear()} SOJIP Platform</span>
          <span className="font-mono text-xs">v0.1.0-mvp</span>
        </div>
      </footer>
    </main>
  );
}
