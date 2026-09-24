"""
GitHub OAuth flow.

Endpoints:
- GET  /auth/github/start     — redirect to GitHub's OAuth authorize URL
- GET  /auth/github/callback  — receive code, exchange for token, store
- GET  /auth/github/status    — is the current user connected?
- POST /auth/github/disconnect — revoke and clear stored token

Requires GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and TOKEN_ENCRYPTION_KEY
in .env. See README for setup.
"""
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user
from app.core.database import get_db
from app.config import settings
from app.core.token_crypto import encrypt_token
from app.models.user import User

router = APIRouter()


GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


@router.get("/github/start")
async def github_oauth_start(
    user: User = Depends(get_current_user),
):
    """
    Redirect the browser to GitHub's authorize page.
    Includes a state parameter (the user's ID) so we can verify the callback.
    """
    if not settings.github_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GitHub OAuth is not configured. "
                "Set GITHUB_CLIENT_ID in .env."
            ),
        )

    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_oauth_callback,
        "scope": "repo workflow user:email",
        "state": str(user.id),
    }
    url = GITHUB_AUTHORIZE_URL + "?" + urlencode(params)
    return {"authorize_url": url}


@router.get("/github/callback")
async def github_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive the callback from GitHub, exchange code for a token, store it.
    Then redirect to the frontend.
    """
    # Verify state matches a user
    from uuid import UUID
    try:
        user_id = UUID(state)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter",
        )

    # Exchange code for token
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_oauth_callback,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="GitHub token exchange failed",
            )
        token_data = token_resp.json()

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitHub did not return an access token",
        )

    # Fetch the username
    async with httpx.AsyncClient(timeout=30.0) as client:
        user_resp = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": "Bearer " + access_token,
                "Accept": "application/vnd.github+json",
            },
        )
        user_data = user_resp.json() if user_resp.status_code == 200 else {}

    github_username = user_data.get("login", "unknown")

    # Load the user and update
    from sqlalchemy import select
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.github_username = github_username
    user.github_token_encrypted = encrypt_token(access_token)
    user.github_connected_at = datetime.now(timezone.utc)
    await db.commit()

    # Redirect back to the frontend
    return RedirectResponse(
        url=settings.frontend_url + "/settings/github?connected=1",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/github/status")
async def github_oauth_status(
    user: User = Depends(get_current_user),
):
    """Return whether the current user has connected GitHub."""
    return {
        "connected": user.github_token_encrypted is not None,
        "username": user.github_username,
        "connected_at": (
            user.github_connected_at.isoformat()
            if user.github_connected_at
            else None
        ),
    }


@router.get("/github/repos/{owner}/{repo}")
async def get_repo_info(
    owner: str,
    repo: str,
    user: User = Depends(get_current_user),
):
    """Fetch basic repo info via the authenticated user's GitHub token."""
    if not user.github_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected",
        )

    from app.core.token_crypto import decrypt_token, TokenCryptoError
    try:
        token = decrypt_token(user.github_token_encrypted)
    except TokenCryptoError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt GitHub token",
        )

    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            "https://api.github.com/repos/" + owner + "/" + repo,
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    if r.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found or you do not have access",
        )
    if r.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitHub API error: " + r.text[:200],
        )

    data = r.json()
    return {
        "full_name": data.get("full_name"),
        "html_url": data.get("html_url"),
        "default_branch": data.get("default_branch", "main"),
        "private": data.get("private", True),
        "description": data.get("description"),
        "pushed_at": data.get("pushed_at"),
        "stargazers_count": data.get("stargazers_count", 0),
        "open_issues_count": data.get("open_issues_count", 0),
    }


@router.get("/github/repos/{owner}/{repo}/commits")
async def list_repo_commits(
    owner: str,
    repo: str,
    limit: int = 20,
    user: User = Depends(get_current_user),
):
    """List recent commits via the authenticated user's GitHub token."""
    if not user.github_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected",
        )

    from app.core.token_crypto import decrypt_token, TokenCryptoError
    try:
        token = decrypt_token(user.github_token_encrypted)
    except TokenCryptoError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt GitHub token",
        )

    limit = max(1, min(limit, 50))

    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            "https://api.github.com/repos/" + owner + "/" + repo + "/commits",
            params={"per_page": limit},
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    if r.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found",
        )
    if r.status_code == 409:
        # Empty repo
        return []
    if r.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitHub API error: " + r.text[:200],
        )

    items = r.json()
    if not isinstance(items, list):
        return []

    out = []
    for c in items:
        if not isinstance(c, dict):
            continue
        sha = c.get("sha", "")
        commit = c.get("commit", {}) or {}
        author = commit.get("author", {}) or {}
        gh_author = c.get("author") or {}
        out.append({
            "sha": sha,
            "short_sha": sha[:7],
            "message": (commit.get("message") or "").split("\n")[0][:200],
            "author_name": author.get("name") or "Unknown",
            "author_login": gh_author.get("login"),
            "author_avatar": gh_author.get("avatar_url"),
            "date": author.get("date"),
            "html_url": c.get("html_url", ""),
        })
    return out


