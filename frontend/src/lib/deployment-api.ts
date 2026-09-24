import { apiFetch } from "./api-client";

export type DeploymentTarget =
  | "railway"
  | "fly"
  | "vercel"
  | "docker"
  | "codespaces"
  | "custom"
  | "github_pages"
  | "npm"
  | "pypi"
  | "chrome_store"
  | "local_network"
  | "download";

export type DeploymentEnvironment = "production" | "staging" | "preview";

export type DeploymentStatus =
  | "pending"
  | "deploying"
  | "healthy"
  | "unhealthy"
  | "unreachable"
  | "failed"
  | "rolled_back";

export type Deployment = {
  id: string;
  project_id: string;
  created_by: string | null;
  target: DeploymentTarget;
  environment: DeploymentEnvironment;
  url: string | null;
  commit_sha: string | null;
  version_tag: string | null;
  status: DeploymentStatus;
  health_check_at: string | null;
  health_check_status: number | null;
  health_check_error: string | null;
  env_vars_masked: Record<string, string>;
  deploy_script: string | null;
  rolled_back_from_id: string | null;
  rolled_back_at: string | null;
  deployed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeploymentCreate = {
  target: DeploymentTarget;
  environment: DeploymentEnvironment;
  url?: string | null;
  commit_sha?: string | null;
  version_tag?: string | null;
  env_vars?: Record<string, string>;
};

export type DeploymentUpdate = {
  url?: string | null;
  status?: DeploymentStatus;
  environment?: DeploymentEnvironment;
  commit_sha?: string | null;
  version_tag?: string | null;
};

export type HealthCheckResult = {
  status_code: number | null;
  is_healthy: boolean;
  error: string | null;
  checked_at: string;
};

export type DeploymentScript = {
  target: string;
  script: string;
  env_example: string;
};

export type EnvExample = {
  filename: string;
  content: string;
  keys: string[];
};

export function listDeployments(projectId: string) {
  return apiFetch<Deployment[]>(`/projects/${projectId}/deployments`);
}

export function createDeployment(projectId: string, payload: DeploymentCreate) {
  return apiFetch<Deployment>(`/projects/${projectId}/deployments`, {
    method: "POST",
    body: payload,
  });
}

export function updateDeployment(
  projectId: string,
  deploymentId: string,
  payload: DeploymentUpdate
) {
  return apiFetch<Deployment>(
    `/projects/${projectId}/deployments/${deploymentId}`,
    { method: "PATCH", body: payload }
  );
}

export function deleteDeployment(projectId: string, deploymentId: string) {
  return apiFetch<void>(
    `/projects/${projectId}/deployments/${deploymentId}`,
    { method: "DELETE" }
  );
}

export function runHealthCheck(projectId: string, deploymentId: string) {
  return apiFetch<HealthCheckResult>(
    `/projects/${projectId}/deployments/${deploymentId}/health-check`,
    { method: "POST" }
  );
}

export function patchEnvVars(
  projectId: string,
  deploymentId: string,
  envVars: Record<string, string>
) {
  return apiFetch<Deployment>(
    `/projects/${projectId}/deployments/${deploymentId}/env`,
    { method: "PATCH", body: { env_vars: envVars } }
  );
}

export function revealEnvVar(
  projectId: string,
  deploymentId: string,
  key: string
) {
  return apiFetch<{ key: string; value: string }>(
    `/projects/${projectId}/deployments/${deploymentId}/env/${encodeURIComponent(key)}/reveal`
  );
}

export function generateScript(
  projectId: string,
  target: DeploymentTarget,
  includeEnv = true
) {
  return apiFetch<DeploymentScript>(
    `/projects/${projectId}/deployments/generate-script`,
    { method: "POST", body: { target, include_env: includeEnv } }
  );
}

export function getEnvExample(projectId: string, deploymentId: string) {
  return apiFetch<EnvExample>(
    `/projects/${projectId}/deployments/${deploymentId}/env-example`
  );
}

// ─── Metadata ──────────────────────────────────────────────

export const TARGET_META: Record<
  DeploymentTarget,
  {
    label: string;
    description: string;
    icon: string;
    category: "fullstack" | "standalone";
    verification: "http" | "registry" | "manual";
  }
> = {
  railway: {
    label: "Railway",
    description: "Simple Git-based deploys. Free tier.",
    icon: "🚂",
    category: "fullstack",
    verification: "http",
  },
  fly: {
    label: "Fly.io",
    description: "Global edge deploys. Free allowance.",
    icon: "✈️",
    category: "fullstack",
    verification: "http",
  },
  vercel: {
    label: "Vercel",
    description: "Best for Next.js and static sites.",
    icon: "▲",
    category: "fullstack",
    verification: "http",
  },
  docker: {
    label: "Docker",
    description: "Build and run anywhere. Portable.",
    icon: "🐳",
    category: "fullstack",
    verification: "http",
  },
  codespaces: {
    label: "Codespaces",
    description: "Zero setup. Port-forwarded automatically.",
    icon: "⚡",
    category: "fullstack",
    verification: "http",
  },
  custom: {
    label: "Custom",
    description: "Any provider. Write your own commands.",
    icon: "🛠",
    category: "fullstack",
    verification: "http",
  },
  github_pages: {
    label: "GitHub Pages",
    description: "Free static hosting. Perfect for HTML sites.",
    icon: "📄",
    category: "standalone",
    verification: "http",
  },
  npm: {
    label: "npm",
    description: "Publish a Node.js CLI or library.",
    icon: "⬢",
    category: "standalone",
    verification: "registry",
  },
  pypi: {
    label: "PyPI",
    description: "Publish a Python package.",
    icon: "🐍",
    category: "standalone",
    verification: "registry",
  },
  chrome_store: {
    label: "Chrome Web Store",
    description: "Publish a browser extension.",
    icon: "🧩",
    category: "standalone",
    verification: "manual",
  },
  local_network: {
    label: "Local network",
    description: "Raspberry Pi, home server, LAN.",
    icon: "🔌",
    category: "standalone",
    verification: "http",
  },
  download: {
    label: "Download / Release",
    description: "Desktop apps, Electron builds.",
    icon: "🖥",
    category: "standalone",
    verification: "manual",
  },
};

export const STATUS_META: Record<
  DeploymentStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Pending",
    color: "text-slate-600",
    bg: "bg-slate-100 border-slate-200",
  },
  deploying: {
    label: "Deploying",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  healthy: {
    label: "Healthy",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
  unhealthy: {
    label: "Unhealthy",
    color: "text-amber-800",
    bg: "bg-amber-100 border-amber-300",
  },
  unreachable: {
    label: "Unreachable",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bg: "bg-red-100 border-red-300",
  },
  rolled_back: {
    label: "Rolled back",
    color: "text-slate-500",
    bg: "bg-slate-50 border-slate-200",
  },
};

// ─── Rollback + single fetch ──────────────────────────────
export function getDeployment(projectId: string, deploymentId: string) {
  return apiFetch<Deployment>(
    `/projects/${projectId}/deployments/${deploymentId}`
  );
}

/**
 * Roll back to a previous deployment.
 *
 * This is not yet implemented on the backend as a dedicated endpoint.
 * For now, the client-side behavior is:
 *   1. Create a new deployment that references the previous one
 *   2. The new deployment inherits the URL and env vars
 *   3. It is marked as the current production deployment
 *
 * The backend endpoint `POST /deployments/{id}/rollback` will be added
 * in a follow-up; for now, the client implements it as a fresh create.
 */
export function rollbackDeployment(
  projectId: string,
  sourceDeploymentId: string,
  payload: { url: string; target: string; environment: string }
) {
  return apiFetch<Deployment>(
    `/projects/${projectId}/deployments`,
    {
      method: "POST",
      body: {
        target: payload.target,
        environment: payload.environment,
        url: payload.url,
      },
    }
  );
}
