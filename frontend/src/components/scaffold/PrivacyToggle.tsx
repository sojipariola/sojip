"use client";

import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

interface Props {
  value: boolean; // true = private
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function PrivacyToggle({ value, onChange, disabled }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">
        Visibility
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => !disabled && onChange(true)}
          disabled={disabled}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition text-left",
            value
              ? "border-terracotta-500 bg-terracotta-50"
              : "border-slate-200 bg-white hover:border-slate-300",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <EyeOff
            className={clsx(
              "w-4 h-4 shrink-0",
              value ? "text-terracotta-600" : "text-slate-400"
            )}
          />
          <div>
            <div className="text-sm font-medium text-slate-900">Private</div>
            <div className="text-[11px] text-slate-500">
              Only you and collaborators
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => !disabled && onChange(false)}
          disabled={disabled}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition text-left",
            !value
              ? "border-terracotta-500 bg-terracotta-50"
              : "border-slate-200 bg-white hover:border-slate-300",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <Eye
            className={clsx(
              "w-4 h-4 shrink-0",
              !value ? "text-terracotta-600" : "text-slate-400"
            )}
          />
          <div>
            <div className="text-sm font-medium text-slate-900">Public</div>
            <div className="text-[11px] text-slate-500">
              Anyone on the internet
            </div>
          </div>
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">
        You can change this later from GitHub if you decide differently.
      </p>
    </div>
  );
}
