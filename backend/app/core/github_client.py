"""
Thin wrapper around the GitHub REST API.

Uses httpx for async HTTP. Every method takes an explicit access token
so we never accidentally use a global one.

Docs: https://docs.github.com/en/rest
"""
from base64 import b64encode
from typing import Any

import httpx


GITHUB_API = "https://api.github.com"


class GitHubError(Exception):
    """Raised when a GitHub API call fails."""

    def __init__(self, message: str, status_code: int = 0, detail: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def get_authenticated_user(token: str) -> dict[str, Any]:
    """
    Fetch the authenticated user's profile.

    Returns { login, id, name, email, avatar_url, ... }

    Raises GitHubError on any failure.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(GITHUB_API + "/user", headers=_headers(token))
    if r.status_code != 200:
        raise GitHubError(
            "Could not fetch GitHub user",
            status_code=r.status_code,
            detail=r.text[:300],
        )
    return r.json()


async def create_repo(
    token: str,
    name: str,
    *,
    owner_type: str = "personal",
    org: str | None = None,
    private: bool = True,
    description: str | None = None,
    auto_init: bool = True,
) -> dict[str, Any]:
    """
    Create a new repository.

    owner_type = "personal" → under the authenticated user
    owner_type = "org"      → under the given org (requires org membership)

    Returns { full_name, html_url, default_branch, ... }.
    """
    payload: dict[str, Any] = {
        "name": name,
        "private": private,
        "auto_init": True,   # Seeds an initial commit so the repo has a main branch
    }
    if description:
        payload["description"] = description

    if owner_type == "org":
        if not org:
            raise GitHubError("owner_type='org' requires an org name")
        url = GITHUB_API + "/orgs/" + org + "/repos"
    else:
        url = GITHUB_API + "/user/repos"

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=_headers(token), json=payload)

    if r.status_code == 422:
        raise GitHubError(
            "A repository with this name already exists",
            status_code=422,
            detail=r.text[:300],
        )
    if r.status_code not in (200, 201):
        raise GitHubError(
            "Could not create repository",
            status_code=r.status_code,
            detail=r.text[:300],
        )
    return r.json()


async def create_initial_commit(
    token: str,
    owner: str,
    repo: str,
    files: dict[str, str],
    message: str = "Initial scaffold from SOJIP",
) -> dict[str, Any]:
    """
    Write all files to the repository using the Contents API.

    One PUT per file. Each creates a commit. Works on freshly-created
    repos that auto_init=True seeded with a placeholder README.

    If a file already exists (e.g., the auto_init README), we fetch its
    SHA and include it in the PUT so GitHub treats it as an update.

    Returns { sha, html_url, commits }.
    """
    headers = _headers(token)
    last_commit_sha = ""
    commits_created = 0

    async with httpx.AsyncClient(timeout=60.0) as client:
        for path, content in files.items():
            encoded = b64encode(content.encode("utf-8")).decode("ascii")
            url = (
                GITHUB_API + "/repos/" + owner + "/" + repo +
                "/contents/" + path
            )

            payload: dict[str, Any] = {
                "message": message + " - " + path,
                "content": encoded,
                "branch": "main",
            }

            # If the file already exists, fetch its SHA so the PUT is an update
            existing = await client.get(url, headers=headers)
            if existing.status_code == 200:
                try:
                    existing_data = existing.json()
                    if isinstance(existing_data, dict) and "sha" in existing_data:
                        payload["sha"] = existing_data["sha"]
                except Exception:
                    pass

            r = await client.put(url, headers=headers, json=payload)

            if r.status_code in (200, 201):
                response_data = r.json()
                commit_info = response_data.get("commit") or {}
                last_commit_sha = commit_info.get("sha", last_commit_sha)
                commits_created += 1
                continue

            # Workflow files require the `workflow` OAuth scope. If we hit a
            # 404 on .github/workflows/*, skip it and continue — the rest of
            # the repo is still valuable, and we'll surface a note.
            if path.startswith(".github/workflows/") and r.status_code == 404:
                # Silent skip — the scaffold is still useful without CI
                continue

            raise GitHubError(
                "Could not write " + path + " (HTTP " + str(r.status_code) + ")",
                status_code=r.status_code,
                detail=r.text[:500],
            )

    return {
        "sha": last_commit_sha,
        "html_url": (
            "https://github.com/" + owner + "/" + repo +
            "/commit/" + last_commit_sha
        ),
        "commits": commits_created,
    }


