"""
Blueprint phase endpoints.

Manages the system diagram artifact and exposes:
- CRUD for nodes and edges
- Bulk replace (React Flow save)
- Deterministic security linter
- AI architecture critique
"""
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.blueprint_lint import lint_diagram
from app.core.tenant_context import TenantContext
from app.models.artifact import Artifact
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.schemas.blueprint import (
    DiagramEdge,
    DiagramNode,
    SecurityIssue,
    SecurityReport,
    SystemDiagram,
    SystemDiagramRead,
)
from app.services.ai_service import AIServiceError, get_ai_service

router = APIRouter()

KIND = "system_diagram"


# ─── Helpers ─────────────────────────────────────────────

async def _load_project_or_404(project_id: UUID, ctx: TenantContext, db: AsyncSession):
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
        phase="blueprint",
        kind=KIND,
        data={"nodes": [], "edges": []},
        version=1,
        is_current=True,
    )
    db.add(artifact)
    await db.flush()
    return artifact


def _parse(artifact: Artifact) -> SystemDiagram:
    try:
        return SystemDiagram.model_validate(artifact.data or {})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Malformed system diagram: {e}",
        )


def _ensure_unlocked(artifact: Artifact) -> None:
    if artifact.locked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Blueprint is locked for review. Unlock to continue editing.",
        )


# ─── Diagram read + replace ──────────────────────────────

@router.get("/{project_id}/blueprint", response_model=SystemDiagramRead)
async def get_blueprint(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    return artifact


@router.patch("/{project_id}/blueprint", response_model=SystemDiagramRead)
async def replace_blueprint(
    project_id: UUID,
    payload: SystemDiagram,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Bulk replace the diagram. Used by React Flow's onSave which sends
    the whole canvas state at once.
    """
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    artifact.data = payload.model_dump(mode="json")
    await db.flush()
    await db.refresh(artifact)
    return artifact


# ─── Node CRUD ───────────────────────────────────────────

@router.post(
    "/{project_id}/blueprint/nodes",
    response_model=DiagramNode,
    status_code=status.HTTP_201_CREATED,
)
async def add_node(
    project_id: UUID,
    payload: DiagramNode,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    diagram = _parse(artifact)
    if not payload.id:
        payload.id = str(uuid4())
    diagram.nodes.append(payload)
    artifact.data = diagram.model_dump(mode="json")
    await db.flush()
    return payload


@router.patch(
    "/{project_id}/blueprint/nodes/{node_id}",
    response_model=DiagramNode,
)
async def update_node(
    project_id: UUID,
    node_id: str,
    payload: dict,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    diagram = _parse(artifact)
    for i, n in enumerate(diagram.nodes):
        if n.id == node_id:
            updates = payload or {}
            for k, v in updates.items():
                if hasattr(n, k) and v is not None:
                    setattr(n, k, v)
            diagram.nodes[i] = n
            artifact.data = diagram.model_dump(mode="json")
            await db.flush()
            return n

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Node not found",
    )


@router.delete(
    "/{project_id}/blueprint/nodes/{node_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_node(
    project_id: UUID,
    node_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    diagram = _parse(artifact)
    original = len(diagram.nodes)
    diagram.nodes = [n for n in diagram.nodes if n.id != node_id]
    if len(diagram.nodes) == original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found",
        )
    diagram.edges = [
        e for e in diagram.edges
        if e.source != node_id and e.target != node_id
    ]
    artifact.data = diagram.model_dump(mode="json")
    await db.flush()


# ─── Edge CRUD ───────────────────────────────────────────

@router.post(
    "/{project_id}/blueprint/edges",
    response_model=DiagramEdge,
    status_code=status.HTTP_201_CREATED,
)
async def add_edge(
    project_id: UUID,
    payload: DiagramEdge,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    diagram = _parse(artifact)
    if not payload.id:
        payload.id = str(uuid4())
    diagram.edges.append(payload)
    artifact.data = diagram.model_dump(mode="json")
    await db.flush()
    return payload


@router.patch(
    "/{project_id}/blueprint/edges/{edge_id}",
    response_model=DiagramEdge,
)
async def update_edge(
    project_id: UUID,
    edge_id: str,
    payload: dict,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    diagram = _parse(artifact)
    for i, e in enumerate(diagram.edges):
        if e.id == edge_id:
            updates = payload or {}
            for k, v in updates.items():
                if hasattr(e, k) and v is not None:
                    setattr(e, k, v)
            diagram.edges[i] = e
            artifact.data = diagram.model_dump(mode="json")
            await db.flush()
            return e

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Edge not found",
    )


@router.delete(
    "/{project_id}/blueprint/edges/{edge_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_edge(
    project_id: UUID,
    edge_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    _ensure_unlocked(artifact)

    diagram = _parse(artifact)
    original = len(diagram.edges)
    diagram.edges = [e for e in diagram.edges if e.id != edge_id]
    if len(diagram.edges) == original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Edge not found",
        )
    artifact.data = diagram.model_dump(mode="json")
    await db.flush()


# ─── Security linter ─────────────────────────────────────

@router.post(
    "/{project_id}/blueprint/lint",
    response_model=SecurityReport,
)
async def lint_blueprint(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Run deterministic security rules against the diagram.

    Fast, predictable. The AI critique (below) handles the nuanced stuff.
    """
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    diagram = _parse(artifact)
    return lint_diagram(diagram)


# ─── AI architecture critique ────────────────────────────

@router.post("/{project_id}/blueprint/critique")
async def critique_blueprint(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Ask the AI to critique the diagram as an architect would.

    Returns a free-form paragraph plus a list of specific issues.
    """
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create_artifact(project_id, ctx, db)
    diagram = _parse(artifact)

    if not diagram.nodes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Add at least one node before asking the AI.",
        )

    # Build a compact text summary of the diagram
    node_lines = []
    for n in diagram.nodes:
        tech = ", ".join(n.tech_stack) if n.tech_stack else "(no tech stack)"
        node_lines.append(f"- [{n.kind}] {n.label} — {tech}")

    edge_lines = []
    for e in diagram.edges:
        src = next((n.label for n in diagram.nodes if n.id == e.source), e.source)
        dst = next((n.label for n in diagram.nodes if n.id == e.target), e.target)
        method_path = ""
        if e.method or e.path:
            method_path = f" ({e.method or '?'} {e.path or '?'})"
        edge_lines.append(f"- {src} → {dst}{method_path}")

    user_message = (
        "System diagram submitted by the student:\n\n"
        "Nodes:\n" + ("\n".join(node_lines) or "(none)") + "\n\n"
        "Edges:\n" + ("\n".join(edge_lines) or "(none)") + "\n"
    )

    system_prompt = (
        "You are a senior software architect reviewing a student's "
        "system diagram. In 3–5 sentences, name the single biggest "
        "architectural concern. Then list 1–3 specific questions the "
        "student should be able to answer. Be concrete, not generic. "
        "Return plain prose, not JSON. /no_think"
    )

    ai = get_ai_service()
    try:
        text = await ai.chat(
            system_prompt=system_prompt,
            user_message=user_message,
            timeout=120.0,
        )
    except AIServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI critique unavailable: {e}",
        ) from e

    return {"critique": text.strip(), "model": ai.model}
