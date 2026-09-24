"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  Loader2,
  Terminal,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeploymentScript } from "@/lib/deployment-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: DeploymentScript | null;
  loading: boolean;
}

export function ScriptModal({ open, onOpenChange, script, loading }: Props) {
  const [copied, setCopied] = useState<"script" | "env" | null>(null);
  const [tab, setTab] = useState<"script" | "env">("script");

  async function copy(text: string, which: "script" | "env") {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    toast.success(
      which === "script" ? "Script copied to clipboard" : ".env.example copied"
    );
    setTimeout(() => setCopied(null), 2000);
  }

  function download(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(filename + " downloaded");
  }

  const displayContent = script
    ? tab === "script"
      ? script.script
      : script.env_example
    : "";

  const displayFilename =
    tab === "script" ? "deploy.sh" : ".env.example";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-terracotta-600" />
            Your deploy script is ready
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-terracotta-500" />
          </div>
        ) : script ? (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setTab("script")}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition",
                  tab === "script"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <FileCode2 className="w-3.5 h-3.5 inline mr-1.5" />
                deploy.sh
              </button>
              <button
                onClick={() => setTab("env")}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition",
                  tab === "env"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                .env.example
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-auto border border-slate-200 rounded-lg bg-slate-50">
              <pre className="p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap break-all">
                {displayContent}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Run this script from your project root. It will read your
                local <code className="font-mono">.env</code> file for
                secrets.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copy(displayContent, tab)}
                  className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
                >
                  {copied === tab ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy
                </button>
                <button
                  onClick={() => download(displayContent, displayFilename)}
                  className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">
            Script generation failed. Close and try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
