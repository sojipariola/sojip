"""
Plan phase endpoints.
"""
from datetime import date, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.critical_path import (
    TaskGraphError,
    compute_critical_path,
    compute_schedule,
    has_cycle,
)
from app.core.tenant_context import TenantContext
from app.models.artifact import Artifact
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.schemas.plan import (
    CriticalPathResponse,
    DependencyCreate,
    PlanMetaUpdate,
    Task,
    TaskCreate,
    TaskGraph,
    PlanScheduleSummary,
    TaskGraphDetailed,
    TaskGraphEnriched,
    TaskUpdate,
    TaskWithTimeline,
)

router = APIRouter()

KIND = "task_graph"


async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _load_or_create_artifact(
    project_id: UUID, ctx: TenantContext, db: AsyncSession
) -> Artifact:
    repo = ArtifactRepository(db, ctx)
    artifact = await repo.get_current(project_id, KIND)
    if artifact is not None:
        return artifact

    artifact = Artifact(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        phase="plan",
        kind=KIND,
        data={"tasks": [], "deadline": None, "budget_days": None},
        version=1,
        is_current=True,
    )
    db.add(artifact)
    await db.flush()
    return artifact


def _parse_graph(artifact: Artifact) -> TaskGraph:
    try:
        return TaskGraph.model_validate(artifact.data or {})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Malformed task graph: {e}",
        )


def _ensure_unlocked(artifact: Artifact) -> None:
    if artifact.locked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Plan is locked for review. Unlock to continue editing.",
        )




def _compute_summary(graph: TaskGraph) -> "PlanScheduleSummary":
    """Compute the schedule summary for the diagram view."""
    from app.core.critical_path import (
        compute_schedule,
        compute_critical_path,
        has_cycle as _has_cycle,
    )

    if not graph.tasks:
        return PlanScheduleSummary(
            total_duration_days=0,
            critical_path_task_ids=[],
            has_cycle=False,
            parallelizable_task_ids=[],
            terminal_task_ids=[],
        )

    if _has_cycle(graph):
        return PlanScheduleSummary(
            total_duration_days=0,
            critical_path_task_ids=[],
            has_cycle=True,
            parallelizable_task_ids=[],
            terminal_task_ids=[],
        )

    try:
        _, _, total = compute_schedule(graph)
        cp_path, _ = compute_critical_path(graph)
    except Exception:
        return PlanScheduleSummary(
            total_duration_days=0,
            critical_path_task_ids=[],
            has_cycle=True,
            parallelizable_task_ids=[],
            terminal_task_ids=[],
        )

    # Successor count per task
    successors: dict = {t.id: 0 for t in graph.tasks}
    for t in graph.tasks:
        for dep in t.dependencies:
            if dep in successors:
                successors[dep] += 1

    terminal_task_ids = [t.id for t in graph.tasks if successors[t.id] == 0]

    # Parallelizable: tasks that are NOT on the critical path AND
    # have no dependency relationship with any other task
    cp_set = set(cp_path)
    parallelizable = [
        t.id for t in graph.tasks
        if t.id not in cp_set and not t.dependencies
        and successors[t.id] == 0
    ]

    return PlanScheduleSummary(
        total_duration_days=total,
        critical_path_task_ids=cp_path,
        has_cycle=False,
        parallelizable_task_ids=parallelizable,
        terminal_task_ids=terminal_task_ids,
    )


def _enrich_graph(graph: TaskGraph) -> TaskGraphEnriched:
    """Attach computed timeline data to each task."""
    if not graph.tasks:
        return TaskGraphEnriched(
            tasks=[], deadline=graph.deadline, budget_days=graph.budget_days
        )

    try:
        earliest, latest, total_duration = compute_schedule(graph)
        cp_path, _ = compute_critical_path(graph)
    except TaskGraphError:
        # Cycle — return tasks without timeline data
        return TaskGraphEnriched(
            tasks=[TaskWithTimeline(**t.model_dump()) for t in graph.tasks],
            deadline=graph.deadline,
            budget_days=graph.budget_days,
        )

    cp_index = {tid: i for i, tid in enumerate(cp_path)}

    enriched: list[TaskWithTimeline] = []
    today = date.today()
    for t in graph.tasks:
        latest_start_date = None
        if graph.deadline is not None:
            latest_start_date = graph.deadline - timedelta(
                days=latest.get(t.id, 0) + t.estimate_days
            )
        else:
            # No deadline — use the project start = today
            latest_start_date = today + timedelta(days=latest.get(t.id, 0))

        enriched.append(
            TaskWithTimeline(
                **t.model_dump(),
                latest_start_date=latest_start_date,
                earliest_start_day=earliest.get(t.id, 0),
                critical_path_index=cp_index.get(t.id),
            )
        )

    return TaskGraphEnriched(
        tasks=enriched,
        deadline=graph.deadline,
        budget_days=graph.budget_days,
    )