@router.put("/github/repos/{owner}/{repo}/contents")
async def save_file_contents(
    owner: str,
    repo: str,
    payload: dict,
    user: User = Depends(get_current_user),
):
    """
    Save a file's contents by creating a commit on GitHub.

    Payload:
      {
        "path": "README.md",
        "content": "new content",
        "message": "commit message",
        "sha": "optional — current file sha for conflict detection"
      }

    Returns { sha, commit_sha, html_url }.
    """
    if not user.github_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected",
        )

    path = (payload or {}).get("path")
    content = (payload or {}).get("content")
    message = (payload or {}).get("message") or "Update " + str(path) + " from SOJIP"
    expected_sha = (payload or {}).get("sha")

    if not path or content is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="path and content are required",
        )

    from app.core.token_crypto import decrypt_token, TokenCryptoError
    try:
        token = decrypt_token(user.github_token_encrypted)
    except TokenCryptoError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt GitHub token",
        )

    import base64
    import httpx

    # Fetch the current SHA if not provided (GitHub requires sha for updates)
    sha_to_use = expected_sha
    if not sha_to_use:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
                headers={
                    "Authorization": "Bearer " + token,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, dict):
                sha_to_use = data.get("sha")

    encoded = base64.b64encode(content.encode("utf-8")).decode("ascii")

    body = {
        "message": message,
        "content": encoded,
        "branch": "main",
    }
    if sha_to_use:
        body["sha"] = sha_to_use

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.put(
            "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
            json=body,
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    if r.status_code == 409:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The file was modified on GitHub. Reload and try again.",
        )
    if r.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitHub API error: " + r.text[:200],
        )

    data = r.json()
    commit = data.get("commit") or {}
    content_data = data.get("content") or {}

    return {
        "sha": content_data.get("sha"),
        "commit_sha": commit.get("sha"),
        "html_url": commit.get("html_url"),
    }


@router.get("/github/repos/{owner}/{repo}/tree")
async def get_repo_tree(
    owner: str,
    repo: str,
    ref: str = "main",
    user: User = Depends(get_current_user),
):
    """
    Fetch the recursive file tree of a repository.

    Returns a flat list of entries:
      { path, type: "blob"|"tree", size, sha }
    """
    if not user.github_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected",
        )

    from app.core.token_crypto import decrypt_token, TokenCryptoError
    try:
        token = decrypt_token(user.github_token_encrypted)
    except TokenCryptoError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt GitHub token",
        )

    import httpx

    # First get the commit SHA for the ref (so we have a tree_sha)
    async with httpx.AsyncClient(timeout=30.0) as client:
        ref_resp = await client.get(
            "https://api.github.com/repos/" + owner + "/" + repo + "/git/refs/heads/" + ref,
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        if ref_resp.status_code == 404:
            # Branch may not exist yet — return empty tree
            return {"entries": [], "truncated": False}
        if ref_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not resolve branch",
            )

        commit_sha = ref_resp.json()["object"]["sha"]

        # Now get the tree recursively
        tree_resp = await client.get(
            "https://api.github.com/repos/" + owner + "/" + repo + "/git/trees/" + commit_sha,
            params={"recursive": "1"},
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    if tree_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch tree",
        )

    data = tree_resp.json()
    entries = []
    for item in data.get("tree", []):
        entries.append({
            "path": item.get("path"),
            "type": item.get("type"),
            "size": item.get("size"),
            "sha": item.get("sha"),
        })

    return {
        "entries": entries,
        "truncated": bool(data.get("truncated", False)),
    }


@router.get("/github/repos/{owner}/{repo}/contents")
async def get_file_contents(
    owner: str,
    repo: str,
    path: str,
    ref: str = "main",
    user: User = Depends(get_current_user),
):
    """
    Fetch a single file's contents.

    Returns { path, size, encoding, content, html_url, sha }.
    Content is decoded to UTF-8 text.
    """
    if not user.github_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected",
        )

    from app.core.token_crypto import decrypt_token, TokenCryptoError
    try:
        token = decrypt_token(user.github_token_encrypted)
    except TokenCryptoError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt GitHub token",
        )

    import base64
    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
            params={"ref": ref},
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    if r.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )
    if r.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch file contents",
        )

    data = r.json()

    # Contents API returns different shapes for files vs directories
    if isinstance(data, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path points to a directory, not a file",
        )

    content = ""
    if data.get("encoding") == "base64" and data.get("content"):
        try:
            raw = base64.b64decode(data["content"])
            content = raw.decode("utf-8", errors="replace")
        except Exception:
            content = "(binary file — could not decode)"

    return {
        "path": data.get("path"),
        "size": data.get("size"),
        "encoding": data.get("encoding"),
        "content": content,
        "html_url": data.get("html_url"),
        "sha": data.get("sha"),
    }


@router.get("/github/orgs")
async def github_orgs(
    user: User = Depends(get_current_user),
):
    """
    Return the orgs the authenticated user belongs to.

    Used by the frontend to decide whether to show the
    'SOJIP Projects org' option in the owner picker.
    """
    if not user.github_token_encrypted:
        return {"orgs": [], "connected": False}

    from app.core.token_crypto import decrypt_token, TokenCryptoError

    try:
        token = decrypt_token(user.github_token_encrypted)
    except TokenCryptoError:
        return {"orgs": [], "connected": True, "error": "token_decrypt_failed"}

    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            "https://api.github.com/user/orgs",
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    if r.status_code != 200:
        return {"orgs": [], "connected": True, "error": "github_api_failed"}

    orgs_data = r.json()
    simplified = [
        {"login": o.get("login"), "id": o.get("id"), "avatar_url": o.get("avatar_url")}
        for o in orgs_data
        if isinstance(o, dict)
    ]

    from app.config import settings

    return {
        "orgs": simplified,
        "connected": True,
        "sojip_org_member": any(
            o["login"] == settings.github_org for o in simplified
        ),
    }


@router.post("/github/disconnect")
async def github_disconnect(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the stored GitHub token for the current user."""
    user.github_username = None
    user.github_token_encrypted = None
    user.github_connected_at = None
    await db.commit()
    return {"status": "disconnected"}
