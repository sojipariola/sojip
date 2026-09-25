# SOJIP

[![CI](https://github.com/sojipariola/sojip/actions/workflows/ci.yml/badge.svg)](https://github.com/sojipariola/sojip/actions/workflows/ci.yml)

**S**eed · **O**ffspring · **J**ourney · **I**nnovation · **P**latform
...

A phase-gated, multi-tenant educational platform that guides students,
teachers, and innovators from abstract ideas to deployable code.

A phase-gated, multi-tenant educational platform that guides students, teachers, and innovators from abstract ideas to deployable code. SOJIP combines structured pedagogy with world-class AI, block-based editors, and gamified learning across six developmental phases.

---

## Table of Contents

1. [Vision](#vision)
2. [Core Concepts](#core-concepts)
3. [Architecture Overview](#architecture-overview)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [MVP Scope](#mvp-scope)
7. [Scaling Strategy](#scaling-strategy)
8. [AI Serving Layer](#ai-serving-layer)
9. [Multi-Tenancy Model](#multi-tenancy-model)
10. [Getting Started](#getting-started)
11. [Environment Variables](#environment-variables)
12. [Development Workflow](#development-workflow)
13. [Deployment Path](#deployment-path)
14. [Contributing](#contributing)

---

## Vision

Brilliant ideas die in notebooks, Slack messages, or disjointed GitHub repos because users lack a structured, guided pathway that translates abstract thought into deployable code.

**SOJIP solves this** with a role-based, phase-gated workspace that provides:

- **Templates** for each phase (Idea, Plan, Blueprint, Scaffold, Dev, Maintenance).
- **AI Mentors** that ask critical questions at each gate.
- **Collaboration Zones** where teachers review student blueprints and innovators find collaborators.
- **Block-based editors** that let beginners build without writing code.
- **Games** for every skill tier (Beginner → Veteran) to reinforce learning.

**Tagline:** *From idea to code, guided at every step.*

---

## Core Concepts

### The Six Phases

| Phase | Purpose | Gate Requirement |
|---|---|---|
| **Idea** | Define the problem and solution | 3 peer validations |
| **Plan** | Timeline, milestones, critical path | Teacher/mentor approval |
| **Blueprint** | System design, API schema, tech stack | AI security scan passed |
| **Scaffold** | Generate repo, CI/CD, boilerplate | Blueprint locked |
| **Dev** | Write code in sandboxed IDE | Preview deployment live |
| **Maintenance** | Changelog, retrospective, iteration | 100-word retrospective written |

### User Roles

| Role | Primary Goal | Superpower |
|---|---|---|
| **Student** | Learn the lifecycle | Fork instructor template projects |
| **Teacher** | Grade & guide | Insert checkpoint gates |
| **Innovator** | Build prototypes fast | AI scaffolding + cloud sandboxes |
| **Admin** | Maintain tenant | User analytics, resource monitoring |

### Skill Tiers

Beginner → Intermediate → Advanced → Expert → Professional → Veteran

Each tier unlocks different UI complexity (block-based vs. code-first), game difficulty, and AI assistance depth.

---

## Architecture Overview

SOJIP is a **modular monolith** with a decoupled frontend/backend, designed to scale into microfrontends and microservices as adoption grows.

┌─────────────────────────────────────────────────────────────┐
│ Next.js Frontend (App Router) │
│ ┌────────────┬────────────┬────────────┬────────────┐ │
│ │ Phase │ Block │ Game │ Admin │ │
│ │ Workspace │ Editor │ Framework │ Console │ │
│ └────────────┴────────────┴────────────┴────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
│ REST + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│ FastAPI Backend │
│ ┌────────────┬────────────┬────────────┬────────────┐ │
│ │ Tenant │ Phase │ Scaffold │ AI │ │
│ │ Context │ Engine │ Generator │ Router │ │
│ └────────────┴────────────┴────────────┴────────────┘ │
└──────┬────────────────────┬────────────────────┬────────────┘
│ │ │
┌──────▼──────┐ ┌────────▼────────┐ ┌──────▼──────┐
│ PostgreSQL │ │ Redis (Cache │ │ Ollama / │
│ + JSONB │ │ + Celery) │ │ vLLM │
│ + pgvector │ │ │ │ (AI) │
└─────────────┘ └─────────────────┘ └─────────────┘

```text

**Design principles:**
- **Modular monolith first** — extract to microfrontends/microservices only when traffic justifies it.
- **One database, one transaction model** — PostgreSQL with JSONB for flexible schema, pgvector for embeddings.
- **AI provider abstraction** — OpenAI-compatible interface, swap Ollama → vLLM via config.
- **Fail-closed tenant isolation** — every request must carry a valid tenant; no tenant, no data.

---

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router) | SSR for landing pages, dashboard routing, largest React ecosystem |
| **UI** | Tailwind CSS + Shadcn/ui | Customizable primitives, Terracotta design system |
| **Block Editor** | `@genetik/editor-react` (evaluate) / `craft.js` (fallback) | Drag-and-drop blocks matching phase content |
| **State** | TanStack Query + Zustand | Server state + client state separation |
| **Backend** | FastAPI (Python 3.11+) | AI ecosystem depth, async I/O, automatic OpenAPI |
| **ORM** | SQLAlchemy 2.0 + Alembic | Type-safe queries, migrations |
| **Database** | PostgreSQL 15+ | JSONB, RLS, pgvector, one transaction model |
| **Cache/Queue** | Redis + Celery | Background scaffolds, AI jobs, rate limiting |
| **AI Serving** | Ollama (start) → vLLM (scale) | OpenAI-compatible, self-hosted, migration-friendly |
| **Auth** | Supabase Auth / Auth0 | Social login, JWT with tenant claims |
| **Scaffolding** | Docker + GitHub API | Boilerplate generation per blueprint |
| **CI/CD** | GitHub Actions | Lint, test, deploy per service |
| **IaC** | Terraform + Kubernetes | Multi-tenant scaling in production |

---

## Project Structure
```text
sojip-platform/
├── .github/
│ └── workflows/
│ ├── ci.yml # Test + lint on PR
│ ├── cd-frontend.yml # Deploy Next.js
│ ├── cd-backend.yml # Deploy FastAPI
│ └── security-scan.yml # Weekly dependency scan
│
├── frontend/ # Next.js 14 (App Router)
│ ├── public/
│ │ ├── fonts/ # Inter, JetBrains Mono
│ │ ├── icons/
│ │ └── illustrations/
│ ├── src/
│ │ ├── app/
│ │ │ ├── (auth)/ # Login, register
│ │ │ ├── (dashboard)/ # Authenticated app
│ │ │ │ ├── dashboard/
│ │ │ │ ├── projects/
│ │ │ │ │ └── [projectSlug]/
│ │ │ │ │ ├── idea/
│ │ │ │ │ ├── plan/
│ │ │ │ │ ├── blueprint/
│ │ │ │ │ ├── scaffold/
│ │ │ │ │ ├── development/
│ │ │ │ │ ├── maintenance/
│ │ │ │ │ └── settings/
│ │ │ │ └── new/ # Project wizard
│ │ │ ├── (marketing)/ # Landing, pricing, features
│ │ │ └── api/ # Next.js BFF routes
│ │ ├── components/
│ │ │ ├── ui/ # Shadcn primitives
│ │ │ ├── shared/ # SOJStepper, PhaseGate, etc.
│ │ │ ├── forms/
│ │ │ ├── modals/
│ │ │ └── editor/ # Block editor wrappers
│ │ ├── lib/
│ │ │ ├── api-client.ts
│ │ │ ├── auth.ts
│ │ │ ├── validators/ # Zod schemas
│ │ │ └── utils/
│ │ ├── hooks/
│ │ ├── store/ # Zustand
│ │ └── types/
│ ├── tailwind.config.ts # Terracotta theme
│ ├── next.config.js
│ ├── package.json
│ └── Dockerfile
│
├── backend/ # FastAPI
│ ├── app/
│ │ ├── main.py
│ │ ├── config.py # Pydantic settings
│ │ ├── api/
│ │ │ ├── v1/
│ │ │ │ ├── endpoints/
│ │ │ │ │ ├── auth.py
│ │ │ │ │ ├── tenants.py
│ │ │ │ │ ├── users.py
│ │ │ │ │ ├── projects.py
│ │ │ │ │ ├── ideas.py
│ │ │ │ │ ├── plans.py
│ │ │ │ │ ├── blueprints.py
│ │ │ │ │ ├── scaffolds.py
│ │ │ │ │ ├── development.py
│ │ │ │ │ ├── maintenance.py
│ │ │ │ │ ├── games.py
│ │ │ │ │ └── ai.py
│ │ │ │ └── dependencies/
│ │ │ │ ├── auth.py # get_current_user
│ │ │ │ ├── tenant.py # get_tenant_context (fail-closed)
│ │ │ │ └── ai.py # get_ai_provider
│ │ │ └── websockets/
│ │ │ └── collaboration.py
│ │ ├── core/
│ │ │ ├── phase_engine.py # Phase gate logic
│ │ │ ├── scaffold_generator.py
│ │ │ ├── diagram_parser.py
│ │ │ └── security_scanner.py
│ │ ├── models/ # SQLAlchemy ORM
│ │ ├── schemas/ # Pydantic
│ │ ├── services/
│ │ │ ├── ai_router.py # Provider abstraction
│ │ │ ├── github_service.py
│ │ │ ├── docker_service.py
│ │ │ └── email_service.py
│ │ ├── workers/ # Celery tasks
│ │ └── utils/
│ ├── alembic/ # Migrations
│ ├── tests/
│ ├── requirements.txt
│ ├── pyproject.toml
│ └── Dockerfile
│
├── infrastructure/
│ ├── terraform/
│ │ ├── main.tf
│ │ ├── variables.tf
│ │ ├── modules/
│ │ │ ├── networking/
│ │ │ ├── database/
│ │ │ └── compute/
│ │ └── environments/
│ │ ├── dev.tfvars
│ │ ├── staging.tfvars
│ │ └── production.tfvars
│ └── kubernetes/
│ ├── namespace.yaml
│ ├── frontend-deployment.yaml
│ ├── backend-deployment.yaml
│ ├── postgres-statefulset.yaml
│ ├── redis-deployment.yaml
│ ├── ollama-deployment.yaml
│ └── ingress.yaml
│
├── docs/
│ ├── architecture/
│ │ ├── system-design.md
│ │ ├── data-flow.md
│ │ └── security.md
│ ├── guides/
│ │ ├── getting-started.md
│ │ ├── contributing.md
│ │ └── deployment.md
│ └── user-manual/
│ ├── for-students.md
│ ├── for-teachers.md
│ └── for-innovators.md
│
├── scripts/
│ ├── seed-db.py
│ ├── backup-db.sh
│ └── generate-scaffold-templates.sh
│
├── .env.example
├── .gitignore
├── .dockerignore
├── docker-compose.yml # Full stack
├── docker-compose.dev.yml # Local dev with hot reload
├── Makefile # make dev, make migrate, make test
├── README.md # This file
└── LICENSE

text

---

## MVP Scope

**Goal:** Validate the phase-gated journey with a working Idea → Plan → Blueprint flow and one AI Mentor, in **12 weeks**.

### Sprint 1–2: Idea Workspace
- Auth (tenant-aware, JWT with `tenant_id` claim)
- Project creation wizard
- Lean Canvas block editor (Problem, Solution, UVP, Unfair Advantage)
- AI Mentor: "Who specifically has this problem?" (gate validation)
- Shareable Idea Card

### Sprint 3–4: Plan Workspace
- Reverse timeline calculator (launch date → critical path)
- Task board with drag-and-drop
- Teacher review panel + checkpoint gates
- Notifications (email + in-app)

### Sprint 5–6: Blueprint Visualizer
- React Flow canvas for system diagrams
- API schema generator (React Flow → OpenAPI)
- AI security scan on endpoints (e.g., missing auth on `/users`)
- Tech stack selector (Python, Node.js, React, R, etc.)

### Sprint 7–8: Scaffolding & First Deployment
- "Scaffold My Repo" button
- Background worker: generate boilerplate + create private GitHub repo
- Auto-configure CI/CD (`main.yml`)
- Blueprint → `docker-compose.yml` export

### Sprint 9–10: Development Sandbox
- Embedded code editor (Code-server iframe)
- Preview URL (`project-name.preview.sojip.com`)
- Changelog + severity selector before deploy

### Sprint 11–12: Collaboration & First Game
- "Ask for Help" feed
- Instructor blueprint review
- One game: **Phase Rush** (Beginner tier) — drag phase blocks into correct order, timed

### MVP Exit Criteria
- One tenant can register, invite students/teachers, run a project through all six phases
- AI Mentor validates every gate
- One scaffolded repo is created on GitHub
- One game is playable
- All tenant data isolated (verified by test)

---

## Scaling Strategy

SOJIP is designed to scale from **one classroom to thousands of institutions** without architectural rewrites.

### Scaling Dimensions

| Dimension | v1 (MVP) | v2 (Growth) | v3 (Scale) |
|---|---|---|---|
| **Tenants** | 1–10 | 10–100 | 100–10,000 |
| **Concurrent users** | <50 | 50–500 | 500–50,000 |
| **AI backend** | Ollama (single GPU) | vLLM (single node) | vLLM cluster + queue |
| **Database** | Single Postgres | Primary + read replica | Sharded by tenant hash |
| **Frontend** | Modular monolith | Module Federation (games) | Microfrontends per phase |
| **Deployment** | Docker Compose | Kubernetes (single region) | Multi-region K8s |
| **Games** | 1 (Phase Rush) | 5 (per tier) | 20+ (marketplace) |

### Scaling Triggers

- **Add read replica** when DB CPU > 60% sustained.
- **Migrate Ollama → vLLM** when median concurrent AI requests > 5.
- **Extract Game module to microfrontend** when game release cadence diverges from core.
- **Add tenant sharding** when single Postgres exceeds 500GB or 10k tenants.
- **Add second AI node** when GPU utilization > 80% at peak.

### Cost Model (Self-Hosted Start)

| Component | Spec | Estimated Monthly |
|---|---|---|
| **App server** | 8 vCPU, 32GB RAM | $80 |
| **GPU node (Ollama)** | 1× RTX 4090 (24GB) | $300 (cloud) / $1,600 (capex) |
| **PostgreSQL** | Managed, 4 vCPU, 16GB | $150 |
| **Redis** | Managed, 2GB | $30 |
| **Object storage** | 500GB (blueprints, exports) | $15 |
| **Total (cloud)** | — | **~$575/mo** |
| **Total (self-hosted)** | One-time capex | **~$2,500 + $150/mo** |

**Break-even:** At $10/student/month, 58 students cover cloud costs. At $5/student, 115 students.

---

## AI Serving Layer

### Provider Abstraction

SOJIP's AI layer uses a **single interface** with swappable providers:

```python
class AIProvider(Protocol):
    async def chat(self, request: ChatRequest) -> ChatResponse: ...
    async def stream_chat(self, request: ChatRequest) -> AsyncIterator[str]: ...
Two implementations satisfy this contract:

OllamaProvider — development, low concurrency, fast iteration

VLLMProvider — production, high concurrency, continuous batching

Both expose OpenAI-compatible /v1/chat/completions. Migration is a config change:

bash
# .env
AI_BACKEND=ollama              # or "vllm"
OLLAMA_URL=http://ollama:11434/v1
OLLAMA_MODEL=qwen3:8b
VLLM_URL=http://vllm:8000/v1
VLLM_MODEL=Qwen/Qwen3-8B-Instruct
AI_CONTEXT_LENGTH=8192         # explicit — do not rely on defaults
Model Roadmap
Phase	Model	VRAM	Use Case
MVP	Qwen3 8B (Q4)	~6GB	Conversational gate validation
Growth	Qwen3 14B (Q5)	~12GB	Code suggestions, blueprint review
Scale	Llama 3.1 70B (Q4)	~40GB	Complex reasoning, scaffold generation
Multi-Provider Routing (Future)
When SOJIP connects to external world-class AI (GPT-4, Claude, Gemini), the router selects the best provider per task:

python
TASK_ROUTING = {
    "gate_validation": "local",      # Fast, cheap, private
    "code_generation": "external",   # GPT-4 / Claude
    "security_scan": "local",        # Deterministic + local model
    "pedagogical_questions": "local",# Student data stays on-prem
}
Rule: Student data never leaves self-hosted infrastructure unless the tenant explicitly opts in.

Multi-Tenancy Model
Isolation Strategy
v1: Query-layer scoping with fail-closed tenant context.

python
# app/api/dependencies/tenant.py
async def get_tenant_context(
    user: User = Depends(get_current_user),
) -> TenantContext:
    tenant_id = user.jwt_claims.get("tid")
    if not tenant_id:
        raise HTTPException(403, "No tenant context")
    return TenantContext(tenant_id=tenant_id)
Every query filters by tenant_id. Every table has a tenant_id column, indexed.

v2: Add PostgreSQL Row-Level Security as defense-in-depth.

sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON projects
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
The application sets SET LOCAL app.tenant_id = :tid per request. RLS becomes the backstop for developer error, not the front line.

Tenant Tiers
Tier	Features	Rate Limit
Free (Classroom)	30 students, 1 teacher, 3 projects	100 AI calls/day
Institution	500 students, unlimited teachers, unlimited projects	10,000 AI calls/day
Enterprise	Unlimited, SSO, custom AI routing, SLA	Negotiated
Getting Started
Prerequisites
Docker 24+ and Docker Compose v2

Node.js 20+ (for local frontend dev outside Docker)

Python 3.11+ (for local backend dev outside Docker)

Git

Optional: NVIDIA GPU with CUDA 12+ for local AI

Quick Start
bash
# Clone
git clone https://github.com/your-org/sojip-platform.git
cd sojip-platform

# Copy environment template
cp .env.example .env
# Edit .env with your keys (GitHub token, OpenAI key if using external AI)

# Start full stack (frontend + backend + postgres + redis + ollama)
make dev

# In another terminal, run migrations
make migrate

# Seed with demo data
make seed
Open:

Frontend: http://localhost:3000

Backend API: http://localhost:8000/api/v1/health

API Docs: http://localhost:8000/docs

Ollama: http://localhost:11434

First Run (Ollama)
bash
# Pull the starting model
docker exec -it sojip-ollama ollama pull qwen3:8b

# Test
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"Hello"}]}'
Environment Variables
bash
# ─── Core ────────────────────────────────────────────
ENVIRONMENT=development              # development | staging | production
SECRET_KEY=change-me-in-production
API_BASE_URL=http://localhost:8000

# ─── Database ────────────────────────────────────────
DATABASE_URL=postgresql://sojip_user:sojip_pass@postgres:5432/sojip_db
REDIS_URL=redis://redis:6379

# ─── Auth ────────────────────────────────────────────
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# ─── AI Serving ──────────────────────────────────────
AI_BACKEND=ollama                    # ollama | vllm
OLLAMA_URL=http://ollama:11434/v1
OLLAMA_MODEL=qwen3:8b
VLLM_URL=http://vllm:8000/v1
VLLM_MODEL=Qwen/Qwen3-8B-Instruct
AI_CONTEXT_LENGTH=8192
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7

# ─── External AI (optional) ─────────────────────────
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# ─── GitHub Integration ─────────────────────────────
GITHUB_TOKEN=
GITHUB_ORG=sojip-projects

# ─── Frontend ────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# ─── Email ───────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=noreply@sojip.com

# ─── Observability ───────────────────────────────────
SENTRY_DSN=
POSTHOG_API_KEY=
Development Workflow
Make Targets
makefile
make dev          # Start full stack (docker-compose.dev.yml)
make down         # Stop all services
make logs         # Tail all logs
make migrate      # Run Alembic migrations
make migration    # Create new migration (make migration name="add_games")
make seed         # Seed database with demo data
make test         # Run backend + frontend tests
make lint         # Run linters
make clean        # Remove volumes and build artifacts
Branch Strategy
main — production-ready, protected

develop — integration branch

feature/* — feature branches (PR into develop)

hotfix/* — urgent production fixes

Commit Convention
text
feat(phase-engine): add gate validation for Idea → Plan
fix(ai-router): handle Ollama connection timeout
docs(readme): update scaling cost model
Testing Requirements
Backend: pytest, 80% coverage minimum for core/ and services/

Frontend: Vitest + Playwright for critical paths

Integration: At least one test per phase gate

Security: Tenant isolation test for every new endpoint

Deployment Path
Stage 1: Single-Node (MVP)
Docker Compose on a single VM. Suitable for first 50 tenants.

text
[Cloud VM: 8 vCPU, 32GB RAM, 1× GPU]
  ├── Next.js
  ├── FastAPI
  ├── PostgreSQL
  ├── Redis
  └── Ollama
Stage 2: Kubernetes (Growth)
Single-region K8s cluster. Separate deployments per service. Managed Postgres. vLLM replaces Ollama.

text
[K8s Cluster]
  ├── frontend-deployment (3 replicas)
  ├── backend-deployment (3 replicas)
  ├── ollama/vllm-deployment (1 GPU node)
  └── [Managed Postgres + Redis]
Stage 3: Multi-Region (Scale)
Regional clusters with tenant-aware routing. Read replicas per region. AI serving per region (data sovereignty).

text
[Region: US]        [Region: EU]        [Region: APAC]
  ├── App             ├── App             ├── App
  ├── Postgres        ├── Postgres        ├── Postgres
  └── vLLM            └── vLLM            └── vLLM
        ↑                   ↑                   ↑
        └───── Tenant Router (DNS + JWT) ──────┘
Migration Checklist: Ollama → vLLM
When you're ready to scale AI serving:

□ Verify GPU has enough VRAM for target model
□ Set AI_BACKEND=vllm in .env
□ Update VLLM_MODEL to HuggingFace repo ID
□ Set AI_CONTEXT_LENGTH explicitly (vLLM uses full context)
□ Move system prompts from Modelfiles to application config
□ Load-test with expected concurrency (30 students submitting simultaneously)
□ Monitor GPU utilization and request queue depth
□ Roll back by setting AI_BACKEND=ollama (no code change required)
Contributing
See docs/guides/contributing.md.

Core rules:

Every PR must include a test.

Tenant isolation is non-negotiable — every new endpoint filters by tenant_id.

AI prompts live in config, not code.

New phase gates must be documented in docs/architecture/system-design.md.

Games plug into the Game Framework — no custom auth, no custom state sync.

License
Proprietary. All rights reserved. See LICENSE.

Contact
Product: product@sojip.com

Engineering: eng@sojip.com

Security: security@sojip.com

Last updated: [auto-generated by CI]
Version: 0.1.0-mvp

text

---

## What This README Does

1. **Anchors the vision** — anyone reading it understands the six-phase journey, three roles, six skill tiers.
2. **Documents the stack decision** — FastAPI + Next.js + PostgreSQL, with rationale.
3. **Locks in scaling paths** — Ollama → vLLM, monolith → microfrontends, single-node → multi-region, each with explicit triggers.
4. **Makes the MVP scope unforgeable** — 12 weeks, six sprints, one game, clear exit criteria.
5. **Gives your team a shared vocabulary** — tenant context, AI router, phase engine, fail-closed.
6. **Survives personnel changes** — the *why* behind each decision is recorded.

## Recommended Next Files

After the README, I'd write these three in order:

1. **`docs/architecture/system-design.md`** — expand the architecture diagram into sequence diagrams for each phase gate.
2. **`.env.example`** — copy the environment variables section above.
3. **`Makefile`** — the targets shown in the Development Workflow section.

Would you like me to sketch the `system-design.md` next, or move directly into the first sprint's concrete code (tenant context dependency + Lean Canvas block schema)?
