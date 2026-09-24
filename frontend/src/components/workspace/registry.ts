/**
 * Component registry for the UI Workspace.
 *
 * Each entry defines:
 *  - type:         unique ID (matches Shadcn component name)
 *  - label:        display name in the palette
 *  - category:     palette grouping
 *  - defaultProps: initial values when dropped onto the canvas
 *  - propSchema:   list of editable props (drives the inspector)
 *  - previewText:  short description shown in the palette
 */
import { ComponentType } from "react";

export type PropField =
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "textarea"; key: string; label: string; placeholder?: string }
  | { kind: "select"; key: string; label: string; options: string[] }
  | { kind: "boolean"; key: string; label: string }
  | { kind: "number"; key: string; label: string; min?: number; max?: number };

export type ComponentDef = {
  type: string;
  label: string;
  category: "Typography" | "Buttons" | "Inputs" | "Display" | "Containers";
  previewText: string;
  defaultProps: Record<string, unknown>;
  propSchema: PropField[];
};

export const COMPONENT_REGISTRY: ComponentDef[] = [
  // ─── Typography ────────────────────────────────────────
  {
    type: "heading",
    label: "Heading",
    category: "Typography",
    previewText: "Section title",
    defaultProps: { text: "Hello, world", level: 1 },
    propSchema: [
      { kind: "text", key: "text", label: "Text" },
      { kind: "select", key: "level", label: "Level", options: ["1", "2", "3", "4"] },
    ],
  },
  {
    type: "text",
    label: "Text",
    category: "Typography",
    previewText: "Paragraph",
    defaultProps: { text: "A short paragraph of body text.", size: "base" },
    propSchema: [
      { kind: "textarea", key: "text", label: "Text" },
      { kind: "select", key: "size", label: "Size", options: ["sm", "base", "lg"] },
    ],
  },
  {
    type: "label",
    label: "Label",
    category: "Typography",
    previewText: "Form label",
    defaultProps: { text: "Label" },
    propSchema: [{ kind: "text", key: "text", label: "Text" }],
  },
  {
    type: "separator",
    label: "Separator",
    category: "Typography",
    previewText: "Divider line",
    defaultProps: {},
    propSchema: [],
  },

  // ─── Buttons ───────────────────────────────────────────
  {
    type: "button",
    label: "Button",
    category: "Buttons",
    previewText: "Clickable action",
    defaultProps: { text: "Click me", variant: "default", size: "default" },
    propSchema: [
      { kind: "text", key: "text", label: "Label" },
      {
        kind: "select",
        key: "variant",
        label: "Variant",
        options: ["default", "secondary", "outline", "ghost", "destructive", "link"],
      },
      { kind: "select", key: "size", label: "Size", options: ["sm", "default", "lg", "icon"] },
    ],
  },

  // ─── Inputs ────────────────────────────────────────────
  {
    type: "input",
    label: "Input",
    category: "Inputs",
    previewText: "Single-line input",
    defaultProps: { placeholder: "Type here…", type: "text" },
    propSchema: [
      { kind: "text", key: "placeholder", label: "Placeholder" },
      {
        kind: "select",
        key: "type",
        label: "Type",
        options: ["text", "email", "password", "number"],
      },
    ],
  },
  {
    type: "textarea",
    label: "Textarea",
    category: "Inputs",
    previewText: "Multi-line input",
    defaultProps: { placeholder: "Write something…", rows: 4 },
    propSchema: [
      { kind: "text", key: "placeholder", label: "Placeholder" },
      { kind: "number", key: "rows", label: "Rows", min: 2, max: 12 },
    ],
  },

  // ─── Display ───────────────────────────────────────────
  {
    type: "badge",
    label: "Badge",
    category: "Display",
    previewText: "Small status pill",
    defaultProps: { text: "New", variant: "default" },
    propSchema: [
      { kind: "text", key: "text", label: "Text" },
      {
        kind: "select",
        key: "variant",
        label: "Variant",
        options: ["default", "secondary", "outline", "destructive"],
      },
    ],
  },
  {
    type: "card",
    label: "Card",
    category: "Display",
    previewText: "Container with title + body",
    defaultProps: {
      title: "Card title",
      description: "Card description goes here.",
      body: "This is the card body content.",
    },
    propSchema: [
      { kind: "text", key: "title", label: "Title" },
      { kind: "text", key: "description", label: "Description" },
      { kind: "textarea", key: "body", label: "Body" },
    ],
  },
  {
    type: "progress",
    label: "Progress",
    category: "Display",
    previewText: "Progress bar",
    defaultProps: { value: 60 },
    propSchema: [
      { kind: "number", key: "value", label: "Value", min: 0, max: 100 },
    ],
  },
  {
    type: "skeleton",
    label: "Skeleton",
    category: "Display",
    previewText: "Loading placeholder",
    defaultProps: { width: 240, height: 16 },
    propSchema: [
      { kind: "number", key: "width", label: "Width (px)", min: 40, max: 800 },
      { kind: "number", key: "height", label: "Height (px)", min: 8, max: 400 },
    ],
  },

  // ─── Containers ────────────────────────────────────────
  {
    type: "tabs",
    label: "Tabs",
    category: "Containers",
    previewText: "Tabbed panel",
    defaultProps: { tabs: "Overview, Details, Activity" },
    propSchema: [
      { kind: "text", key: "tabs", label: "Tab labels (comma-separated)" },
    ],
  },
  {
    type: "dialog",
    label: "Dialog",
    category: "Containers",
    previewText: "Modal overlay (trigger)",
    defaultProps: {
      trigger: "Open dialog",
      title: "Dialog title",
      body: "Dialog body content.",
    },
    propSchema: [
      { kind: "text", key: "trigger", label: "Trigger label" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Body" },
    ],
  },
  {
    type: "dropdown-menu",
    label: "Dropdown",
    category: "Containers",
    previewText: "Menu (trigger)",
    defaultProps: {
      trigger: "Options",
      items: "Profile, Settings, Sign out",
    },
    propSchema: [
      { kind: "text", key: "trigger", label: "Trigger label" },
      { kind: "text", key: "items", label: "Menu items (comma-separated)" },
    ],
  },
];

export const CATEGORY_ORDER: ComponentDef["category"][] = [
  "Typography",
  "Buttons",
  "Inputs",
  "Display",
  "Containers",
];

export function getComponentDef(type: string): ComponentDef | undefined {
  return COMPONENT_REGISTRY.find((c) => c.type === type);
}
