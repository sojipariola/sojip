"""
Integration tests for the teacher notes feature.

Teacher notes are per-tenant, per-phase teaching material. Only
teachers and admins can write them. Students see the published note
for their current phase.
"""
import pytest

pytestmark = pytest.mark.integration


# ─── Helpers ─────────────────────────────────────────────

async def _login(client, email: str, tenant_slug: str = "alpha-test") -> str:
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": tenant_slug,
            "email": email,
            "password": "password123",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


NOTE_BODY = (
    "Start with the person, not the problem. A specific person with a "
    "specific frustration beats a category every time.\n\n"
    "Try this: name three real people who would use your idea. If you "
    "can't, the problem isn't narrow enough yet."
)


# ─── Tests ───────────────────────────────────────────────

async def test_teacher_can_create_published_note(auth_client, alpha_tenant):
    """A teacher creates a published note for the Idea phase."""
    resp = await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "idea",
            "title": "How to write a strong Problem statement",
            "body": NOTE_BODY,
            "links": [
                {
                    "label": "The Mom Test (book)",
                    "url": "https://www.momtestbook.com/",
                    "kind": "docs",
                }
            ],
            "is_published": True,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["phase"] == "idea"
    assert body["is_published"] is True
    assert body["title"] == "How to write a strong Problem statement"
    assert len(body["links"]) == 1
    assert body["links"][0]["kind"] == "docs"


async def test_student_cannot_create_note(client, alpha_tenant):
    """A student cannot create a teacher note — 403."""
    token = await _login(client, "bob@test.edu")
    resp = await client.post(
        "/api/v1/teacher-notes",
        headers=_auth(token),
        json={
            "phase": "idea",
            "title": "I shouldn't be able to do this",
            "body": "But I'm trying anyway to make sure the API is safe.",
            "links": [],
            "is_published": True,
        },
    )
    assert resp.status_code == 403
    assert "teacher" in resp.text.lower()


async def test_only_one_published_note_per_phase(auth_client, alpha_tenant):
    """
    Creating a second published note for the same phase is rejected
    with 409. Drafts are allowed to coexist.
    """
    # First published note
    first = await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "plan",
            "title": "First published note",
            "body": NOTE_BODY,
            "links": [],
            "is_published": True,
        },
    )
    assert first.status_code == 201, first.text

    # Second published note for same phase — should fail
    second = await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "plan",
            "title": "Second published note",
            "body": NOTE_BODY,
            "links": [],
            "is_published": True,
        },
    )
    assert second.status_code == 409
    assert "already exists" in second.text.lower()


async def test_drafts_can_coexist_with_published(auth_client, alpha_tenant):
    """A draft can exist alongside a published note for the same phase."""
    published = await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "blueprint",
            "title": "Published architecture guide",
            "body": NOTE_BODY,
            "links": [],
            "is_published": True,
        },
    )
    assert published.status_code == 201, published.text

    draft = await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "blueprint",
            "title": "Draft — next semester's version",
            "body": NOTE_BODY,
            "links": [],
            "is_published": False,
        },
    )
    assert draft.status_code == 201, draft.text
    assert draft.json()["is_published"] is False


async def test_student_sees_published_not_draft(
    auth_client, client, alpha_tenant
):
    """
    When both a published and a draft exist for a phase, a student
    sees only the published one.
    """
    # Teacher creates both
    await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "idea",
            "title": "The published guide",
            "body": NOTE_BODY,
            "links": [],
            "is_published": True,
        },
    )
    await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "idea",
            "title": "The secret draft",
            "body": NOTE_BODY,
            "links": [],
            "is_published": False,
        },
    )

    # Student fetches the note for the phase
    token = await _login(client, "bob@test.edu")
    resp = await client.get(
        "/api/v1/teacher-notes/phase/idea",
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "The published guide"
    assert body["is_published"] is True


async def test_cross_tenant_notes_are_isolated(
    auth_client, client, db_session, alpha_tenant
):
    """
    A teacher in Alpha writes a note. A user in Beta (different tenant)
    must not see it when querying their own tenant's notes.
    """
    # Alpha teacher creates a note
    await auth_client.post(
        "/api/v1/teacher-notes",
        json={
            "phase": "idea",
            "title": "Alpha-only note",
            "body": NOTE_BODY,
            "links": [],
            "is_published": True,
        },
    )

    # Create Beta tenant + a teacher
    from app.core.security import hash_password
    from app.models.tenant import Tenant
    from app.models.user import User

    beta = Tenant(name="Beta Notes Test", slug="beta-notes-test", tier="free")
    db_session.add(beta)
    await db_session.flush()

    beta_teacher = User(
        tenant_id=beta.id,
        email="teach@beta-notes.io",
        full_name="Beta Teacher",
        hashed_password=hash_password("password123"),
        role="teacher",
        skill_tier="professional",
    )
    db_session.add(beta_teacher)
    await db_session.flush()

    beta_token = await _login(
        client, "teach@beta-notes.io", tenant_slug="beta-notes-test"
    )

    # Beta teacher lists all notes — should see zero
    resp = await client.get(
        "/api/v1/teacher-notes",
        headers=_auth(beta_token),
    )
    assert resp.status_code == 200, resp.text
    notes = resp.json()
    assert notes == [], (
        f"Tenant isolation broken: Beta teacher saw {len(notes)} note(s) "
        f"belonging to Alpha. Titles: {[n['title'] for n in notes]}"
    )

    # Beta teacher asks for the idea-phase note — 404 (not theirs)
    resp = await client.get(
        "/api/v1/teacher-notes/phase/idea",
        headers=_auth(beta_token),
    )
    assert resp.status_code == 404
