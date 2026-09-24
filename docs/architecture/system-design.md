# SOJIP System Design

**Version:** 0.1.0 (MVP)  
**Last Updated:** 2026-09-21  
**Status:** Draft — Foundation Layer

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Architecture Layers](#architecture-layers)
3. [Phase Gate Sequence Diagrams](#phase-gate-sequence-diagrams)
4. [Multi-Tenancy Data Flow](#multi-tenancy-data-flow)
5. [AI Router Architecture](#ai-router-architecture)
6. [Scaffolding Engine Flow](#scaffolding-engine-flow)
7. [Security Model](#security-model)
8. [Failure Modes & Mitigations](#failure-modes--mitigations)

---

## Design Principles

SOJIP is built on five non-negotiable architectural principles. Every design decision traces back to these.

### 1. Fail-Closed Tenant Isolation

**Principle:** If a request cannot be attributed to a valid tenant, it is rejected. No tenant context means no data access.

**Implementation:**
- `TenantContext` dependency extracts `tenant_id` from JWT claims (`claims["tid"]`), never from request bodies or query parameters.
- Every tenant-scoped query filters by `tenant_id`. Missing filter = test failure.
- PostgreSQL RLS added in v2 as defense-in-depth backstop.

**Why:** Multi-tenant data leakage is a platform-ending event. A single bug that exposes Tenant A's students to Tenant B destroys trust with every institution.

### 2. AI Provider Abstraction

**Principle:** Business logic never knows which AI backend is running. Ollama and vLLM are implementation details behind a stable interface.

**Implementation:**
- `AIProvider` Protocol defines `chat()` and `stream_chat()`.
- `OllamaProvider` and `VLLMProvider` both call OpenAI-compatible `/v1/chat/completions`.
- Migration from Ollama to vLLM changes `.env`, not code.

**Why:** You will outgrow Ollama. The router abstraction means that growth is a configuration change, not a rewrite.

### 3. Modular Monolith First

**Principle:** Start with clear module boundaries inside a single deployment. Extract to microservices or microfrontends only when traffic or release cadence demands it.

**Implementation:**
- Backend: FastAPI with domain modules (`phases/`, `games/`, `ai/`, `scaffold/`).
- Frontend: Next.js App Router with route groups per domain.
- Games: plug into a `GameFramework` — no custom auth, no custom state sync.

**Why:** Premature distribution adds operational complexity without proportional value. A modular monolith with clean boundaries is easier to extract from later than a poorly designed distributed system.

### 4. Deterministic Gate Enforcement

**Principle:** Phase gates are enforced by code, not convention. A user cannot advance to the next phase until gate conditions are met.

**Implementation:**
- `PhaseEngine` validates gate prerequisites before allowing transition.
- Gate conditions are configurable per project type (Student vs. Innovator).
- All gate decisions are logged with `user_id`, `project_id`, `gate_type`, `decision`, `evidence`.

**Why:** The "Gatekeeper Rule" is SOJIP's core differentiator. If gates are optional, the platform is just another Trello board.

### 5. Student Data Sovereignty

**Principle:** Student data never leaves self-hosted infrastructure unless the tenant explicitly opts in to external AI providers.

**Implementation:**
- Default AI routing sends all prompts to local Ollama/vLLM.
- External providers (GPT-4, Claude) are opt-in per tenant, with audit logging.
- Model config (context length, system prompts) stored in application config, not in model files.

**Why:** Educational institutions have strict data residency and privacy requirements. Defaulting to local inference makes SOJIP viable for schools that cannot send student work to third-party APIs.

---

## Architecture Layers

SOJIP is organized into seven layers. Each layer has a single responsibility and communicates only with adjacent layers.
┌─────────────────────────────────────────────────────────────────┐
│ L7: Presentation │
│ Next.js App Router, Block Editor, Game Framework, SOJStepper │
└───────────────────────────────┬─────────────────────────────────┘
│ HTTPS + WebSocket
┌───────────────────────────────▼─────────────────────────────────┐
│ L6: API Gateway │
│ Next.js BFF routes, FastAPI CORS, Rate limiting │
└───────────────────────────────┬─────────────────────────────────┘
│ REST
┌───────────────────────────────▼─────────────────────────────────┐
│ L5: Application Services │
│ PhaseEngine, ScaffoldGenerator, DiagramParser, AI Router │
└───────────────────────────────┬─────────────────────────────────┘
│
┌───────────────────────────────▼─────────────────────────────────┐
│ L4: Domain Models │
│ SQLAlchemy ORM, Pydantic schemas, Phase transition rules │
└───────────────────────────────┬─────────────────────────────────┘
│
┌───────────────────────────────▼─────────────────────────────────┐
│ L3: Data Access │
│ TenantManager (auto-filter), Alembic migrations, RLS policies │
└───────────────────────────────┬─────────────────────────────────┘
│
┌───────────────────────────────▼─────────────────────────────────┐
│ L2: Infrastructure │
│ PostgreSQL, Redis (Cache + Celery), Ollama/vLLM │
└───────────────────────────────┬─────────────────────────────────┘
│
┌───────────────────────────────▼─────────────────────────────────┐
│ L1: Foundation │
│ Docker, Kubernetes, Terraform, GitHub Actions │
└─────────────────────────────────────────────────────────────────┘

```text

### Layer Contracts

| Layer | Input | Output | Must Not |
|---|---|---|---|
| **L7 Presentation** | User interactions, API responses | Rendered UI, user events | Contain business logic |
| **L6 API Gateway** | HTTP requests, WebSocket messages | Validated requests, rate-limited | Access database directly |
| **L5 Application Services** | Validated requests, domain models | Domain operations, events | Know about HTTP or UI |
| **L4 Domain Models** | Database rows, request schemas | Pydantic/SQLAlchemy objects | Know about AI providers or scaffolding |
| **L3 Data Access** | Queries with tenant context | Filtered result sets | Allow queries without tenant context |
| **L2 Infrastructure** | Connection strings, model configs | Storage, compute, inference | Contain business logic |
| **L1 Foundation** | Terraform configs, CI/CD pipelines | Running infrastructure | Be modified manually in production |

---

## Phase Gate Sequence Diagrams

Each phase gate follows a consistent pattern: **Request → Validate Prerequisites → AI Gate Check → Transition → Log Evidence**.

### Gate 1: Idea → Plan

**Prerequisites:** 3 peer validations on the Lean Canvas.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI as Next.js UI
    participant API as FastAPI Backend
    participant Auth as Auth Service
    participant Phase as PhaseEngine
    participant AI as AI Router
    participant DB as PostgreSQL

    Student->>UI: Click "Advance to Plan"
    UI->>API: POST /api/v1/projects/{id}/phases/advance
    Note over UI,API: Body: { target_phase: "plan" }
    
    API->>Auth: Verify JWT
    Auth-->>API: Claims: { user_id, tenant_id, role }
    
    API->>Phase: validate_gate(project_id, "idea", "plan")
    
    Phase->>DB: SELECT * FROM validations 
    Note over Phase,DB: WHERE project_id = :id AND phase = 'idea'
    
    DB-->>Phase: 2 validations found
    Phase-->>API: Gate FAILED: need 3 validations, have 2
    
    API-->>UI: 403 Forbidden
    Note over API,UI: { error: "gate_not_met",<br/>missing: "1 peer validation",<br/>current: 2, required: 3 }
    
    UI-->>Student: Show Gate Modal
    Note over UI,Student: "Almost there! You need 1 more peer review<br/>before moving to Planning."

### Gate Passed Scenario:

