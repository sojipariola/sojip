"""
Phase gate endpoints — one per phase.

Each endpoint validates the phase's artifact and returns a
GateCheckResult. For phases whose full gate isn't implemented yet,
the endpoint returns a placeholder result that the frontend can
render consistently.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.idea_gate import (
    check_canvas_completeness,
    evaluate_idea_gate,
    resolve_policy,
)
from app.core.tenant_context import TenantContext
from app.models.tenant import Tenant
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.schemas.validation import GateCheckResult
from app.services.ai_service import AIServiceError, get_ai_service

router = APIRouter()



async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _load_tenant(ctx, db):
    from sqlalchemy import select

    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    tenant = (await db.execute(stmt)).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )
    return tenant


# ─── IDEA GATE ───────────────────────────────────────────
@router.post(
    "/{project_id}/gates/idea/validate",
    response_model=GateCheckResult,
)
async def validate_idea_gate(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    project = await _load_project_or_404(project_id, ctx, db)
    tenant = await _load_tenant(ctx, db)

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project_id, "lean_canvas")
    canvas = artifact.data if artifact else {}

    from app.repositories.validation import PeerValidationRepository

    validation_repo = PeerValidationRepository(db, ctx)
    peer_count = await validation_repo.count_for_project(project_id, phase="idea")

    ai_result: dict | None = None
    if not check_canvas_completeness(canvas):
        try:
            ai = get_ai_service()
            from pathlib import Path

            prompt_path = (
                Path(__file__).parent.parent.parent.parent
                / "prompts"
                / "idea_gate.txt"
            )
            user_message = (
                "Lean Canvas submitted by the student:\n\n"
                f"Problem: {canvas.get('problem', '')}\n"
                f"Solution: {canvas.get('solution', '')}\n"
                f"Unique Value: {canvas.get('unique_value', '')}\n"
                f"Unfair Advantage: {canvas.get('unfair_advantage', '')}\n"
            )
            ai_result = await ai.chat_json(
                system_prompt=prompt_path.read_text(encoding="utf-8").strip(),
                user_message=user_message,
            )
        except AIServiceError as e:
            ai_result = {
                "passed": True,
                "reasoning": f"AI Mentor unavailable ({e}). Gate evaluated without AI.",
            }

    policy = resolve_policy(tenant.gate_policy, project.gate_policy_override)

    gate = evaluate_idea_gate(
        canvas=canvas,
        peer_validation_count=peer_count,
        ai_result=ai_result,
        policy=policy,
        artifact_locked=bool(artifact.locked_at) if artifact else False,
    )

    return GateCheckResult(
        gate="idea",
        passed=gate.passed,
        reason=gate.reason,
        missing=gate.missing,
        ai_feedback=gate.ai_feedback,
    )


# ─── PLAN GATE ───────────────────────────────────────────
@router.post(
    "/{project_id}/gates/plan/validate",
    response_model=GateCheckResult,
)
async def validate_plan_gate(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Plan gate: every task must have an owner, and the critical path
    must be within the budget (if a budget is set).
    """
    project = await _load_project_or_404(project_id, ctx, db)

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project_id, "task_graph")
    if artifact is None:
        return GateCheckResult(
            gate="plan",
            passed=False,
            reason="Plan phase not yet met.",
            missing=["No task graph exists yet. Add at least one task."],
            ai_feedback=None,
        )

    from app.core.critical_path import has_cycle
    from app.schemas.plan import TaskGraph

    try:
        graph = TaskGraph.model_validate(artifact.data or {})
    except Exception:
        return GateCheckResult(
            gate="plan",
            passed=False,
            reason="Plan phase not yet met.",
            missing=["Task graph is malformed. Contact support."],
            ai_feedback=None,
        )

    missing: list[str] = []

    if not graph.tasks:
        missing.append("Add at least one task to the plan.")

    tasks_without_owner = [t.name for t in graph.tasks if t.owner_id is None]
    if tasks_without_owner:
        preview = ", ".join(tasks_without_owner[:3])
        suffix = f" and {len(tasks_without_owner) - 3} more" if len(tasks_without_owner) > 3 else ""
        missing.append(
            f"Assign owners to: {preview}{suffix}"
        )

    if has_cycle(graph):
        missing.append("Remove the circular dependency in your task graph.")

    if graph.budget_days and graph.deadline:
        from app.core.critical_path import compute_schedule

        try:
            _, _, total = compute_schedule(graph)
            if total > graph.budget_days:
                missing.append(
                    f"Critical path is {total} days, but budget is "
                    f"{graph.budget_days} days. Trim the path or extend the budget."
                )
        except Exception:
            pass

    # AI feedback (advisory) — read the task graph and comment
    ai_feedback: str | None = None
    if not missing and graph.tasks:
        try:
            ai = get_ai_service()
            from pathlib import Path

            prompt_path = (
                Path(__file__).parent.parent.parent.parent
                / "prompts"
                / "plan_gate.txt"
            )
            if prompt_path.exists():
                task_list = "\n".join(
                    f"- {t.name} ({t.estimate_days}d)" for t in graph.tasks
                )
                user_message = (
                    "Project: " + project.name + chr(10) + chr(10) +
                    "Tasks:" + chr(10) + task_list
                )
                ai_result = await ai.chat_json(
                    system_prompt=prompt_path.read_text(encoding="utf-8").strip(),
                    user_message=user_message,
                )
                if not ai_result.get("passed", False):
                    missing.append("AI Mentor has a follow-up question")
                    ai_feedback = ai_result.get("question") or ai_result.get("reasoning")
                else:
                    ai_feedback = ai_result.get("reasoning")
        except AIServiceError as e:
            ai_feedback = f"AI Mentor unavailable ({e}). Gate evaluated without AI."

    passed = len(missing) == 0
    return GateCheckResult(
        gate="plan",
        passed=passed,
        reason=(
            "All Plan phase requirements met. Ready to advance to Blueprint."
            if passed
            else "Plan phase gate not yet met."
        ),
        missing=missing,
        ai_feedback=ai_feedback,
    )


