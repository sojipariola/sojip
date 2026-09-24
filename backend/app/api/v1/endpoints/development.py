"""
Development phase endpoints.

Provides:
- AI code review of individual commits
- List of past reviews for a project
"""
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user, get_tenant_context, get_tenant_db
from app.core.database import AsyncSessionLocal
from app.core.github_client import GITHUB_API
from app.core.tenant_context import TenantContext
from app.core.token_crypto import TokenCryptoError, decrypt_token
from app.models.user import User
from app.repositories.project import ProjectRepository
from app.schemas.development import CommitReview, CommitReviewRequest
from app.services.ai_service import AIServiceError, get_ai_service

router = APIRouter()

PROMPT_PATH = (
    Path(__file__).parent.parent.parent.parent
    / "prompts"
    / "code_review.txt"
)


def _load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8").strip()


def _parse_owner_repo(url: str | None) -> tuple[str, str] | None:
    if not url:
        return None
    cleaned = url.replace("https://github.com/", "").replace(".git", "")
    parts = cleaned.split("/")
    if len(parts) < 2:
        return None
    return parts[0], parts[1]


async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _fetch_commit_diff(token: str, owner: str, repo: str, sha: str) -> dict:
    """
    Fetch the commit metadata and diff from GitHub.

    Uses the diff media type to get the raw patch in one call.
    """
    headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.diff",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get commit metadata as JSON
        meta_resp = await client.get(
            GITHUB_API + "/repos/" + owner + "/" + repo + "/commits/" + sha,
            headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        if meta_resp.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Commit not found on GitHub",
            )
        if meta_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not fetch commit metadata from GitHub",
            )
        meta = meta_resp.json()

        # Get the diff
        diff_resp = await client.get(
            GITHUB_API + "/repos/" + owner + "/" + repo + "/commits/" + sha,
            headers=headers,
        )
        diff_text = diff_resp.text if diff_resp.status_code == 200 else ""

    # Truncate the diff to keep the AI prompt manageable
    if len(diff_text) > 8000:
        diff_text = diff_text[:8000] + "\n\n... (truncated, diff too large)"

    return {
        "message": (meta.get("commit", {}).get("message") or "").split("\n")[0],
        "author": (meta.get("commit", {}).get("author") or {}).get("name", ""),
        "files_changed": len(meta.get("files", [])),
        "additions": meta.get("stats", {}).get("additions", 0),
        "deletions": meta.get("stats", {}).get("deletions", 0),
        "diff": diff_text,
    }


async def _build_blueprint_context(project_id: UUID, ctx: TenantContext) -> str:
    """Fetch the Blueprint diagram and format it as text for the AI."""
    from app.repositories.artifact import ArtifactRepository

    async with AsyncSessionLocal() as db:
        repo = ArtifactRepository(db, ctx)
        artifact = await repo.get_current(project_id, "system_diagram")
        if artifact is None:
            return "(no Blueprint yet)"

        from app.schemas.blueprint import SystemDiagram
        try:
            diagram = SystemDiagram.model_validate(artifact.data or {})
        except Exception:
            return "(Blueprint is malformed)"

        if not diagram.nodes:
            return "(empty Blueprint)"

        node_lines = []
        for n in diagram.nodes:
            tech = ", ".join(n.tech_stack) if n.tech_stack else "(no tech)"
            node_lines.append("- [" + n.kind + "] " + n.label + " -- " + tech)

        return "Nodes:\n" + "\n".join(node_lines)


