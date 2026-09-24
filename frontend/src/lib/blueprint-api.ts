import { apiFetch } from "./api-client";

export type DiagramNode = {
  id: string;
  label: string;
  kind: string;
  description: string | null;
  tech_stack: string[];
  position: { x: number; y: number };
};

export type DiagramEdge = {
  id: string;
  source: string;
  target: string;
  label: string | null;
  kind: string;
  method: string | null;
  path: string | null;
  authenticated: boolean;
  rate_limited: boolean;
};

export type SystemDiagram = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export type BlueprintArtifact = {
  id: string;
  project_id: string;
  phase: string;
  kind: string;
  data: SystemDiagram;
  version: number;
  is_current: boolean;
  locked_at: string | null;
  locked_by: string | null;
};

export function getBlueprint(projectId: string) {
  return apiFetch<BlueprintArtifact>(`/projects/${projectId}/blueprint`);
}

export function saveBlueprint(projectId: string, data: SystemDiagram) {
  return apiFetch<BlueprintArtifact>(`/projects/${projectId}/blueprint`, {
    method: "PATCH",
    body: data,
  });
}

export type NodeKind = {
  id: string;
  label: string;
  color: string;
  tooltip: string;
  description: string;
  examples: string[];
};

export const NODE_KINDS: NodeKind[] = [
  {
    id: "frontend",
    label: "Frontend",
    color: "#7c9cbf",
    tooltip: "What the user sees and interacts with",
    description:
      "The browser-side application. Handles UI, user input, and calls the backend for data.",
    examples: ["Next.js", "React", "Vue", "Svelte", "SwiftUI", "Flutter"],
  },
  {
    id: "backend",
    label: "Backend",
    color: "#c85a3a",
    tooltip: "Business logic and API endpoints",
    description:
      "Server-side application. Receives requests from the frontend, enforces rules, and talks to the database.",
    examples: ["FastAPI", "Node.js / Express", "Django", "NestJS", "Go", "Rails"],
  },
  {
    id: "database",
    label: "Database",
    color: "#6b8e5a",
    tooltip: "Persistent data storage",
    description:
      "Where records live long-term. Relational (SQL) for structured data; document or key-value for flexible data.",
    examples: ["PostgreSQL", "MySQL", "MongoDB", "SQLite", "DynamoDB"],
  },
  {
    id: "queue",
    label: "Queue",
    color: "#b88b3a",
    tooltip: "Async work between services",
    description:
      "Holds jobs to be processed later. Decouples slow work (emails, scraping, reports) from the request that triggered it.",
    examples: ["Redis", "RabbitMQ", "SQS", "Kafka", "Celery"],
  },
  {
    id: "cache",
    label: "Cache",
    color: "#a8689c",
    tooltip: "Fast in-memory storage",
    description:
      "Stores frequently-accessed data for quick retrieval. Reduces load on the database and speeds up responses.",
    examples: ["Redis", "Memcached", "CDN edge cache"],
  },
  {
    id: "auth",
    label: "Auth",
    color: "#4a7c94",
    tooltip: "Identity and permissions",
    description:
      "Verifies who a user is and what they can do. Handles sign-up, login, sessions, roles, and access control.",
    examples: ["Supabase Auth", "Auth0", "Clerk", "Firebase Auth", "Keycloak"],
  },
  {
    id: "external",
    label: "External API",
    color: "#8c8c8c",
    tooltip: "A third-party service you call",
    description:
      "Any service outside your control that your app depends on. Payment, email, maps, AI, or another company's data.",
    examples: ["Stripe", "SendGrid", "OpenAI", "Google Maps", "Twilio"],
  },
  {
    id: "other",
    label: "Other",
    color: "#64748b",
    tooltip: "Anything not covered above",
    description:
      "Use for services that don't fit cleanly — background workers, cron jobs, scheduled tasks, or custom infrastructure.",
    examples: ["Cron job", "Background worker", "Scheduler", "Webhook receiver"],
  },
];

export const EDGE_KINDS = [
  { id: "api_call", label: "API Call" },
  { id: "data_flow", label: "Data Flow" },
  { id: "event", label: "Event" },
  { id: "dependency", label: "Dependency" },
] as const;

// ─── Security linter ─────────────────────────────────────
export type SecurityIssue = {
  severity: "info" | "warning" | "error";
  node_id: string | null;
  edge_id: string | null;
  message: string;
  suggestion: string | null;
};

export type SecurityReport = {
  issues: SecurityIssue[];
  passed: boolean;
  summary: string;
};

export function lintBlueprint(projectId: string) {
  return apiFetch<SecurityReport>(`/projects/${projectId}/blueprint/lint`, {
    method: "POST",
  });
}

export function critiqueBlueprint(projectId: string) {
  return apiFetch<{ critique: string; model: string }>(
    `/projects/${projectId}/blueprint/critique`,
    { method: "POST" }
  );
}
