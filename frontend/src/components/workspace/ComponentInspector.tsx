"use client";

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ComponentDef, PropField, getComponentDef } from "./registry";
import { WorkspaceComponent } from "@/lib/workspace-ui-api";

interface Props {
  component: WorkspaceComponent | null;
  onChange: (props: Record<string, unknown>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ComponentInspector({
  component,
  onChange,
  onDelete,
  onClose,
}: Props) {
  const def = component ? getComponentDef(component.type) : undefined;

  // Local draft for text inputs to avoid re-rendering on every keystroke
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setDraft(component?.props || {});
  }, [component?.id]);

  if (!component || !def) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-slate-400">
          Select a component to edit its properties.
        </p>
      </div>
    );
  }

  function update(key: string, value: unknown) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onChange(next);
  }

  return (
    <div className="text-sm">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            {def.label}
          </h3>
          <p className="text-[10px] text-slate-400 truncate">
            {component.id}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (confirm("Delete this component?")) onDelete();
            }}
            className="p-1 text-slate-400 hover:text-red-600 transition"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 transition"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {def.propSchema.length === 0 ? (
        <div className="px-3 py-4 text-xs text-slate-400">
          This component has no configurable props.
        </div>
      ) : (
        <div className="px-3 py-3 space-y-3">
          {def.propSchema.map((field) => (
            <PropEditor
              key={field.key}
              field={field}
              value={draft[field.key]}
              onChange={(v) => update(field.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PropEditor({
  field,
  value,
  onChange,
}: {
  field: PropField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.kind) {
    case "text":
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">{field.label}</Label>
          <Input
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">{field.label}</Label>
          <Textarea
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="text-xs"
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">{field.label}</Label>
          <Select
            value={String(value ?? "")}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-600">{field.label}</Label>
          <Input
            type="number"
            value={Number(value ?? 0)}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-terracotta-600"
          />
          {field.label}
        </label>
      );

    default:
      return null;
  }
}
