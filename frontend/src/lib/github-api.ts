import { apiFetch } from "./api-client";

export type GitHubStatus = {
  connected: boolean;
  username: string | null;
  connected_at: string | null;
};

export type GitHubOrg = {
  login: string;
  id: number;
  avatar_url: string;
};

export type GitHubOrgsResponse = {
  orgs: GitHubOrg[];
  connected: boolean;
  sojip_org_member?: boolean;
  error?: string;
};

export function getGitHubStatus() {
  return apiFetch<GitHubStatus>("/auth/github/status");
}

export function getGitHubOrgs() {
  return apiFetch<GitHubOrgsResponse>("/auth/github/orgs");
}

export function startGitHubOAuth() {
  return apiFetch<{ authorize_url: string }>("/auth/github/start");
}

export function disconnectGitHub() {
  return apiFetch<{ status: string }>("/auth/github/disconnect", {
    method: "POST",
  });
}

// ─── Repository data ─────────────────────────────────────
export type RepoInfo = {
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  description: string | null;
  pushed_at: string | null;
  stargazers_count: number;
  open_issues_count: number;
};

export type CommitInfo = {
  sha: string;
  short_sha: string;
  message: string;
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  date: string | null;
  html_url: string;
};

export function getRepoInfo(owner: string, repo: string) {
  return apiFetch<RepoInfo>(
    `/github/repos/${owner}/${repo}`
  );
}

export function listCommits(owner: string, repo: string, limit = 20) {
  return apiFetch<CommitInfo[]>(
    `/github/repos/${owner}/${repo}/commits?limit=${limit}`
  );
}

// ─── Workspace data ──────────────────────────────────────
export type TreeEntry = {
  path: string;
  type: "blob" | "tree";
  size: number | null;
  sha: string;
};

export type TreeResponse = {
  entries: TreeEntry[];
  truncated: boolean;
};

export type FileContents = {
  path: string;
  size: number;
  encoding: string;
  content: string;
  html_url: string;
  sha: string;
};

export function getRepoTree(owner: string, repo: string, ref = "main") {
  return apiFetch<TreeResponse>(
    `/auth/github/repos/${owner}/${repo}/tree?ref=${encodeURIComponent(ref)}`
  );
}

export function getFileContents(
  owner: string,
  repo: string,
  path: string,
  ref = "main"
) {
  return apiFetch<FileContents>(
    `/auth/github/repos/${owner}/${repo}/contents?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}`
  );
}

export function saveFileContents(
  owner: string,
  repo: string,
  payload: {
    path: string;
    content: string;
    message?: string;
    sha?: string;
  }
) {
  return apiFetch<{
    sha: string;
    commit_sha: string;
    html_url: string;
  }>(`/auth/github/repos/${owner}/${repo}/contents`, {
    method: "PUT",
    body: payload,
  });
}
