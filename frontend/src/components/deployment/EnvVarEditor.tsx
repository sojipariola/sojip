"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revealEnvVar } from "@/lib/deployment-api";

interface Props {
  projectId: string;
  deploymentId: string;
  maskedVars: Record<string, string>;
  onChanged: () => void | Promise<void>;
  readOnly?: boolean;
}

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;

export function EnvVarEditor({
  projectId,
  deploymentId,
  maskedVars,
  onChanged,
  readOnly,
}: Props) {
  const keys = Object.keys(maskedVars).sort();

  const [revealing, setRevealing] = useState<Record<string, boolean>>({});
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function handleReveal(key: string) {
    if (revealedValues[key]) {
      // Already revealed — toggle off
      setRevealing((r) => ({ ...r, [key]: false }));
      return;
    }
    setRevealing((r) => ({ ...r, [key]: true }));
    try {
      const res = await revealEnvVar(projectId, deploymentId, key);
      setRevealedValues((v) => ({ ...v, [key]: res.value }));
    } catch (e) {
      toast.error("Could not reveal value", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
      setRevealing((r) => ({ ...r, [key]: false }));
    }
  }

  async function handleCopy(key: string) {
    let value = revealedValues[key];
    if (!value) {
      try {
        const res = await revealEnvVar(projectId, deploymentId, key);
        value = res.value;
        setRevealedValues((v) => ({ ...v, [key]: value }));
      } catch {
        toast.error("Could not copy value");
        return;
      }
    }
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    toast.success(key + " copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Environment variables
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Stored encrypted. Never committed to the repo.
          </p>
        </div>
      </div>

      {keys.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
          <p className="text-xs text-slate-500">
            No environment variables yet.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
          {keys.map((key) => {
            const isRevealed = !!revealedValues[key];
            const isLoading = revealing[key] && !isRevealed;
            const display = isRevealed
              ? revealedValues[key]
              : "••••••••••••";
            return (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-2.5 group"
              >
                <span className="text-xs font-mono text-slate-700 w-40 shrink-0 truncate">
                  {key}
                </span>
                <span
                  className={clsx(
                    "text-xs font-mono flex-1 truncate",
                    isRevealed ? "text-slate-900" : "text-slate-400"
                  )}
                >
                  {display}
                </span>
                <button
                  onClick={() => handleReveal(key)}
                  disabled={isLoading || readOnly}
                  className="p-1.5 text-slate-400 hover:text-slate-700 transition shrink-0"
                  title={isRevealed ? "Hide" : "Reveal"}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isRevealed ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => handleCopy(key)}
                  disabled={readOnly}
                  className="p-1.5 text-slate-400 hover:text-slate-700 transition shrink-0"
                  title="Copy value"
                >
                  {copiedKey === key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {!readOnly && (
                  <button
                    onClick={() => {
                      if (confirm("Delete " + key + "?")) {
                        // Removal handled by parent — parent passes onDelete
                        toast.info("Delete individual keys via the patch form.");
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-600 transition shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
