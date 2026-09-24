from fastapi import APIRouter

from app.api.v1.endpoints import (
    plans,
    subscriptions,
    ai_planner,
    auth,
    deployments,
    maintenance,
    releases,
    teacher_notes,
    workspace_ui,
    development,
    github_oauth,
    blueprint,
    gates,
    health,
    ideas,
    phase_advance,
    phases,
    plan,
    projects,
    scaffold,
    tenant,
    workspace,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(github_oauth.router, prefix="/auth", tags=["github"])
api_router.include_router(tenant.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(phases.router, prefix="/phases", tags=["phases"])

# Templates at top level — avoids collision with /projects/{project_id}
api_router.include_router(
    scaffold.templates_router, prefix="/scaffold", tags=["scaffold-templates"]
)

api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(ideas.router, prefix="/projects", tags=["ideas"])
api_router.include_router(workspace.router, prefix="/projects", tags=["workspace"])
api_router.include_router(
    phase_advance.router, prefix="/projects", tags=["phase-advance"]
)
api_router.include_router(
    teacher_notes.router, prefix="/teacher-notes", tags=["teacher-notes"]
)
api_router.include_router(plan.router, prefix="/projects", tags=["plan"])
api_router.include_router(blueprint.router, prefix="/projects", tags=["blueprint"])
api_router.include_router(development.router, prefix="/projects", tags=["development"])
api_router.include_router(scaffold.router, prefix="/projects", tags=["scaffold"])
api_router.include_router(gates.router, prefix="/projects", tags=["gates"])
api_router.include_router(
    ai_planner.router, prefix="/projects", tags=["ai-planner"]
)
api_router.include_router(
    maintenance.router, prefix="/projects", tags=["maintenance"]
)
api_router.include_router(
    releases.router, prefix="/projects", tags=["releases"]
)
api_router.include_router(
    deployments.router, prefix="/projects", tags=["deployments"]
)
api_router.include_router(plans.router, prefix="/plans", tags=["plans"])
api_router.include_router(
    subscriptions.router, prefix="/subscriptions", tags=["subscriptions"]
)
api_router.include_router(
    workspace_ui.router, prefix="/projects", tags=["workspace-ui"]
)