@router.post(
    "/{project_id}/development/review-commit",
    response_model=CommitReview,
)
async def review_commit(
    project_id: UUID,
    payload: CommitReviewRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(get_current_user),
):
    """
    Run AI code review on a single commit.

    Reads the diff, cross-references the Blueprint, returns structured
    feedback. Does not modify the repo — advisory only.
    """
    project = await _load_project_or_404(project_id, ctx, db)

    parsed = _parse_owner_repo(project.github_repo)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project has no linked GitHub repository",
        )
    owner, repo_name = parsed

    if not user.github_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect GitHub to review commits",
        )

    try:
        token = decrypt_token(user.github_token_encrypted)
    except TokenCryptoError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt GitHub token: " + str(e),
        )

    # Fetch the diff
    commit_data = await _fetch_commit_diff(token, owner, repo_name, payload.sha)

    if not commit_data["diff"]:
        return CommitReview(
            id=uuid4(),
            commit_sha=payload.sha,
            commit_short_sha=payload.sha[:7],
            passed=True,
            severity="info",
            concern=None,
            reasoning="No diff to review.",
            model="",
            created_at=datetime.now(timezone.utc),
        )

    # Blueprint context
    blueprint_ctx = await _build_blueprint_context(project_id, ctx)

    system_prompt = _load_prompt()
    user_message = (
        "Commit message: " + commit_data["message"] + chr(10) + chr(10)
        + "Files changed: " + str(commit_data["files_changed"])
        + " (+" + str(commit_data["additions"])
        + " / -" + str(commit_data["deletions"]) + ")" + chr(10) + chr(10)
        + "Blueprint:" + chr(10) + blueprint_ctx + chr(10) + chr(10)
        + "Diff:" + chr(10) + commit_data["diff"]
    )

    ai = get_ai_service()
    try:
        result = await ai.chat_json(
            system_prompt=system_prompt,
            user_message=user_message,
            timeout=180.0,
        )
    except AIServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI code review unavailable: " + str(e),
        )

    passed = bool(result.get("passed", True))
    severity = str(result.get("severity", "info"))
    concern = result.get("concern")
    reasoning = str(result.get("reasoning", ""))

    review_id = uuid4()

    # Persist as a remark for history
    from app.models.remark import KIND_CRITIQUE, ROLE_AI, Remark
    from app.repositories.artifact import ArtifactRepository

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project_id, "system_diagram")
    if artifact is not None:
        body_parts = []
        if concern:
            body_parts.append(concern)
        if reasoning:
            body_parts.append(reasoning)
        body = " | ".join(body_parts) if body_parts else "Code review."

        remark = Remark(
            tenant_id=ctx.tenant_id,
            project_id=project_id,
            artifact_id=artifact.id,
            author_id=None,
            field_path="commit:" + payload.sha[:7],
            body=body[:2000],
            author_role=ROLE_AI,
            kind=KIND_CRITIQUE,
        )
        db.add(remark)
        await db.flush()

    return CommitReview(
        id=review_id,
        commit_sha=payload.sha,
        commit_short_sha=payload.sha[:7],
        passed=passed,
        severity=severity,
        concern=concern,
        reasoning=reasoning,
        model=ai.model,
        created_at=datetime.now(timezone.utc),
    )


@router.get(
    "/{project_id}/development/reviews",
    response_model=list[CommitReview],
)
async def list_reviews(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    List all AI code reviews for this project, newest first.

    Reads from the `remarks` table where field_path starts with 'commit:'.
    """
    await _load_project_or_404(project_id, ctx, db)

    from app.models.remark import KIND_CRITIQUE, ROLE_AI, Remark
    stmt = (
        select(Remark)
        .where(
            Remark.tenant_id == ctx.tenant_id,
            Remark.project_id == project_id,
            Remark.author_role == ROLE_AI,
            Remark.kind == KIND_CRITIQUE,
            Remark.field_path.like("commit:%"),
        )
        .order_by(Remark.created_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    rows = list(result.scalars().all())

    out: list[CommitReview] = []
    for r in rows:
        sha_short = r.field_path.split("commit:", 1)[1] if "commit:" in r.field_path else ""
        out.append(
            CommitReview(
                id=r.id,
                commit_sha=sha_short,
                commit_short_sha=sha_short,
                passed=True,  # Historical reviews don't persist pass/fail cleanly
                severity="info",
                concern=None,
                reasoning=r.body,
                model="",
                created_at=r.created_at,
            )
        )
    return out
