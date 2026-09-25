"""
Canonical phase definitions for SOJIP.

Every place in the backend that needs to know the phase order, the
human-readable label, or which artifact kind belongs to a phase
imports from this module. Never duplicate these lists.
"""
from typing import Literal

PhaseId = Literal[
    "idea",
    "plan",
    "blueprint",
    "scaffold",
    "development",
    "deployment",
    "maintenance",
]


# Canonical order. Anything that walks the journey uses this.
PHASE_ORDER: tuple[str, ...] = (
    "idea",
    "plan",
    "blueprint",
    "scaffold",
    "development",
    "deployment",
    "maintenance",
)


# Human-readable labels — used in prompts, error messages, and
# anywhere the backend needs to talk about a phase by name.
PHASE_LABEL: dict[str, str] = {
    "idea": "Idea",
    "plan": "Plan",
    "blueprint": "Blueprint",
    "scaffold": "Scaffold",
    "development": "Development",
    "deployment": "Deployment",
    "maintenance": "Maintenance",
}


# Which artifact kind belongs to each phase, if any.
# `None` means the phase produces no artifact (the work IS the artifact).
PHASE_ARTIFACT_KIND: dict[str, str | None] = {
    "idea": "lean_canvas",
    "plan": "task_graph",
    "blueprint": "system_diagram",
    "scaffold": None,
    "development": None,
    "deployment": None,
    "maintenance": "retrospective",
}


def is_valid_phase(phase: str) -> bool:
    return phase in PHASE_ORDER


def next_phase(current: str) -> str | None:
    """Return the phase after `current`, or None if at the end."""
    try:
        idx = PHASE_ORDER.index(current)
    except ValueError:
        return None
    if idx + 1 >= len(PHASE_ORDER):
        return None
    return PHASE_ORDER[idx + 1]


def previous_phase(current: str) -> str | None:
    """Return the phase before `current`, or None if at the start."""
    try:
        idx = PHASE_ORDER.index(current)
    except ValueError:
        return None
    if idx == 0:
        return None
    return PHASE_ORDER[idx - 1]


def artifact_kind_for(phase: str) -> str | None:
    return PHASE_ARTIFACT_KIND.get(phase)


def label_for(phase: str) -> str:
    return PHASE_LABEL.get(phase, phase)
