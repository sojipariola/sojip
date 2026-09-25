"""
Integration tests for the Idea phase gate.

The Idea → Plan gate is the first and most important gate in the
platform. These tests confirm that:

  1. An empty canvas cannot pass the gate.
  2. A complete canvas without peer validations cannot pass.
  3. A complete canvas WITH 3 peer validations passes.

The AI is mocked by conftest.py to always return "passed: true", so
these tests exercise the pure gate logic — not the model.
"""
import pytest

pytestmark = pytest.mark.integration


# ─── Fixtures ────────────────────────────────────────────

FULL_CANVAS = {
    "problem": "High school students in rural districts have no access to hands-on robotics experience.",
    "solution": "An after-school drone program using open-source kits under $150 per student.",
    "unique_value": "Curriculum is designed by students who built drones themselves, not textbook authors.",
    "unfair_advantage": "Partnership with the state community college gives us free weekend lab access.",
}


async def _create_project(auth_client, name: str = "Gate Test Project") -> dict:
    """Create a project as the authenticated teacher."""
    resp = await auth_client.post(
        "/api/v1/projects",
        json={"name": name, "description": "Test project"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _fill_canvas(auth_client, project_id: str):
    """Patch the lean canvas with our canonical complete canvas."""
    resp = await auth_client.patch(
        f"/api/v1/projects/{project_id}/artifacts/lean_canvas",
        json={"data": FULL_CANVAS},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _add_validations(client, project_id: str, validator_emails: list[str]):
    """
    Log in as each validator, POST a peer validation on the project.
    """
    for email in validator_emails:
        login = await client.post(
            "/api/v1/auth/login",
            json={
                "tenant_slug": "alpha-test",
                "email": email,
                "password": "password123",
            },
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]

        resp = await client.post(
            f"/api/v1/projects/{project_id}/validations",
            json={"comment": f"Looks good — {email}"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, resp.text


# ─── Tests ───────────────────────────────────────────────

async def test_idea_gate_blocks_when_canvas_empty(auth_client):
    """
    A project with an empty canvas should fail the gate, and the
    'missing' list should tell the user what to fix.
    """
    project = await _create_project(auth_client)

    resp = await auth_client.post(
        f"/api/v1/projects/{project['id']}/gates/idea/validate"
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["gate"] == "idea"
    assert body["passed"] is False
    # Should mention all four canvas fields are missing
    missing_text = " ".join(body["missing"]).lower()
    assert "lean canvas" in missing_text
    assert "problem" in missing_text
    assert "solution" in missing_text
    assert "unique value" in missing_text
    assert "unfair advantage" in missing_text
    # And the peer validation requirement
    assert "peer validation" in missing_text


async def test_idea_gate_blocks_without_peer_validations(
    auth_client, client, alpha_tenant
):
    """
    A complete canvas with 0 peer validations still fails the gate.
    The only missing item should be the peer validations.
    """
    project = await _create_project(auth_client, "Partial Gate Project")
    await _fill_canvas(auth_client, project["id"])

    resp = await auth_client.post(
        f"/api/v1/projects/{project['id']}/gates/idea/validate"
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["passed"] is False
    missing_text = " ".join(body["missing"]).lower()
    # Canvas is complete — should NOT be flagged
    assert "lean canvas" not in missing_text
    # Peer validations ARE missing
    assert "peer validation" in missing_text
    assert "3 more" in missing_text  # 3 required, 0 present


async def test_idea_gate_passes_with_full_canvas_and_validations(
    auth_client, client, alpha_tenant
):
    """
    Complete canvas + 3 peer validations → gate passes.
    AI is mocked to approve in conftest.py.
    """
    project = await _create_project(auth_client, "Passing Gate Project")
    await _fill_canvas(auth_client, project["id"])

    await _add_validations(
        client,
        project["id"],
        ["bob@test.edu", "carol@test.edu", "dan@test.edu"],
    )

    resp = await auth_client.post(
        f"/api/v1/projects/{project['id']}/gates/idea/validate"
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["passed"] is True, body
    assert body["missing"] == []
    assert "ready to advance" in body["reason"].lower()