@router.get("/{project_id}/plan", response_model=TaskGraphEnriched)
async def get_plan(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    graph = _parse_graph(artifact)
    return _enrich_graph(graph)


@router.patch("/{project_id}/plan/meta")
async def update_plan_meta(
    project_id: UUID,
    payload: PlanMetaUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    graph = _parse_graph(artifact)
    if payload.deadline is not None:
        graph.deadline = payload.deadline
    if payload.budget_days is not None:
        graph.budget_days = payload.budget_days

    artifact.data = graph.model_dump(mode="json")
    await db.flush()
    return _enrich_graph(graph)


@router.post(
    "/{project_id}/plan/tasks",
    status_code=status.HTTP_201_CREATED,
)
async def add_task(
    project_id: UUID,
    payload: TaskCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    graph = _parse_graph(artifact)
    new_task = Task(
        id=uuid4(),
        name=payload.name,
        description=payload.description,
        estimate_days=payload.estimate_days,
        dependencies=[],
        owner_id=payload.owner_id,
        must_have=payload.must_have,
    )
    graph.tasks.append(new_task)
    artifact.data = graph.model_dump(mode="json")
    await db.flush()
    return new_task


@router.patch("/{project_id}/plan/tasks/{task_id}")
async def update_task(
    project_id: UUID,
    task_id: UUID,
    payload: TaskUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    graph = _parse_graph(artifact)
    for i, t in enumerate(graph.tasks):
        if t.id == task_id:
            updates = payload.model_dump(exclude_unset=True)
            for key, value in updates.items():
                setattr(t, key, value)
            graph.tasks[i] = t
            artifact.data = graph.model_dump(mode="json")
            await db.flush()
            return t

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Task not found",
    )


@router.delete(
    "/{project_id}/plan/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_task(
    project_id: UUID,
    task_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    graph = _parse_graph(artifact)
    original = len(graph.tasks)
    graph.tasks = [t for t in graph.tasks if t.id != task_id]
    if len(graph.tasks) == original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    for t in graph.tasks:
        t.dependencies = [d for d in t.dependencies if d != task_id]

    artifact.data = graph.model_dump(mode="json")
    await db.flush()


@router.post("/{project_id}/plan/dependencies")
async def add_dependency(
    project_id: UUID,
    payload: DependencyCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    graph = _parse_graph(artifact)

    target = next((t for t in graph.tasks if t.id == payload.to_task_id), None)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target task not found",
        )

    if not any(t.id == payload.from_task_id for t in graph.tasks):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source task not found",
        )

    if payload.from_task_id in target.dependencies:
        return {"status": "exists", "dependencies": [str(d) for d in target.dependencies]}

    target.dependencies.append(payload.from_task_id)
    if has_cycle(graph):
        target.dependencies.remove(payload.from_task_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Adding this dependency would create a cycle",
        )

    artifact.data = graph.model_dump(mode="json")
    await db.flush()
    return {"status": "added", "dependencies": [str(d) for d in target.dependencies]}


@router.delete("/{project_id}/plan/dependencies")
async def remove_dependency(
    project_id: UUID,
    from_task_id: UUID,
    to_task_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    graph = _parse_graph(artifact)
    target = next((t for t in graph.tasks if t.id == to_task_id), None)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    target.dependencies = [d for d in target.dependencies if d != from_task_id]
    artifact.data = graph.model_dump(mode="json")
    await db.flush()
    return {"status": "removed"}


@router.get(
    "/{project_id}/plan/critical-path",
    response_model=CriticalPathResponse,
)
async def get_critical_path(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    graph = _parse_graph(artifact)

    if has_cycle(graph):
        return CriticalPathResponse(path_task_ids=[], total_days=0, has_cycle=True)

    try:
        path, total = compute_critical_path(graph)
    except TaskGraphError:
        return CriticalPathResponse(path_task_ids=[], total_days=0, has_cycle=True)

    return CriticalPathResponse(path_task_ids=path, total_days=total, has_cycle=False)




@router.get("/{project_id}/plan/detailed", response_model=TaskGraphDetailed)
async def get_plan_detailed(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Plan response enriched with schedule summary — used by the
    diagram view.
    """
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    graph = _parse_graph(artifact)
    enriched = _enrich_graph(graph)
    summary = _compute_summary(graph)
    return TaskGraphDetailed(
        tasks=enriched.tasks,
        deadline=enriched.deadline,
        budget_days=enriched.budget_days,
        schedule=summary,
    )


@router.post("/{project_id}/plan/tasks/reorder")
async def reorder_tasks(
    project_id: UUID,
    task_ids: list[UUID],
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    graph = _parse_graph(artifact)
    current_ids = {t.id for t in graph.tasks}
    if set(task_ids) != current_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task ID list does not match current tasks",
        )

    tasks_by_id = {t.id: t for t in graph.tasks}
    graph.tasks = [tasks_by_id[tid] for tid in task_ids]
    artifact.data = graph.model_dump(mode="json")
    await db.flush()
    return {"status": "reordered", "count": len(graph.tasks)}
