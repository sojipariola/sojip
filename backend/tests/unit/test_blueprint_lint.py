"""Unit tests for the deterministic security linter."""
import pytest

from app.core.blueprint_lint import lint_diagram
from app.schemas.blueprint import DiagramEdge, DiagramNode, SystemDiagram

pytestmark = pytest.mark.unit


def _node(id_: str, kind: str, label: str = "", tech: list | None = None) -> DiagramNode:
    return DiagramNode(
        id=id_,
        label=label or id_,
        kind=kind,
        tech_stack=["some-tech"] if tech is None else tech,
        position={"x": 0, "y": 0},
    )


def _edge(id_: str, src: str, tgt: str, kind: str = "data_flow",
          method: str | None = None, path: str | None = None,
          authenticated: bool = True, rate_limited: bool = False) -> DiagramEdge:
    return DiagramEdge(
        id=id_, source=src, target=tgt, kind=kind,
        method=method, path=path,
        authenticated=authenticated, rate_limited=rate_limited,
    )


def test_empty_diagram_fails():
    report = lint_diagram(SystemDiagram())
    assert not report.passed
    assert any(i.severity == "error" for i in report.issues)


def test_clean_diagram_passes():
    diagram = SystemDiagram(
        nodes=[
            _node("fe", "frontend", "Web App", ["Next.js"]),
            _node("be", "backend", "API", ["FastAPI"]),
            _node("db", "database", "Postgres", ["PostgreSQL"]),
        ],
        edges=[
            _edge("e1", "fe", "be", kind="api_call", method="GET", path="/api/x"),
            _edge("e2", "be", "db"),
        ],
    )
    report = lint_diagram(diagram)
    assert report.passed


def test_missing_tech_stack_is_warning():
    diagram = SystemDiagram(
        nodes=[_node("fe", "frontend", "Web", [])],
        edges=[],
    )
    report = lint_diagram(diagram)
    # Warnings don't block, but should be reported
    assert any(
        i.severity == "warning" and "tech stack" in i.message.lower()
        for i in report.issues
    )


def test_unauthenticated_mutation_is_error():
    diagram = SystemDiagram(
        nodes=[
            _node("fe", "frontend"),
            _node("be", "backend"),
        ],
        edges=[
            _edge(
                "e1", "fe", "be",
                kind="api_call", method="POST", path="/api/users",
                authenticated=False,
            ),
        ],
    )
    report = lint_diagram(diagram)
    assert not report.passed
    assert any(
        i.severity == "error" and "not authenticated" in i.message
        for i in report.issues
    )


def test_public_mutation_without_rate_limit_warns():
    diagram = SystemDiagram(
        nodes=[_node("fe", "frontend"), _node("be", "backend")],
        edges=[
            _edge(
                "e1", "fe", "be",
                kind="api_call", method="POST", path="/api/x",
                authenticated=True, rate_limited=False,
            ),
        ],
    )
    report = lint_diagram(diagram)
    # The GET/POST is authenticated so no error; no rate limit warning
    # should be raised for authenticated mutations.
    assert report.passed


def test_frontend_to_database_direct_is_error():
    diagram = SystemDiagram(
        nodes=[
            _node("fe", "frontend"),
            _node("db", "database"),
        ],
        edges=[_edge("e1", "fe", "db")],
    )
    report = lint_diagram(diagram)
    assert not report.passed
    assert any("directly to database" in i.message for i in report.issues)


def test_frontend_without_backend_warns():
    diagram = SystemDiagram(
        nodes=[_node("fe", "frontend")],
        edges=[],
    )
    report = lint_diagram(diagram)
    assert any(
        i.severity == "warning" and "without a backend" in i.message
        for i in report.issues
    )
