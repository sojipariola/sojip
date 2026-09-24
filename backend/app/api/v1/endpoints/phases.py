from fastapi import APIRouter

from app.core.phases import PHASE_ORDER

router = APIRouter()


PHASE_META: dict[str, dict[str, str]] = {
    "idea": {
        "description": "Define the problem and solution",
        "gate": "3 peer validations + AI quality check",
    },
    "plan": {
        "description": "Timeline, milestones, critical path",
        "gate": "Every task has an owner and the path fits the budget",
    },
    "blueprint": {
        "description": "System design, API schema, tech stack",
        "gate": "Security linter passes + AI architecture review",
    },
    "scaffold": {
        "description": "Generate repo, CI/CD, boilerplate",
        "gate": "Repository created on GitHub",
    },
    "development": {
        "description": "Write code in sandboxed IDE",
        "gate": "Commits reviewed, preview deployment live",
    },
    "deployment": {
        "description": "Ship to a public URL",
        "gate": "At least one healthy deployment + env vars documented",
    },
    "maintenance": {
        "description": "Changelog, retrospective, iteration",
        "gate": "100-word retrospective + first release published",
    },
}


@router.get("")
async def list_phases():
    return {
        "phases": [
            {
                "id": phase,
                "name": phase.capitalize(),
                **PHASE_META[phase],
            }
            for phase in PHASE_ORDER
        ]
    }
