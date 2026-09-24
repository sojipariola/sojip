"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";

import { TenantUser, listTenantUsers } from "@/lib/plan-api";

interface Props {
  currentOwnerId: string | null;
  onChange: (ownerId: string | null) => void;
  disabled?: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  teacher: "text-amber-700",
  admin: "text-red-700",
  innovator: "text-terracotta-700",
  student: "text-slate-600",
};

export function TaskOwnerPicker({
  currentOwnerId,
  onChange,
  disabled,
}: Props) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTenantUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const current = users.find((u) => u.id === currentOwnerId);
  const initials = current
    ? current.full_name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  return (
    <div className="relative inline-flex items-center">
      {current ? (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
            ROLE_COLORS[current.role] || "text-slate-600"
          } bg-slate-100`}
          title={current.full_name}
        >
          <span className="font-semibold">{initials}</span>
          <span className="truncate max-w-[80px]">
            {current.full_name.split(" ")[0]}
          </span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-50">
          <User className="w-3 h-3" />
          Unassigned
        </span>
      )}

      <select
        value={currentOwnerId || ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || loading}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Assign task owner"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name} ({u.role})
          </option>
        ))}
      </select>
    </div>
  );
}
