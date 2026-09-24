"""
Maintenance phase endpoints.

Manages the retrospective artifact — the terminal reflection that
closes a project. Additional maintenance capabilities (releases,
issues, analytics, handoff) arrive in later sub-deliveries.
"""
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.models.artifact import Artifact
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.schemas.retrospective import (
    CritiqueResponse,
    MIN_WORDS,
    RetrospectiveContent,
    RetrospectiveDocument,
    RetrospectivePatch,
    RetrospectiveRead,
    RetrospectiveWordCount,
)
from app.services.ai_service import AIServiceError, get_ai_service

router = APIRouter()

KIND = "retrospective"

PROMPT_PATH = (
    Path(__file__).parent.parent.parent.parent
    / "prompts"
    / "retrospective_critique.txt"
)


# ─── Helpers ─────────────────────────────────────────────

async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _load_or_create(project_id: UUID, ctx: TenantContext, db: AsyncSession) -> Artifact:
    repo = ArtifactRepository(db, ctx)
    artifact = await repo.get_current(project_id, KIND)
    if artifact is not None:
        return artifact

    artifact = Artifact(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        phase="maintenance",
        kind=KIND,
        data=RetrospectiveDocument().model_dump(mode="json"),
        version=1,
        is_current=True,
    )
    db.add(artifact)
    await db.flush()
    return artifact


def _parse(artifact: Artifact) -> RetrospectiveDocument:
    try:
        return RetrospectiveDocument.model_validate(artifact.data or {})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Malformed retrospective: " + str(e),
        )


def _word_count(content: RetrospectiveContent) -> int:
    """Count words across all three prompts."""
    parts = [content.surprise, content.differently, content.lesson]
    total = 0
    for p in parts:
        if p:
            total += len(p.split())
    return total


# ─── Endpoints ───────────────────────────────────────────

@router.get("/{project_id}/maintenance", response_model=RetrospectiveRead)
async def get_retrospective(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    return artifact


@router.patch("/{project_id}/maintenance", response_model=RetrospectiveRead)
async def patch_retrospective(
    project_id: UUID,
    payload: RetrospectivePatch,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)

    doc = _parse(artifact)
    if payload.surprise is not None:
        doc.content.surprise = payload.surprise
    if payload.differently is not None:
        doc.content.differently = payload.differently
    if payload.lesson is not None:
        doc.content.lesson = payload.lesson

    artifact.data = doc.model_dump(mode="json")
    await db.flush()
    await db.refresh(artifact)
    return artifact


@router.get(
    "/{project_id}/maintenance/word-count",
    response_model=RetrospectiveWordCount,
)
async def get_word_count(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    doc = _parse(artifact)
    wc = _word_count(doc.content)
    return RetrospectiveWordCount(
        total_words=wc,
        min_words=MIN_WORDS,
        passes_gate=wc >= MIN_WORDS,
    )


@router.post(
    "/{project_id}/maintenance/critique",
    response_model=CritiqueResponse,
)
async def critique_retrospective(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Ask the AI to critique the retrospective.

    The AI reads all three prompts and either approves the reflection
    or asks one pointed follow-up question.
    """
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    doc = _parse(artifact)

    wc = _word_count(doc.content)
    if wc < MIN_WORDS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Retrospective must be at least "
                + str(MIN_WORDS)
                + " words. Currently "
                + str(wc)
                + "."
            ),
        )

    if not PROMPT_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Retrospective prompt missing",
        )

    system_prompt = PROMPT_PATH.read_text(encoding="utf-8").strip()

    user_message = (
        "Student's retrospective:" + chr(10) + chr(10)
        + "WHAT SURPRISED YOU:" + chr(10)
        + doc.content.surprise + chr(10) + chr(10)
        + "WHAT WOULD YOU DO DIFFERENTLY:" + chr(10)
        + doc.content.differently + chr(10) + chr(10)
        + "BIGGEST LESSON:" + chr(10)
        + doc.content.lesson + chr(10)
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
            detail="AI critique unavailable: " + str(e),
        )

    passed = bool(result.get("passed", True))
    severity = str(result.get("severity", "info"))
    concern = result.get("concern")
    reasoning = str(result.get("reasoning", ""))

    # Persist the critique in the artifact
    doc.ai_critique = (concern or "") + (" | " if concern else "") + reasoning
    doc.ai_passed = passed
    doc.submitted_at = datetime.now(timezone.utc)
    artifact.data = doc.model_dump(mode="json")
    await db.flush()

    return CritiqueResponse(
        passed=passed,
        severity=severity,
        concern=concern,
        reasoning=reasoning,
        model=ai.model,
    )
