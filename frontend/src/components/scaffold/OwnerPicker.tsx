"use client";

import { Building2, User } from "lucide-react";
import clsx from "clsx";

import { OwnerType } from "@/lib/scaffold-api";

interface Props {
  value: OwnerType;
  onChange: (value: OwnerType) => void;
  username: string | null;
  orgAvailable: boolean;
  orgName: string;
  disabled?: boolean;
}

export function OwnerPicker({
  value,
  onChange,
  username,
  orgAvailable,
  orgName,
  disabled,
}: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">
        Where should the repository live?
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => !disabled && onChange("personal")}
          disabled={disabled}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition text-left",
            value === "personal"
              ? "border-terracotta-500 bg-terracotta-50"
              : "border-slate-200 bg-white hover:border-slate-300",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <User
            className={clsx(
              "w-5 h-5 shrink-0",
              value === "personal" ? "text-terracotta-600" : "text-slate-400"
            )}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900">
              Personal account
            </div>
            <div className="text-xs text-slate-500 truncate">
              {username ? "@" + username : "your account"}
            </div>
          </div>
        </button>

        {orgAvailable && (
          <button
            type="button"
            onClick={() => !disabled && onChange("org")}
            disabled={disabled}
            className={clsx(
              "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition text-left",
              value === "org"
                ? "border-terracotta-500 bg-terracotta-50"
                : "border-slate-200 bg-white hover:border-slate-300",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <Building2
              className={clsx(
                "w-5 h-5 shrink-0",
                value === "org" ? "text-terracotta-600" : "text-slate-400"
              )}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">
                Organization
              </div>
              <div className="text-xs text-slate-500 truncate">
                {orgName}
              </div>
            </div>
          </button>
        )}
      </div>
      {!orgAvailable && username && (
        <p className="text-[10px] text-slate-400 mt-2 italic">
          You can create repositories under a GitHub organization once you are
          a member of one.
        </p>
      )}
    </div>
  );
}
