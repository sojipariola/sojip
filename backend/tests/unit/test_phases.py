"""Unit tests for app.core.phases — pure logic, no DB."""
import pytest

from app.core.phases import (
    PHASE_ARTIFACT_KIND,
    PHASE_LABEL,
    PHASE_ORDER,
    artifact_kind_for,
    is_valid_phase,
    label_for,
    next_phase,
    previous_phase,
)

pytestmark = pytest.mark.unit


def test_phase_order_is_seven_phases():
    assert len(PHASE_ORDER) == 7
    assert PHASE_ORDER[0] == "idea"
    assert PHASE_ORDER[-1] == "maintenance"


def test_every_phase_has_a_label():
    for phase in PHASE_ORDER:
        assert phase in PHASE_LABEL
        assert PHASE_LABEL[phase]


def test_every_phase_has_an_artifact_kind_entry():
    for phase in PHASE_ORDER:
        assert phase in PHASE_ARTIFACT_KIND


def test_next_phase_walks_forward():
    assert next_phase("idea") == "plan"
    assert next_phase("plan") == "blueprint"
    assert next_phase("deployment") == "maintenance"
    assert next_phase("maintenance") is None


def test_previous_phase_walks_backward():
    assert previous_phase("maintenance") == "deployment"
    assert previous_phase("plan") == "idea"
    assert previous_phase("idea") is None


def test_next_and_previous_reject_unknown_phases():
    assert next_phase("not-a-phase") is None
    assert previous_phase("not-a-phase") is None


def test_is_valid_phase():
    assert is_valid_phase("idea")
    assert is_valid_phase("maintenance")
    assert not is_valid_phase("")
    assert not is_valid_phase("planning")


def test_label_for_returns_fallback_for_unknown():
    assert label_for("idea") == "Idea"
    assert label_for("unknown") == "unknown"


def test_artifact_kind_for_phase():
    assert artifact_kind_for("idea") == "lean_canvas"
    assert artifact_kind_for("plan") == "task_graph"
    assert artifact_kind_for("blueprint") == "system_diagram"
    assert artifact_kind_for("scaffold") is None
    assert artifact_kind_for("maintenance") == "retrospective"
