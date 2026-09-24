"""
Phase advancement endpoint.

POST /projects/{id}/phase/advance

Runs the current phase gate, and if it passes:
1. Creates a new version of the current artifact
2. Marks the old version as is_current=False
3. Updates projects.current_phase
4. Writes a gate_evaluations row
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.idea_gate import (
    check_canvas_completeness,
    evaluate_idea_gate,
    resolve_policy,
)
from app.core.phases import (
    PHASE_ARTIFACT_KIND,
    is_valid_phase,
    label_for,
    next_phase,
)
from app.core.tenant_context import TenantContext
from app.models.artifact import Artifact
from app.models.gate_evaluation import GateEvaluation
from app.models.tenant import Tenant
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.repositories.validation import PeerValidationRepository
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
    stmt = select(Tenant).where(Tenant.id == ctx.tenant_id)
    tenant = (await db.execute(stmt)).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )
    return tenant


async def _evaluate_idea_gate(project, ctx, db):
    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project.id, "lean_canvas")
    canvas = artifact.data if artifact else {}

    validation_repo = PeerValidationRepository(db, ctx)
    peer_count = await validation_repo.count_for_project(
        project.id, phase="idea"
    )

    tenant = await _load_tenant(ctx, db)
    ai_result = None

    if not check_canvas_completeness(canvas):
        try:
            ai = get_ai_service()
            from pathlib import Path
            prompt_path = (
                Path(__file__).parent.parent.parent.parent
                / "prompts"
                / "idea_gate.txt"
            )
            msg = (
                "Lean Canvas submitted by the student:" + chr(10) + chr(10)
                + "Problem: " + canvas.get("problem", "") + chr(10)
                + "Solution: " + canvas.get("solution", "") + chr(10)
                + "Unique Value: " + canvas.get("unique_value", "") + chr(10)
                + "Unfair Advantage: " + canvas.get("unfair_advantage", "") + chr(10)
            )
            ai_result = await ai.chat_json(
                system_prompt=prompt_path.read_text(encoding="utf-8").strip(),
                user_message=msg,
            )
        except AIServiceError as e:
            ai_result = {
                "passed": True,
                "reasoning": "AI Mentor unavailable (" + str(e) + "). Gate evaluated without AI.",
            }

    policy = resolve_policy(tenant.gate_policy, project.gate_policy_override)
    gate = evaluate_idea_gate(
        canvas=canvas,
        peer_validation_count=peer_count,
        ai_result=ai_result,
        policy=policy,
        artifact_locked=bool(artifact.locked_at) if artifact else False,
    )
    return gate, peer_count


async def _evaluate_plan_gate(project, ctx, db):
    from app.schemas.plan import TaskGraph
    from app.core.critical_path import compute_schedule, has_cycle

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project.id, "task_graph")

    missing = []

    if artifact is None:
        missing.append("Add at least one task to the plan.")
    else:
        try:
            graph = TaskGraph.model_validate(artifact.data or {})
        except Exception:
            missing.append("Task graph is malformed.")
            graph = None

        if graph is not None:
            if not graph.tasks:
                missing.append("Add at least one task to the plan.")
            else:
                unowned = [t.name for t in graph.tasks if t.owner_id is None]
                if unowned:
                    missing.append(
                        "Assign owners to " + str(len(unowned)) + " task(s)."
                    )
                if has_cycle(graph):
                    missing.append("Remove the circular dependency.")

                if graph.budget_days and graph.deadline:
                    try:
                        _, _, total = compute_schedule(graph)
                        if total > graph.budget_days:
                            missing.append(
                                "Critical path is " + str(total) + " days, "
                                + "budget is " + str(graph.budget_days) + "."
                            )
                    except Exception:
                        pass

    class _Result:
        pass
    g = _Result()
    g.passed = len(missing) == 0
    g.missing = missing
    g.reason = "Plan phase met." if not missing else "Plan phase not yet met."
    g.ai_feedback = None
    return g, 0


async def _evaluate_blueprint_gate(project, ctx, db):
    from app.schemas.blueprint import SystemDiagram
    from app.core.blueprint_lint import lint_diagram

    artifact_repo = ArtifactRepository(db, ctx)
    artifact = await artifact_repo.get_current(project.id, "system_diagram")

    missing = []

    if artifact is None:
        missing.append("No system diagram exists yet.")
    else:
        try:
            diagram = SystemDiagram.model_validate(artifact.data or {})
        except Exception:
            missing.append("System diagram is malformed.")
            diagram = None

        if diagram is not None:
            if not diagram.nodes:
                missing.append("Add at least one node to the diagram.")
            else:
                no_tech = [
                    n.label for n in diagram.nodes
                    if n.kind != "note" and not n.tech_stack
                ]
                if no_tech:
                    missing.append(
                        "Assign tech stacks to " + str(len(no_tech)) + " node(s)."
                    )

                for e in diagram.edges:
                    if e.kind == "api_call" and (not e.method or not e.path):
                        missing.append(
                            "An API edge is missing method or path."
                        )
                        break

                report = lint_diagram(diagram)
                errors = [i for i in report.issues if i.severity == "error"]
                for issue in errors[:3]:
                    missing.append(issue.message)

    class _Result:
        pass
    g = _Result()
    g.passed = len(missing) == 0
    g.missing = missing
    g.reason = "Blueprint phase met." if not missing else "Blueprint phase not yet met."
    g.ai_feedback = None
    return g, 0


async def _evaluate_deployment_gate(project, ctx, db):
    """Gate for advancing from Deployment → Maintenance.

    Conditions:
    1. At least one deployment record exists
    2. At least one deployment is healthy (HTTP 200)
    3. At least one deployment has env vars documented
    """
    from types import SimpleNamespace
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
            "Document at least one environment variable. "
            "Even 'NODE_ENV=production' counts."
        )

    return SimpleNamespace(
        passed=len(missing) == 0,
        missing=missing,
        reason=(
            "Deployment phase met. Ready to advance to Maintenance."
            if not missing
            else "Deployment phase not yet met."
        ),
        ai_feedback=None,
    ), 0


@router.post("/{project_id}/phase/advance")
async def advance_phase(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Advance the project to the next phase if the current gate passes."""
    project = await _load_project_or_404(project_id, ctx, db)

    is_owner = project.owner_id == ctx.user_id
    is_teacher = ctx.role in {"teacher", "admin"}
    if not (is_owner or is_teacher):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner or a teacher can advance",
        )

    current_phase = project.current_phase
    next_target = next_phase(current_phase)
    if next_target is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No phase after " + current_phase,
        )

    if current_phase == "idea":
        gate, peer_count = await _evaluate_idea_gate(project, ctx, db)
    elif current_phase == "plan":
        gate, peer_count = await _evaluate_plan_gate(project, ctx, db)
    elif current_phase == "blueprint":
        gate, peer_count = await _evaluate_blueprint_gate(project, ctx, db)
    elif current_phase == "development":
        # Development has no gate — the next phase (Deployment) does.
        # If someone advances from Development, they go straight to Deployment.
        from types import SimpleNamespace
        gate = SimpleNamespace(
            passed=True,
            missing=[],
            reason="Development phase complete. Ready to deploy.",
            ai_feedback=None,
        )
        peer_count = 0
    elif current_phase == "deployment":
        gate, peer_count = await _evaluate_deployment_gate(project, ctx, db)
    else:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Gate for " + current_phase + " is not implemented yet",
        )

    evaluation = GateEvaluation(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        evaluated_by=ctx.user_id,
        gate=current_phase + "_to_" + next_target,
        passed=gate.passed,
        missing=gate.missing,
        ai_feedback=gate.ai_feedback,
        peer_validation_count=peer_count,
    )
    db.add(evaluation)

    if not gate.passed:
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "gate": evaluation.gate,
                "missing": gate.missing,
                "ai_feedback": gate.ai_feedback,
            },
        )

    # Version the current artifact if it exists
    artifact_repo = ArtifactRepository(db, ctx)
    kind = PHASE_ARTIFACT_KIND.get(current_phase)
    if kind:
        old_artifact = await artifact_repo.get_current(project_id, kind)
        if old_artifact is not None:
            old_artifact.is_current = False
            new_version = Artifact(
                tenant_id=old_artifact.tenant_id,
                project_id=old_artifact.project_id,
                phase=old_artifact.phase,
                kind=old_artifact.kind,
                data=dict(old_artifact.data),
                version=old_artifact.version + 1,
                is_current=True,
                locked_at=None,
                locked_by=None,
            )
            db.add(new_version)

    project.current_phase = next_target
    await db.flush()

    return {
        "project_id": str(project.id),
        "slug": project.slug,
        "previous_phase": current_phase,
        "current_phase": next_target,
        "gate": {
            "gate": evaluation.gate,
            "passed": True,
            "reason": gate.reason,
            "ai_feedback": gate.ai_feedback,
        },
    }
