"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, Rocket } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  SEVERITY_META,
  Severity,
  createRelease,
  suggestVersion,
} from "@/lib/releases-api";

interface Props {
  projectId: string;
  onCreated: () => void | Promise<void>;
}

export function ReleaseForm({ projectId, onCreated }: Props) {
  const [severity, setSeverity] = useState<Severity>("minor");
  const [versionTag, setVersionTag] = useState("");
  const [changelog, setChangelog] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch a suggestion whenever the severity changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSuggesting(true);
      try {
        const res = await suggestVersion(projectId, severity);
        if (!cancelled) setVersionTag(res.suggested);
      } catch {
        // ignore — user can type their own
      } finally {
        if (!cancelled) setSuggesting(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, severity]);

  async function handleSubmit() {
    if (!versionTag.trim()) {
      toast.error("Version tag is required");
      return;
    }
    if (changelog.trim().length < 20) {
      toast.error("Changelog must be at least 20 characters");
      return;
    }
    setSubmitting(true);
    try {
      await createRelease(projectId, {
        version_tag: versionTag.trim(),
        severity,
        changelog: changelog.trim(),
      });
      toast.success("Release published", {
        description: versionTag + " is now live.",
      });
      setChangelog("");
      await onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("already exists")) {
        toast.error("Version already exists", {
          description:
            "Pick a different version tag, or bump the severity.",
        });
      } else {
        toast.error("Could not publish release", { description: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <Rocket className="w-5 h-5 text-terracotta-500" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Publish a release
          </h2>
          <p className="text-xs text-slate-500">
            Every iteration deserves a version. Write the changelog in your
            own words.
          </p>
        </div>
      </div>

      {/* Severity selector */}
      <div className="mb-5">
        <Label className="text-xs text-slate-600 mb-2 block">
          Release type
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {(["patch", "minor", "major"] as const).map((s) => {
            const meta = SEVERITY_META[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={clsx(
                  "rounded-lg border-2 p-3 text-left transition",
                  severity === s
                    ? "border-terracotta-500 bg-terracotta-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <div className="text-xs font-semibold text-slate-900">
                  {meta.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  {meta.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Version tag */}
      <div className="mb-5">
        <Label className="text-xs text-slate-600 mb-2 block">
          Version tag
        </Label>
        <div className="relative">
          <Input
            value={versionTag}
            onChange={(e) => setVersionTag(e.target.value)}
            placeholder="v0.1.0"
            className="font-mono pr-24"
          />
          {suggesting && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Suggesting…
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          Format: v1.2.3. Suggested automatically from the last release and
          your chosen severity.
        </p>
      </div>

      {/* Changelog */}
      <div className="mb-5">
        <Label className="text-xs text-slate-600 mb-2 block">
          Changelog
        </Label>
        <Textarea
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="What changed in this release? Be specific — future-you will thank present-you."
          className="resize-none"
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-slate-400">
            Write it as if you were telling a user. Concrete beats abstract.
          </p>
          <span className="text-[10px] text-slate-400 font-mono">
            {changelog.length} / 5000
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !versionTag.trim() || changelog.trim().length < 20}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publishing…
            </>
          ) : (
            <>
              <Package className="w-4 h-4" />
              Publish release
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
