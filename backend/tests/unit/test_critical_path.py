"""Unit tests for app.core.critical_path — the DAG math."""
from uuid import uuid4

import pytest

from app.core.critical_path import (
    TaskGraphError,
    compute_critical_path,
    compute_schedule,
    has_cycle,
)
from app.schemas.plan import Task, TaskGraph

pytestmark = pytest.mark.unit


def _t(name: str, days: int, deps: list | None = None) -> Task:
    return Task(
        id=uuid4(),
        name=name,
        estimate_days=days,
        dependencies=deps or [],
    )


def test_empty_graph():
    g = TaskGraph(tasks=[])
    assert compute_critical_path(g) == ([], 0)
    assert compute_schedule(g) == ({}, {}, 0)
    assert not has_cycle(g)


def test_single_task():
    t = _t("solo", 5)
    g = TaskGraph(tasks=[t])
    path, total = compute_critical_path(g)
    assert path == [t.id]
    assert total == 5


def test_linear_chain():
    a = _t("A", 3)
    b = _t("B", 4, [a.id])
    c = _t("C", 2, [b.id])
    g = TaskGraph(tasks=[a, b, c])

    path, total = compute_critical_path(g)
    assert path == [a.id, b.id, c.id]
    assert total == 9


def test_parallel_paths_pick_longest():
    #    A(5) -> C(3)
    #    B(8) -> C(3)
    a = _t("A", 5)
    b = _t("B", 8)
    c = _t("C", 3, [a.id, b.id])
    g = TaskGraph(tasks=[a, b, c])

    path, total = compute_critical_path(g)
    # Should follow B (8 days) since it's longer than A (5 days)
    assert path == [b.id, c.id]
    assert total == 11


def test_independent_tasks_all_start_at_zero():
    a = _t("A", 3)
    b = _t("B", 5)
    c = _t("C", 2)
    g = TaskGraph(tasks=[a, b, c])

    earliest, latest, total = compute_schedule(g)
    assert earliest[a.id] == 0
    assert earliest[b.id] == 0
    assert earliest[c.id] == 0
    assert total == 5  # longest single task


def test_earliest_start_respects_dependencies():
    a = _t("A", 3)
    b = _t("B", 4, [a.id])
    c = _t("C", 2, [b.id])
    g = TaskGraph(tasks=[a, b, c])

    earliest, _, total = compute_schedule(g)
    assert earliest[a.id] == 0
    assert earliest[b.id] == 3
    assert earliest[c.id] == 7
    assert total == 9


def test_cycle_detection():
    a = _t("A", 1)
    b = _t("B", 1, [a.id])
    # Manually create a cycle: A depends on B (mutating the frozen-ish model)
    a.dependencies = [b.id]
    g = TaskGraph(tasks=[a, b])

    assert has_cycle(g)

    with pytest.raises(TaskGraphError):
        compute_critical_path(g)


def test_unknown_dependency_raises():
    a = _t("A", 1)
    b = _t("B", 1, [uuid4()])  # dep on a task that doesn't exist
    g = TaskGraph(tasks=[a, b])

    with pytest.raises(TaskGraphError):
        compute_critical_path(g)


def test_diamond_dependency():
    #       B(2)
    #      /    \
    #  A(1)      D(1)
    #      \    /
    #       C(4)
    a = _t("A", 1)
    b = _t("B", 2, [a.id])
    c = _t("C", 4, [a.id])
    d = _t("D", 1, [b.id, c.id])
    g = TaskGraph(tasks=[a, b, c, d])

    path, total = compute_critical_path(g)
    # Should go through C because C(4) > B(2)
    assert path == [a.id, c.id, d.id]
    assert total == 1 + 4 + 1  # 6