# ─── BLUEPRINT, SCAFFOLD, DEVELOPMENT, MAINTENANCE — PLACEHOLDERS ───
# These endpoints return structured responses so the AI Mentor panel
# renders consistently. Full logic arrives with each phase's build step.

@router.post(
    "/{project_id}/gates/blueprint/validate",
    response_model=GateCheckResult,
)
async def validate_blueprint_gate(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Blueprint gate.

    Requirements:
    1. Diagram has at least one node.
    2. Every non-note node has a tech_stack.
    3. Every api_call edge has method and path.
    4. Deterministic linter reports no errors.
    5. AI architecture review approves (advisory).
    """
    project = await _load_project_or_404(project_id, ctx, db)

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project_id, "system_diagram")
    if artifact is None:
        return GateCheckResult(
            gate="blueprint",
            passed=False,
            reason="Blueprint phase not yet met.",
            missing=["No system diagram exists yet. Add at least one node."],
            ai_feedback=None,
        )

    from app.core.blueprint_lint import lint_diagram
    from app.schemas.blueprint import SystemDiagram

    try:
        diagram = SystemDiagram.model_validate(artifact.data or {})
    except Exception:
        return GateCheckResult(
            gate="blueprint",
            passed=False,
            reason="Blueprint phase not yet met.",
            missing=["System diagram is malformed."],
            ai_feedback=None,
        )

    missing: list[str] = []

    if not diagram.nodes:
        missing.append("Add at least one node to the diagram.")

    no_tech = [
        n.label for n in diagram.nodes
        if n.kind != "note" and not n.tech_stack
    ]
    if no_tech:
        preview = ", ".join(no_tech[:3])
        suffix = (
            " and " + str(len(no_tech) - 3) + " more"
            if len(no_tech) > 3
            else ""
        )
        missing.append("Assign tech stacks to: " + preview + suffix)

    for e in diagram.edges:
        if e.kind == "api_call" and (not e.method or not e.path):
            missing.append(
                "An API edge is missing its method or path. "
                "Click the arrow and set both."
            )
            break

    report = lint_diagram(diagram)
    errors = [i for i in report.issues if i.severity == "error"]
    for issue in errors[:3]:
        missing.append(issue.message)

    ai_feedback: str | None = None
    if not missing and diagram.nodes:
        try:
            ai = get_ai_service()
            from pathlib import Path as _Path

            prompt_path = (
                _Path(__file__).parent.parent.parent.parent
                / "prompts"
                / "blueprint_gate.txt"
            )
            if prompt_path.exists():
                node_lines = []
                for n in diagram.nodes:
                    tech = ", ".join(n.tech_stack) if n.tech_stack else "no tech"
                    node_lines.append("- [" + n.kind + "] " + n.label + " — " + tech)
                user_message = (
                    "Project: " + project.name + "\n\n"
                    + "Nodes:\n" + "\n".join(node_lines)
                )
                ai_result = await ai.chat_json(
                    system_prompt=prompt_path.read_text(encoding="utf-8").strip(),
                    user_message=user_message,
                )
                if not ai_result.get("passed", False):
                    missing.append("AI Mentor has a follow-up question")
                ai_feedback = (
                    ai_result.get("question") or ai_result.get("reasoning")
                )
        except AIServiceError as e:
            ai_feedback = (
                "AI Mentor unavailable. Gate evaluated without AI."
            )

    passed = len(missing) == 0
    return GateCheckResult(
        gate="blueprint",
        passed=passed,
        reason=(
            "All Blueprint phase requirements met. Ready to advance to Scaffold."
            if passed
            else "Blueprint phase gate not yet met."
        ),
        missing=missing,
        ai_feedback=ai_feedback,
    )


@router.post(
    "/{project_id}/gates/scaffold/validate",
    response_model=GateCheckResult,
)
async def validate_scaffold_gate(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)

    ai_feedback: str | None = None
    try:
        ai = get_ai_service()
        ai_feedback = await ai.chat(
            system_prompt=(
                "You are a product mentor. The student is about to "
                "generate their starting codebase. In one short sentence, "
                "give them advice on scaffolding. /no_think"
            ),
            user_message="I'm about to scaffold my repo.",
        )
    except AIServiceError:
        pass

    return GateCheckResult(
        gate="scaffold",
        passed=False,
        reason="Scaffold phase is being built.",
        missing=[
            "The Scaffold workspace arrives in Step 14.",
            "GitHub integration, repo generation, and CI setup are coming.",
        ],
        ai_feedback=ai_feedback,
    )


@router.post(
    "/{project_id}/gates/development/validate",
    response_model=GateCheckResult,
)
async def validate_development_gate(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)

    ai_feedback: str | None = None
    try:
        ai = get_ai_service()
        ai_feedback = await ai.chat(
            system_prompt=(
                "You are a product mentor. The student is developing "
                "their codebase. In one short sentence, give them a "
                "development tip. /no_think"
            ),
            user_message="I'm about to write code.",
        )
    except AIServiceError:
        pass

    return GateCheckResult(
        gate="development",
        passed=False,
        reason="Development phase is being built.",
        missing=[
            "The Development workspace arrives in Step 15.",
            "Embedded IDE, preview URLs, and commit-level AI review are coming.",
        ],
        ai_feedback=ai_feedback,
    )


@router.post(
    "/{project_id}/gates/maintenance/validate",
    response_model=GateCheckResult,
)
async def validate_maintenance_gate(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)

    ai_feedback: str | None = None
    try:
        ai = get_ai_service()
        ai_feedback = await ai.chat(
            system_prompt=(
                "You are a product mentor. The student is maintaining "
                "their shipped product. In one short sentence, tell them "
                "what matters most in maintenance. /no_think"
            ),
            user_message="I'm about to work on maintenance.",
        )
    except AIServiceError:
        pass

    return GateCheckResult(
        gate="maintenance",
        passed=False,
        reason="Maintenance phase is being built.",
        missing=[
            "The Maintenance workspace arrives in Step 16.",
            "Retrospective writer, issue tracker, and release timeline are coming.",
        ],
        ai_feedback=ai_feedback,
    )

@router.post(
    "/{project_id}/gates/deployment/validate",
    response_model=GateCheckResult,
)
async def validate_deployment_gate(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Deployment gate: at least one healthy deployment + env vars documented.
    """
    project = await _load_project_or_404(project_id, ctx, db)

    from sqlalchemy import select

    from app.models.deployment import Deployment

    stmt = (
        select(Deployment)
        .where(
            Deployment.tenant_id == ctx.tenant_id,
            Deployment.project_id == project.id,
        )
        .order_by(Deployment.created_at.desc())
    )
    result = await db.execute(stmt)
    deployments = list(result.scalars().all())

    missing = []

    if not deployments:
        missing.append(
            "Create at least one deployment record. Use the Deploy form."
        )

    healthy = [d for d in deployments if d.status == "healthy"]
    if deployments and not healthy:
        missing.append(
            "No deployment is currently returning HTTP 200. "
            "Fix the URL and re-run the health check."
        )

    has_env = any(bool(d.env_vars_encrypted) for d in deployments)
    if deployments and not has_env:
        missing.append(
            "Document at least one environment variable."
        )

    passed = len(missing) == 0
    return GateCheckResult(
        gate="deployment",
        passed=passed,
        reason=(
            "All Deployment phase requirements met. Ready to advance to Maintenance."
            if passed
            else "Deployment phase not yet met."
        ),
        missing=missing,
        ai_feedback=None,
    )
