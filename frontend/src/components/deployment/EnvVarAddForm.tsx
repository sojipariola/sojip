"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PendingEnvVar = { key: string; value: string };

interface Props {
  pending: PendingEnvVar[];
  onChange: (next: PendingEnvVar[]) => void;
}

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;

export function EnvVarAddForm({ pending, onChange }: Props) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const k = key.trim().toUpperCase();
    if (!KEY_RE.test(k)) {
      setError("Key must be UPPER_SNAKE_CASE (letters, digits, underscores).");
      return;
    }
    if (pending.some((p) => p.key === k)) {
      setError("Key already added.");
      return;
    }
    onChange([...pending, { key: k, value }]);
    setKey("");
    setValue("");
    setError(null);
  }

  function remove(k: string) {
    onChange(pending.filter((p) => p.key !== k));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-start">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="KEY"
          className="w-40 font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className="flex-1 font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={!key.trim() || !value}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {pending.length > 0 && (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
          {pending.map((p) => (
            <div
              key={p.key}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50/50"
            >
              <span className="text-xs font-mono text-slate-700 w-40 truncate shrink-0">
                {p.key}
              </span>
              <span className="text-xs font-mono text-slate-400 flex-1 truncate">
                {"•".repeat(Math.min(p.value.length, 16))}
              </span>
              <button
                type="button"
                onClick={() => remove(p.key)}
                className="p-1 text-slate-400 hover:text-red-600 transition shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
