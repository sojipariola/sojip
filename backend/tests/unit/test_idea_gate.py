"""Unit tests for app.core.idea_gate — the Lean Canvas gate."""
import pytest

from app.core.idea_gate import (
    MIN_PEER_VALIDATIONS,
    check_canvas_completeness,
    evaluate_idea_gate,
    resolve_policy,
)

pytestmark = pytest.mark.unit


FULL_CANVAS = {
    "problem": "High school students in rural areas lack robotics access.",
    "solution": "An after-school drone program with $150 kits.",
    "unique_value": "Built by students, not textbook authors.",
    "unfair_advantage": "Free weekend access to a college fab lab.",
}

EMPTY_CANVAS: dict = {}


def test_completeness_flags_empty_canvas():
    missing = check_canvas_completeness(EMPTY_CANVAS)
    assert len(missing) == 4
    assert "Problem" in missing


def test_completeness_flags_short_field():
    canvas = dict(FULL_CANVAS, problem="short")  # under 10 chars
    missing = check_canvas_completeness(canvas)
    assert "Problem" in missing


def test_completeness_accepts_full_canvas():
    assert check_canvas_completeness(FULL_CANVAS) == []


def test_gate_fails_without_peer_validations():
    result = evaluate_idea_gate(
        canvas=FULL_CANVAS,
        peer_validation_count=1,
        ai_result={"passed": True, "reasoning": "good"},
    )
    assert not result.passed
    assert any("peer validation" in m.lower() for m in result.missing)


def test_gate_passes_with_everything():
    result = evaluate_idea_gate(
        canvas=FULL_CANVAS,
        peer_validation_count=MIN_PEER_VALIDATIONS,
        ai_result={"passed": True, "reasoning": "solid work"},
    )
    assert result.passed
    assert result.missing == []


def test_gate_fails_when_ai_disagrees():
    result = evaluate_idea_gate(
        canvas=FULL_CANVAS,
        peer_validation_count=3,
        ai_result={"passed": False, "question": "Who specifically?"},
    )
    assert not result.passed
    assert any("AI Mentor" in m for m in result.missing)
    assert result.ai_feedback == "Who specifically?"


def test_strict_policy_requires_locked_artifact():
    result = evaluate_idea_gate(
        canvas=FULL_CANVAS,
        peer_validation_count=3,
        ai_result={"passed": True, "reasoning": "ok"},
        policy="strict",
        artifact_locked=False,
    )
    assert not result.passed
    assert any("Lock" in m for m in result.missing)


def test_strict_policy_passes_when_locked():
    result = evaluate_idea_gate(
        canvas=FULL_CANVAS,
        peer_validation_count=3,
        ai_result={"passed": True, "reasoning": "ok"},
        policy="strict",
        artifact_locked=True,
    )
    assert result.passed


def test_resolve_policy_prefers_project_override():
    assert resolve_policy("flexible", "strict") == "strict"
    assert resolve_policy("strict", None) == "strict"
    assert resolve_policy("flexible", None) == "flexible"
    assert resolve_policy(None, None) == "flexible"  # type: ignore[arg-type]
