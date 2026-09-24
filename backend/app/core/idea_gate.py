"""
The Idea phase gate.

A project can advance from Idea to Plan only if:

1. All four Lean Canvas fields are non-empty.
2. At least 3 peer validations exist for this project + phase.
3. The AI Mentor approves the canvas.
4. If gate policy is "strict": the artifact must be locked.

This module contains pure logic. No HTTP, no database, no AI client.
"""
from dataclasses import dataclass, field

REQUIRED_CANVAS_FIELDS = [
    "problem",
    "solution",
    "unique_value",
    "unfair_advantage",
]

FIELD_LABELS = {
    "problem": "Problem",
    "solution": "Solution",
    "unique_value": "Unique Value",
    "unfair_advantage": "Unfair Advantage",
}

MIN_PEER_VALIDATIONS = 3


@dataclass
class GateResult:
    passed: bool
    missing: list[str] = field(default_factory=list)
    reason: str = ""
    ai_feedback: str | None = None


def check_canvas_completeness(canvas: dict) -> list[str]:
    """Return a list of missing or too-short canvas fields."""
    missing: list[str] = []
    for key in REQUIRED_CANVAS_FIELDS:
        value = canvas.get(key)
        if not value or not isinstance(value, str) or len(value.strip()) < 10:
            missing.append(FIELD_LABELS[key])
    return missing


def evaluate_idea_gate(
    canvas: dict,
    peer_validation_count: int,
    ai_result: dict | None,
    *,
    policy: str = "flexible",
    artifact_locked: bool = False,
) -> GateResult:
    """
    Combine all gate conditions into a single result.

    `policy` is either "flexible" (default) or "strict".
    When "strict", the artifact must be locked to pass.
    """
    missing: list[str] = []

    # 1. Canvas completeness
    canvas_missing = check_canvas_completeness(canvas)
    if canvas_missing:
        missing.append(f"Complete the Lean Canvas: {', '.join(canvas_missing)}")

    # 2. Peer validations
    if peer_validation_count < MIN_PEER_VALIDATIONS:
        remaining = MIN_PEER_VALIDATIONS - peer_validation_count
        missing.append(
            f"Needs {remaining} more peer validation"
            + ("s" if remaining != 1 else "")
        )

    # 3. AI gate
    ai_feedback: str | None = None
    if ai_result is not None:
        ai_passed = bool(ai_result.get("passed", False))
        ai_feedback = ai_result.get("question") or ai_result.get("reasoning")
        if not ai_passed:
            missing.append("AI Mentor has a follow-up question")

    # 4. Strict-mode lock requirement
    if policy == "strict" and not artifact_locked:
        missing.append(
            "Lock the canvas for review (required by this project's gate policy)"
        )

    passed = len(missing) == 0
    reason = (
        "All Idea phase requirements met. Ready to advance to Plan."
        if passed
        else "Idea phase gate not yet met."
    )

    return GateResult(
        passed=passed,
        missing=missing,
        reason=reason,
        ai_feedback=ai_feedback,
    )


def resolve_policy(tenant_policy: str, project_override: str | None) -> str:
    """Project override wins; otherwise inherit from tenant."""
    return project_override or tenant_policy or "flexible"
