"""
Seed script: creates two tenants, users, projects, and peer validations.

Run: docker compose -f docker-compose.dev.yml exec backend python -m app.utils.seed

Demo credentials (all use password "password123"):
  Alpha tenant: teacher@alpha.edu (teacher, professional)
  Alpha tenant: peer1@alpha.edu   (student, intermediate)
  Alpha tenant: peer2@alpha.edu   (student, intermediate)
  Alpha tenant: peer3@alpha.edu   (student, intermediate)
  Beta tenant:  innovator@beta.io (innovator, expert)
"""

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.artifact import Artifact
from app.models.plan import (
    PLAN_FREE,
    PLAN_INSTITUTION,
    PLAN_PRO,
    Plan,
    Subscription,
)
from app.models.project import Project
from app.models.tenant import Tenant
from app.models.user import User
from app.models.validation import PeerValidation

SEED_PASSWORD = "password123"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(Tenant).limit(1))
        if existing.scalar_one_or_none() is not None:
            print("Database already seeded. Skipping.")
            return

        # ─── Tenant A: Alpha Academy ─────────────────────
        tenant_a = Tenant(name="Alpha Academy", slug="alpha", tier="institution")
        db.add(tenant_a)
        await db.flush()

        alice = User(
            tenant_id=tenant_a.id,
            email="teacher@alpha.edu",
            full_name="Alice Teacher",
            hashed_password=hash_password(SEED_PASSWORD),
            role="teacher",
            skill_tier="professional",
        )
        db.add(alice)
        await db.flush()

        peers = []
        for i, name in enumerate(["Peer One", "Peer Two", "Peer Three"], start=1):
            peer = User(
                tenant_id=tenant_a.id,
                email=f"peer{i}@alpha.edu",
                full_name=name,
                hashed_password=hash_password(SEED_PASSWORD),
                role="student",
                skill_tier="intermediate",
            )
            db.add(peer)
            peers.append(peer)
        await db.flush()

        project_a = Project(
            tenant_id=tenant_a.id,
            owner_id=alice.id,
            name="Alpha Robotics Club",
            slug="alpha-robotics",
            description="Autonomous drone project for state competition",
            current_phase="idea",
        )
        db.add(project_a)
        await db.flush()

        # The Lean Canvas lives in an Artifact, not on the Project row.
        db.add(Artifact(
            tenant_id=tenant_a.id,
            project_id=project_a.id,
            phase="idea",
            kind="lean_canvas",
            data={
                "problem": (
                    "High school students in rural districts have no access "
                    "to hands-on robotics experience because their schools "
                    "can't afford lab equipment."
                ),
                "solution": (
                    "An after-school drone building program using open-source "
                    "hardware kits costing under $150 per student."
                ),
                "unique_value": (
                    "Curriculum is designed by students who built drones "
                    "themselves, not textbook authors."
                ),
                "unfair_advantage": (
                    "Partnership with the state community college gives us "
                    "free access to their fabrication lab on weekends."
                ),
            },
            version=1,
            is_current=True,
        ))
        await db.flush()

        # Two peer validations (one short of the 3-required gate)
        db.add(PeerValidation(
            tenant_id=tenant_a.id,
            project_id=project_a.id,
            validator_id=peers[0].id,
            comment="The rural access angle is specific. Worth pursuing.",
            phase="idea",
        ))
        db.add(PeerValidation(
            tenant_id=tenant_a.id,
            project_id=project_a.id,
            validator_id=peers[1].id,
            comment="Love the student-designed curriculum angle.",
            phase="idea",
        ))

        # ─── Tenant B: Beta Institute ────────────────────
        tenant_b = Tenant(name="Beta Institute", slug="beta", tier="free")
        db.add(tenant_b)
        await db.flush()

        bob = User(
            tenant_id=tenant_b.id,
            email="innovator@beta.io",
            full_name="Bob Innovator",
            hashed_password=hash_password(SEED_PASSWORD),
            role="innovator",
            skill_tier="expert",
        )
        db.add(bob)
        await db.flush()

        project_b = Project(
            tenant_id=tenant_b.id,
            owner_id=bob.id,
            name="Beta Climate Dashboard",
            slug="beta-climate",
            description="Real-time climate data visualization for schools",
            current_phase="blueprint",
        )
        db.add(project_b)
        await db.flush()

        # A starter system diagram so the Blueprint phase has something to show.
        db.add(Artifact(
            tenant_id=tenant_b.id,
            project_id=project_b.id,
            phase="blueprint",
            kind="system_diagram",
            data={
                "nodes": [
                    {
                        "id": "n-frontend",
                        "label": "Dashboard",
                        "kind": "frontend",
                        "description": "Climate dashboard for schools.",
                        "tech_stack": ["Next.js"],
                        "position": {"x": 100, "y": 100},
                    },
                    {
                        "id": "n-backend",
                        "label": "API",
                        "kind": "backend",
                        "description": "Serves climate data.",
                        "tech_stack": ["FastAPI"],
                        "position": {"x": 100, "y": 260},
                    },
                    {
                        "id": "n-db",
                        "label": "Climate DB",
                        "kind": "database",
                        "description": "Historical climate readings.",
                        "tech_stack": ["PostgreSQL"],
                        "position": {"x": 100, "y": 420},
                    },
                ],
                "edges": [
                    {
                        "id": "e-1",
                        "source": "n-frontend",
                        "target": "n-backend",
                        "label": None,
                        "kind": "api_call",
                        "method": "GET",
                        "path": "/api/climate",
                        "authenticated": True,
                        "rate_limited": False,
                    },
                    {
                        "id": "e-2",
                        "source": "n-backend",
                        "target": "n-db",
                        "label": None,
                        "kind": "data_flow",
                        "method": None,
                        "path": None,
                        "authenticated": True,
                        "rate_limited": False,
                    },
                ],
            },
            version=1,
            is_current=True,
        ))


        # ─── Plans ───────────────────────────────────────
        plans = [
            Plan(
                slug=PLAN_FREE,
                name="Free",
                description="For individual students exploring SOJIP.",
                price_cents=0,
                billing_interval="month",
                limits={
                    "projects": 1,
                    "ai_calls_per_day": 20,
                    "deployments": 1,
                    "games": True,
                    "teacher_notes": False,
                    "peer_validations": 3,
                },
                sort_order=10,
            ),
            Plan(
                slug=PLAN_PRO,
                name="Pro",
                description="For serious makers who ship every week.",
                price_cents=1900,
                billing_interval="month",
                limits={
                    "projects": 10,
                    "ai_calls_per_day": 200,
                    "deployments": 5,
                    "games": True,
                    "teacher_notes": True,
                    "peer_validations": 3,
                },
                sort_order=20,
            ),
            Plan(
                slug=PLAN_INSTITUTION,
                name="Institution",
                description="For schools and companies running cohorts.",
                price_cents=9900,
                billing_interval="month",
                limits={
                    "projects": None,       # unlimited
                    "ai_calls_per_day": 2000,
                    "deployments": None,    # unlimited
                    "games": True,
                    "teacher_notes": True,
                    "peer_validations": 3,
                },
                sort_order=30,
            ),
        ]
        db.add_all(plans)
        await db.flush()

        plans_by_slug = {p.slug: p for p in plans}

        # ─── Subscriptions ───────────────────────────────
        # Alpha Academy gets the best plan, free — this is the
        # "first 20 schools" perk. Beta Institute stays on Free.
        db.add(Subscription(
            tenant_id=tenant_a.id,
            plan_id=plans_by_slug[PLAN_INSTITUTION].id,
            status="active",
            note="Founding institution — Institution plan free forever.",
        ))
        db.add(Subscription(
            tenant_id=tenant_b.id,
            plan_id=plans_by_slug[PLAN_FREE].id,
            status="active",
        ))

        await db.commit()
        print("✓ Seeded 2 tenants, 4 users, 2 projects, 2 peer validations, 3 plans, 2 subscriptions")
        print(f"  Alpha teacher: teacher@alpha.edu / {SEED_PASSWORD}")
        print(f"  Alpha peers:   peer1@alpha.edu, peer2@alpha.edu, peer3@alpha.edu / {SEED_PASSWORD}")
        print(f"  Beta creator:  innovator@beta.io / {SEED_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
