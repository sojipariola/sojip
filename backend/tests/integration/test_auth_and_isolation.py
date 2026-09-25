"""
Integration tests — auth flow and tenant isolation.

These are the README's "non-negotiable" guarantees. If any of them
fail, the multi-tenant contract is broken and nothing else matters.

Run with: pytest tests/integration/ -v
"""
import pytest

pytestmark = pytest.mark.integration


# ─────────────────────────────────────────────────────────
# 1. Login flow
# ─────────────────────────────────────────────────────────

async def test_login_returns_jwt_with_tenant_claim(client, alpha_tenant):
    """
    Login with valid credentials returns a JWT that carries the
    tenant_id ('tid') claim. Every downstream request relies on
    this claim for tenant filtering.
    """
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": "alpha-test",
            "email": "alice@test.edu",
            "password": "password123",
        },
    )
    assert resp.status_code == 200, resp.text

    body = resp.json()
    assert "access_token" in body
    assert body.get("token_type", "bearer").lower() == "bearer"

    # Decode without verification to inspect claims (test-only).
    import base64
    import json as _json

    payload_b64 = body["access_token"].split(".")[1]
    # JWT base64url needs padding
    padding = "=" * (-len(payload_b64) % 4)
    claims = _json.loads(base64.urlsafe_b64decode(payload_b64 + padding))

    assert "tid" in claims, f"JWT missing 'tid' claim: {claims}"
    assert claims["tid"] == str(alpha_tenant["tenant"].id)


async def test_login_with_wrong_password_fails(client, alpha_tenant):
    """Wrong password → 401, no token leaked."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": "alpha-test",
            "email": "alice@test.edu",
            "password": "wrong-password",
        },
    )
    assert resp.status_code == 401
    assert "access_token" not in resp.text


async def test_login_with_unknown_tenant_fails(client):
    """Unknown tenant slug → 401/404, not a stack trace."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": "does-not-exist",
            "email": "nobody@nowhere.io",
            "password": "whatever",
        },
    )
    assert resp.status_code in (401, 404)


# ─────────────────────────────────────────────────────────
# 2. Auth enforcement
# ─────────────────────────────────────────────────────────

async def test_projects_endpoint_requires_auth(client):
    """No bearer token → 401. This is the gate we curl-tested manually."""
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 401


async def test_projects_endpoint_rejects_invalid_token(client):
    """Garbage token → 401, not 500."""
    resp = await client.get(
        "/api/v1/projects",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401


async def test_authenticated_user_can_list_projects(auth_client):
    """With a valid bearer token, /projects returns 200 + a list."""
    resp = await auth_client.get("/api/v1/projects")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─────────────────────────────────────────────────────────
# 3. Tenant isolation — THE non-negotiable
# ─────────────────────────────────────────────────────────

async def test_user_cannot_see_other_tenants_project(
    auth_client, db_session, alpha_tenant
):
    """
    Create a project in Alpha. Then create a *different* tenant Beta
    with its own user. Log in as Beta. Confirm Beta cannot fetch
    Alpha's project by slug.
    """
    from app.core.security import hash_password
    from app.models.project import Project
    from app.models.tenant import Tenant
    from app.models.user import User

    # Create the Alpha project using the fixture's tenant + a user.
    alpha_project = Project(
        tenant_id=alpha_tenant["tenant"].id,
        owner_id=alpha_tenant["alice"].id,
        name="Alpha Secret Project",
        slug="alpha-secret",
        current_phase="idea",
    )
    db_session.add(alpha_project)
    await db_session.flush()

    # Create Beta tenant with its own user.
    beta = Tenant(name="Beta Test", slug="beta-test", tier="free")
    db_session.add(beta)
    await db_session.flush()

    beta_user = User(
        tenant_id=beta.id,
        email="eve@beta.io",
        full_name="Eve Attacker",
        hashed_password=hash_password("password123"),
        role="student",
        skill_tier="intermediate",
    )
    db_session.add(beta_user)
    await db_session.flush()

    # Log in as the Beta user.
    login = await auth_client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": "beta-test",
            "email": "eve@beta.io",
            "password": "password123",
        },
    )
    assert login.status_code == 200, login.text
    beta_token = login.json()["access_token"]

    # Try to fetch Alpha's project by its ID (the endpoint takes a UUID).
    resp = await auth_client.get(
        f"/api/v1/projects/{alpha_project.id}",
        headers={"Authorization": f"Bearer {beta_token}"},
    )
    # Should be 404 (not found in your tenant) or 403 (forbidden).
    # NOT 200. NOT 500.
    assert resp.status_code in (403, 404), (
        f"Tenant isolation broken: Beta user saw Alpha project. "
        f"Status was {resp.status_code}. Body: {resp.text[:300]}"
    )
