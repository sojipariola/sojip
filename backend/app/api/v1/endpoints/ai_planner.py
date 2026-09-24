"""
AI Planner endpoint.

Reads the project's Lean Canvas and asks the AI to propose a
starter task list. The proposed tasks are returned to the client,
not written to the database — the student reviews and accepts them.
"""
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.services.ai_service import AIServiceError, get_ai_service

router = APIRouter()


class ProposedTask(BaseModel):
    id: str
    name: str
    description: str | None = None
    estimate_days: int = Field(default=1, ge=1, le=180)
    dependencies: list[str] = Field(default_factory=list)
    must_have: bool = False


class PlannerResponse(BaseModel):
    tasks: list[ProposedTask]
    reasoning: str
    model: str


async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


@router.post(
    "/{project_id}/plan/ai-propose",
    response_model=PlannerResponse,
)
async def propose_tasks(
    project_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Read the Lean Canvas and propose 5–8 starter tasks.

    The tasks are NOT persisted. The client receives them and can
    accept, edit, or discard each one.
    """
    project = await _load_project_or_404(project_id, ctx, db)

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project.id, "lean_canvas")
    if artifact is None or not artifact.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Complete the Lean Canvas before asking the AI to plan.",
        )

    canvas = artifact.data
    prompt_path = (
        Path(__file__).parent.parent.parent.parent
        / "prompts"
        / "plan_planner.txt"
    )
    system_prompt = prompt_path.read_text(encoding="utf-8").strip()

    user_message = (
        f"Project: {project.name}\n"
        f"Description: {project.description or '(none)'}\n\n"
        f"Lean Canvas:\n"
        f"- Problem: {canvas.get('problem', '')}\n"
        f"- Solution: {canvas.get('solution', '')}\n"
        f"- Unique Value: {canvas.get('unique_value', '')}\n"
        f"- Unfair Advantage: {canvas.get('unfair_advantage', '')}\n"
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
            detail=f"AI planner unavailable: {e}",
        ) from e

    raw_tasks = result.get("tasks", [])
    reasoning = result.get("reasoning", "")

    if not isinstance(raw_tasks, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI returned malformed tasks",
        )

    proposed: list[ProposedTask] = []
    for t in raw_tasks[:8]:
        if not isinstance(t, dict):
            continue
        name = str(t.get("name", "")).strip()
        if len(name) < 2:
            continue
        days = t.get("estimate_days", 1)
        try:
            days = int(days)
        except (ValueError, TypeError):
            days = 1
        days = max(1, min(days, 180))
        deps = t.get("dependencies", []) or []
        if not isinstance(deps, list):
            deps = []

        proposed.append(
            ProposedTask(
                id=str(uuid4()),
                name=name[:200],
                description=(t.get("description") or None),
                estimate_days=days,
                dependencies=[],
                must_have=bool(t.get("must_have", False)),
            )
        )

    if not proposed:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI returned no usable tasks",
        )

    return PlannerResponse(
        tasks=proposed,
        reasoning=reasoning,
        model=ai.model,
    )


@router.post("/{project_id}/plan/ai-accept", status_code=201)
async def accept_proposed_tasks(
    project_id: str,
    tasks: list[ProposedTask],
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Accept some or all of the AI's proposed tasks.

    The client sends back the subset it wants. Tasks are appended
    to the current task graph.
    """
    project = await _load_project_or_404(project_id, ctx, db)

    from app.schemas.plan import Task, TaskGraph

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project.id, "task_graph")
    if artifact is None:
        artifact = type(artifact_repo.model)(
            tenant_id=ctx.tenant_id,
            project_id=project.id,
            phase="plan",
            kind="task_graph",
            data={"tasks": [], "deadline": None, "budget_days": None},
            version=1,
            is_current=True,
        )
        db.add(artifact)
        await db.flush()

    graph = TaskGraph.model_validate(artifact.data or {})

    for t in tasks:
        graph.tasks.append(
            Task(
                id=__import__("uuid").UUID(t.id),
                name=t.name,
                description=t.description,
                estimate_days=t.estimate_days,
                dependencies=[],
                owner_id=None,
                must_have=t.must_have,
            )
        )

    artifact.data = graph.model_dump(mode="json")
    await db.flush()

    return {"status": "accepted", "count": len(tasks)}
