"""
Template catalog for the Scaffold phase.

Each template describes a starter codebase the student can generate.
The `node_kinds` field tells us which diagram nodes this template
matches — used to recommend templates based on the Blueprint.
"""
from app.schemas.scaffold import TemplateInfo


TEMPLATES: list[TemplateInfo] = [
    TemplateInfo(
        id="nextjs-fastapi",
        category="fullstack",
        default_deploy_target="railway",
        verification_kind="http",
        name="Next.js + FastAPI",
        description=(
            "React frontend + Python API. Full-stack starter with "
            "Postgres, Alembic migrations, Docker Compose, and GitHub Actions CI."
        ),
        tech_stack=["Next.js", "FastAPI", "PostgreSQL", "Docker"],
        node_kinds=["frontend", "backend", "database"],
        icon="⚡",
    ),
    TemplateInfo(
        id="nextjs-node",
        category="fullstack",
        default_deploy_target="vercel",
        verification_kind="http",
        name="Next.js + Node.js",
        description=(
            "React frontend + Express/NestJS API. TypeScript end-to-end, "
            "Prisma ORM, Postgres, Docker Compose."
        ),
        tech_stack=["Next.js", "Node.js", "Prisma", "PostgreSQL"],
        node_kinds=["frontend", "backend", "database"],
        icon="🟢",
    ),
    TemplateInfo(
        id="react-python",
        category="fullstack",
        default_deploy_target="railway",
        verification_kind="http",
        name="React + Python (data)",
        description=(
            "Minimal React frontend + Flask API. Ideal for data "
            "visualization, ML demos, or notebook-driven projects."
        ),
        tech_stack=["React", "Flask", "Pandas", "SQLite"],
        node_kinds=["frontend", "backend"],
        icon="📊",
    ),
    TemplateInfo(
        id="python-only",
        category="standalone",
        default_deploy_target="pypi",
        verification_kind="registry",
        name="Python (CLI / library)",
        description=(
            "Pure Python package. Includes pytest, pre-commit hooks, "
            "and a publishable PyPI structure."
        ),
        tech_stack=["Python", "pytest", "Poetry"],
        node_kinds=["backend"],
        icon="🐍",
    ),
    TemplateInfo(
        id="r-shiny",
        category="fullstack",
        default_deploy_target="custom",
        verification_kind="http",
        name="R + Shiny",
        description=(
            "Interactive R dashboard. Includes renv for reproducible "
            "dependencies, ggplot2, and a deployable Shiny app."
        ),
        tech_stack=["R", "Shiny", "ggplot2", "renv"],
        node_kinds=["frontend", "backend"],
        icon="📈",
    ),
    TemplateInfo(
        id="static-site",
        category="standalone",
        default_deploy_target="github_pages",
        verification_kind="http",
        name="Static site",
        description=(
            "Plain HTML/CSS/JS. Perfect for landing pages, portfolios, "
            "and small projects with no backend."
        ),
        tech_stack=["HTML", "CSS", "JavaScript"],
        node_kinds=["frontend"],
        icon="🌐",
    ),

    # ─── Standalone Apps ─────────────────────────────────
    TemplateInfo(
        id="single-html",
        name="Single HTML file",
        description=(
            "One index.html with inline CSS and JavaScript. "
            "Perfect for landing pages, small games, and portfolio pieces."
        ),
        tech_stack=["HTML", "CSS", "JavaScript"],
        node_kinds=["frontend"],
        icon="📄",
        category="standalone",
        default_deploy_target="github_pages",
        verification_kind="http",
    ),

    TemplateInfo(
        id="chrome-extension",
        name="Chrome extension",
        description=(
            "Manifest V3 browser extension. Includes a popup, a content script, "
            "and icons ready for the Chrome Web Store."
        ),
        tech_stack=["JavaScript", "HTML", "Manifest V3"],
        node_kinds=["frontend"],
        icon="🧩",
        category="standalone",
        default_deploy_target="chrome_store",
        verification_kind="manual",
    ),

    TemplateInfo(
        id="cli-python",
        name="Python CLI tool",
        description=(
            "A pip-installable Python package with a console entry point. "
            "Includes pytest, ruff, and a pyproject.toml ready to publish."
        ),
        tech_stack=["Python", "Click", "pytest"],
        node_kinds=["backend"],
        icon="🐍",
        category="standalone",
        default_deploy_target="pypi",
        verification_kind="registry",
    ),

    TemplateInfo(
        id="cli-node",
        name="Node.js CLI tool",
        description=(
            "An npm-publishable CLI with a bin entry. Includes TypeScript, "
            "a build step, and a test harness."
        ),
        tech_stack=["Node.js", "TypeScript", "Commander"],
        node_kinds=["backend"],
        icon="⬢",
        category="standalone",
        default_deploy_target="npm",
        verification_kind="registry",
    ),

    TemplateInfo(
        id="electron-desktop",
        name="Electron desktop app",
        description=(
            "Cross-platform desktop app. Includes Electron Forge, "
            "a main process, and a renderer, with build scripts for installers."
        ),
        tech_stack=["Electron", "Node.js", "HTML"],
        node_kinds=["frontend"],
        icon="🖥",
        category="standalone",
        default_deploy_target="download",
        verification_kind="manual",
    ),

    TemplateInfo(
        id="raspberry-pi",
        name="Raspberry Pi service",
        description=(
            "A Python service designed for a Raspberry Pi. Includes a systemd "
            "unit, an install script, and instructions for setting up on boot."
        ),
        tech_stack=["Python", "systemd", "Raspberry Pi OS"],
        node_kinds=["backend"],
        icon="🔌",
        category="standalone",
        default_deploy_target="local_network",
        verification_kind="http",
    ),

]


def get_template(template_id: str) -> TemplateInfo | None:
    return next((t for t in TEMPLATES if t.id == template_id), None)
