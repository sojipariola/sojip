"""
Test fixtures.

Design:
  - One session-scoped event loop.
  - Migrations run once per session against the test database.
  - Each test runs inside a transaction that is rolled back at teardown.
  - The AI service is patched so no Ollama/vLLM calls happen.
  - `auth_client` provides an authenticated httpx AsyncClient.
"""
import asyncio
import os
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text

# Ensure the app uses the test database BEFORE any app import
os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://sojip_user:sojip_pass@postgres:5432/sojip_test"
)
os.environ["ENVIRONMENT"] = "test"

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


# ─── Event loop ──────────────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    """Single loop for the whole session so async fixtures can share state."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ─── Alembic migrations ──────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def _apply_migrations():
    """
    Run `alembic upgrade head` against the test DB once per session.

    We shell out rather than importing alembic's internals — the CLI is
    the documented interface and handles env.py properly.
    """
    import subprocess
    import sys

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd="/app",
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Alembic upgrade failed:\nSTDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}"
        )

    # Seed the three standard plans (idempotent — checks slug first).
    import asyncio
    from sqlalchemy import select
    from app.models.plan import PLAN_FREE, PLAN_PRO, PLAN_INSTITUTION, Plan

    async def _seed_plans():
        async with AsyncSessionLocal() as s:
            for slug, name, cents, limits in [
                (PLAN_FREE, "Free", 0,
                 {"projects": 1, "ai_calls_per_day": 20, "deployments": 1,
                  "games": True, "teacher_notes": False, "peer_validations": 3}),
                (PLAN_PRO, "Pro", 1900,
                 {"projects": 10, "ai_calls_per_day": 200, "deployments": 5,
                  "games": True, "teacher_notes": True, "peer_validations": 3}),
                (PLAN_INSTITUTION, "Institution", 9900,
                 {"projects": None, "ai_calls_per_day": 2000, "deployments": None,
                  "games": True, "teacher_notes": True, "peer_validations": 3}),
            ]:
                existing = (await s.execute(
                    select(Plan).where(Plan.slug == slug)
                )).scalar_one_or_none()
                if existing is None:
                    s.add(Plan(slug=slug, name=name, price_cents=cents,
                               limits=limits, is_active=True))
            await s.commit()

    asyncio.get_event_loop().run_until_complete(_seed_plans())
    yield


# ─── Per-test transaction rollback ───────────────────────
@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield a session bound to a transaction that will be rolled back.

    Every test starts from a clean DB (whatever the migrations left
    behind, usually nothing) and leaves no trace.
    """
    async with engine.connect() as connection:
        trans = await connection.begin()
        Session = async_sessionmaker(
            bind=connection, expire_on_commit=False, class_=AsyncSession
        )
        session = Session()
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


# ─── Override get_db / get_tenant_db ─────────────────────
@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    An httpx AsyncClient pointed at the FastAPI app.

    Overrides the app's `get_db` to use our rolled-back session so
    changes made during a test vanish at teardown.
    """
    from app.core.database import get_db
    from app.api.v1.dependencies.tenant import get_tenant_db

    async def _override_get_db():
        yield db_session

    async def _override_get_tenant_db():
        # For the unit/integration tests we skip the SET LOCAL tenant
        # context; the tenant filter in repository code still applies.
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_tenant_db] = _override_get_tenant_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ─── Mock AI service ─────────────────────────────────────
@pytest.fixture(autouse=True)
def mock_ai():
    """
    Patch `get_ai_service()` so no real AI calls happen in tests.

    Any test that wants a specific AI response can override this by
    using `with patch.object(ai, 'chat_json', ...)` inside the test.
    """
    mock_service = AsyncMock()

    # Default responses that satisfy every gate.
    mock_service.chat = AsyncMock(return_value="Looks good.")
    mock_service.chat_json = AsyncMock(return_value={
        "passed": True,
        "reasoning": "Test default: approved.",
        "question": None,
    })
    mock_service.critique_field = AsyncMock(return_value={
        "severity": "info",
        "body": "Test default critique.",
    })
    mock_service.model = "test-model"

    with patch("app.services.ai_service.get_ai_service", return_value=mock_service):
        # Also patch where the module-level singleton lives, in case any
        # endpoint imported it directly.
        with patch("app.services.ai_service._ai_service", mock_service):
            yield mock_service


# ─── Seeded test data ────────────────────────────────────
@pytest_asyncio.fixture
async def alpha_tenant(db_session: AsyncSession):
    """Insert Alpha tenant + 4 users. Returns a small object."""
    from app.core.security import hash_password
    from app.models.tenant import Tenant
    from app.models.user import User

    tenant = Tenant(name="Alpha Test", slug="alpha-test", tier="institution")
    db_session.add(tenant)
    await db_session.flush()

    pw = hash_password("password123")
    alice = User(
        tenant_id=tenant.id,
        email="alice@test.edu",
        full_name="Alice Tester",
        hashed_password=pw,
        role="teacher",
        skill_tier="professional",
    )
    bob = User(
        tenant_id=tenant.id,
        email="bob@test.edu",
        full_name="Bob Tester",
        hashed_password=pw,
        role="student",
        skill_tier="intermediate",
    )
    carol = User(
        tenant_id=tenant.id,
        email="carol@test.edu",
        full_name="Carol Tester",
        hashed_password=pw,
        role="student",
        skill_tier="intermediate",
    )
    dan = User(
        tenant_id=tenant.id,
        email="dan@test.edu",
        full_name="Dan Tester",
        hashed_password=pw,
        role="student",
        skill_tier="intermediate",
    )
    db_session.add_all([alice, bob, carol, dan])
    await db_session.flush()

    # Free subscription so the tenant isn't stuck without a plan.
    from app.models.plan import PLAN_FREE, Plan, Subscription
    from sqlalchemy import select

    plan = (await db_session.execute(
        select(Plan).where(Plan.slug == PLAN_FREE)
    )).scalar_one_or_none()
    if plan is None:
        plan = Plan(
            slug=PLAN_FREE,
            name="Free",
            price_cents=0,
            limits={"projects": 100, "games": True, "teacher_notes": True},
            is_active=True,
        )
        db_session.add(plan)
        await db_session.flush()

    db_session.add(Subscription(
        tenant_id=tenant.id, plan_id=plan.id, status="active",
    ))
    await db_session.flush()

    return {"tenant": tenant, "alice": alice, "bob": bob, "carol": carol, "dan": dan}


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, alpha_tenant):
    """An httpx client already authenticated as Alice (teacher)."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": "alpha-test",
            "email": "alice@test.edu",
            "password": "password123",
        },
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    yield client


@pytest_asyncio.fixture
async def student_client(client: AsyncClient, alpha_tenant):
    """An httpx client already authenticated as Bob (student)."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": "alpha-test",
            "email": "bob@test.edu",
            "password": "password123",
        },
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    yield client
