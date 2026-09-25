"""
Deterministic security rules for system diagrams.

These run BEFORE the AI critique. They're fast, predictable, and
catch the obvious mistakes. The AI handles the nuanced stuff.

Schema reminder (flat, not nested):
  node: id, label, kind, description, tech_stack, position
  edge: id, source, target, label, kind, method, path,
        authenticated, rate_limited
"""
from app.schemas.blueprint import SecurityIssue, SecurityReport, SystemDiagram

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def lint_diagram(diagram: SystemDiagram) -> SecurityReport:
    issues: list[SecurityIssue] = []

    if not diagram.nodes:
        return SecurityReport(
            issues=[
                SecurityIssue(
                    severity="error",
                    message="The diagram has no nodes.",
                    suggestion="Add at least a frontend and a backend node.",
                )
            ],
            passed=False,
            summary="Empty diagram",
        )

    # 1. Every non-note node needs a tech stack
    for node in diagram.nodes:
        if node.kind == "note":
            continue
        if not node.tech_stack:
            issues.append(
                SecurityIssue(
                    severity="warning",
                    node_id=node.id,
                    message="Node '" + node.label + "' has no tech stack.",
                    suggestion="Pick a concrete technology for this node.",
                )
            )

    # 2. Every mutating edge needs authentication
    for edge in diagram.edges:
        method = (edge.method or "GET").upper()
        if method in MUTATING_METHODS and not edge.authenticated:
            src = _label_of(diagram, edge.source)
            dst = _label_of(diagram, edge.target)
            path = edge.path or "(no path)"
            issues.append(
                SecurityIssue(
                    severity="error",
                    edge_id=edge.id,
                    message=(
                        method + " " + path + " (" + src + " → " + dst + ")"
                        " is not authenticated."
                    ),
                    suggestion=(
                        "Public mutating endpoints are a common abuse vector. "
                        "Mark this edge as authenticated, or explicitly add an "
                        "auth node that terminates the request."
                    ),
                )
            )

    # 3. Public endpoints should be rate-limited
    for edge in diagram.edges:
        method = (edge.method or "GET").upper()
        if (
            not edge.authenticated
            and not edge.rate_limited
            and method in MUTATING_METHODS
        ):
            path = edge.path or "(no path)"
            issues.append(
                SecurityIssue(
                    severity="warning",
                    edge_id=edge.id,
                    message=method + " " + path + " is public but has no rate limit.",
                    suggestion="Add rate limiting to prevent abuse.",
                )
            )

    # 4. No direct frontend → database connections
    for edge in diagram.edges:
        src = _node_of(diagram, edge.source)
        dst = _node_of(diagram, edge.target)
        if src and dst and src.kind == "frontend" and dst.kind == "database":
            issues.append(
                SecurityIssue(
                    severity="error",
                    edge_id=edge.id,
                    message=(
                        "Frontend '" + src.label + "' connects directly to "
                        "database '" + dst.label + "'."
                    ),
                    suggestion=(
                        "Frontends should talk to a backend, which then talks "
                        "to the database. Direct DB access from the browser "
                        "exposes credentials and bypasses business logic."
                    ),
                )
            )

    # 5. Backend without any database node
    has_backend = any(n.kind == "backend" for n in diagram.nodes)
    has_db = any(n.kind in ("database", "storage") for n in diagram.nodes)
    if has_backend and not has_db:
        issues.append(
            SecurityIssue(
                severity="info",
                message="No database or storage node in the diagram.",
                suggestion=(
                    "If this project doesn't persist data, ignore this. "
                    "Otherwise, add a database node."
                ),
            )
        )

    # 6. Frontend without any backend
    has_frontend = any(n.kind == "frontend" for n in diagram.nodes)
    if has_frontend and not has_backend:
        issues.append(
            SecurityIssue(
                severity="warning",
                message="Frontend exists without a backend.",
                suggestion=(
                    "Most projects need a backend to handle business logic. "
                    "If this is a static site, you can ignore this."
                ),
            )
        )

    errors = [i for i in issues if i.severity == "error"]
    passed = len(errors) == 0

    if passed and not issues:
        summary = "No issues found. The diagram looks clean."
    elif passed:
        summary = str(len(issues)) + " minor suggestion(s). No blocking issues."
    else:
        summary = str(len(errors)) + " blocking issue(s). Fix them to pass the gate."

    return SecurityReport(issues=issues, passed=passed, summary=summary)


def _node_of(diagram: SystemDiagram, node_id: str):
    return next((n for n in diagram.nodes if n.id == node_id), None)


def _label_of(diagram: SystemDiagram, node_id: str) -> str:
    node = _node_of(diagram, node_id)
    return node.label if node else node_id
