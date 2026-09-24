"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

interface Props {
  value: string;
  onChange: (value: string) => void;
  ownerLogin: string | null;
  disabled?: boolean;
}

const NAME_RE = /^[a-zA-Z0-9._-]+$/;

export function RepoNameInput({
  value,
  onChange,
  ownerLogin,
  disabled,
}: Props) {
  const trimmed = value.trim();
  const isEmpty = trimmed.length === 0;
  const hasIllegalChars = trimmed.length > 0 && !NAME_RE.test(trimmed);
  const isTooLong = trimmed.length > 100;
  const isValid = !isEmpty && !hasIllegalChars && !isTooLong;

  let error: string | null = null;
  if (hasIllegalChars) {
    error = "Only letters, numbers, dots, hyphens, and underscores are allowed.";
  } else if (isTooLong) {
    error = "Repository name must be 100 characters or fewer.";
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">
        Repository name
      </label>
      <div
        className={clsx(
          "flex items-center rounded-lg border-2 transition",
          error
            ? "border-red-300"
            : isValid
            ? "border-emerald-200"
            : "border-slate-200 focus-within:border-terracotta-500"
        )}
      >
        {ownerLogin && (
          <span className="pl-3 pr-1 text-sm text-slate-500 font-mono shrink-0">
            {ownerLogin}/
          </span>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="my-project"
          maxLength={100}
          className="flex-1 px-2 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none font-mono disabled:opacity-60"
        />
        {isValid && !error && (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-3 shrink-0" />
        )}
        {error && (
          <AlertCircle className="w-4 h-4 text-red-500 mr-3 shrink-0" />
        )}
      </div>
      {error ? (
        <p className="text-[11px] text-red-600 mt-1.5">{error}</p>
      ) : (
        <p className="text-[11px] text-slate-400 mt-1.5">
          Letters, numbers, dots, hyphens, and underscores only.
        </p>
      )}
    </div>
  );
}
