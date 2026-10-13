# Artifact Storage

> Know where each artifact lives and whether it is committed or gitignored.

## Git repo (committed, team-shared)

| Artifact | Location | Who creates |
|----------|----------|-------------|
| IDE rules and agents (`.opencode/`, `.agents/`, `.kiro/`, `.claude/`) | repo | sdd-init.sh |
| specs/_templates/ (core spec & architecture templates) | repo | sdd-init.sh |
| specs/{AB#id}/requirements.md | repo | Agent (from ADO) |
| specs/{AB#id}/design.md | repo | Developer |
| specs/{AB#id}/tasks.md | repo | Developer |
| .sdd-config.json | repo | sdd-init.sh |
| Application code (`app/`, `apps/`, `src/`) | subfolder | Scaffolding Wave 0 / Developer |
| Global Architecture docs (`docs/architecture/`) | repo | Architect / Agent |
| Module Living Docs (`docs/modules/{module}.md`) | repo | Agent (consolidated from specs) |
| .env.example | repo | sdd-init.sh |
| .gitignore | repo | sdd-init.sh |

### Living System Documentation (`docs/`)
While `specs/` stores granular, sprint-based work deltas (`requirements.md`, `design.md`, `tasks.md`), the `docs/` directory maintains the permanent, living documentation of the product:
1. `docs/architecture/`:
   - `system-overview.md`: High-level system architecture, C4 container model, environment topology, security, and observability.
   - `database-architecture.md`: Master ERD, multi-tenancy RLS, indexing strategies, and zero-downtime migration protocols.
2. `docs/modules/{module}.md`:
   - Single consolidated source of truth for each business domain (e.g. `docs/modules/payroll.md`, `docs/modules/workforce.md`).
   - Contains: domain scope, capabilities matrix, module-specific ERD, master API catalog, and regulatory business rules.
   - Consolidated incrementally from approved specs.

### Application Subfolder Isolation
In Greenfield projects and clean setups, the application source code is maintained inside a dedicated subfolder (e.g. `app/`, `apps/{name}/`, or `{app-name}/`).
This ensures:
1. Complete separation between SDD governance files (`.agents/`, `.opencode/`, `specs/`, `docs/`, `.sdd-*`) and application runtime/build artifacts (`node_modules/`, `.next/`, `dist/`, `target/`, `.venv/`).
2. Clean package manifests (`package.json`, `go.mod`, etc.) without polluting root tooling.
3. Clean monorepo scalability (e.g. multiple services or apps under `apps/` or `packages/`).

## Gitignored (local, NEVER committed — contain secrets/credentials)

| Artifact | Why |
|----------|-----|
| `opencode.json` | OpenCode MCP config — contains PATs/credentials |
| `.agents/mcp_config.json` | Antigravity MCP config — contains PATs/credentials |
| `.kiro/settings/mcp.json` | Kiro MCP config — contains PATs/credentials |
| `.mcp.json` | Claude Code / Cursor MCP config — contains PATs/credentials |
| `.claude/mcp.json` | Claude Code project MCP config — contains PATs/credentials |
| `.sdd-credentials.json` | Local credentials store (PATs, API keys) |
| `.env`, `.env.local`, `.env.*.local` | Local environment variables and secrets |
| `.sdd-memory/` | Local session memory store |
| `.sdd-cache/` | Local temporary cache |
| `sdd-init.sh` | Installer script (downloaded during setup) |

## Azure DevOps (NOT in repo)

| Artifact | Who creates |
|----------|-------------|
| Work Items (Epics, Features, Bugs) | Analyst |
| Pull Requests | Agent (with approval) |
| Pipelines | Developer |
| Wiki | Agent (with approval) |

## Bidirectional traceability
- The requirement lives in ADO as WI → agent brings it to repo as requirements.md
- The PR is created in ADO → linked to WI (AB#id)
- WI state is updated from repo (New → Active → Resolved → Closed)
- Every commit references AB# → traceable from code to WI
- Every WI has a branch → traceable from WI to code

## What NEVER to do
- DO NOT commit MCP config files (`opencode.json`, `.agents/mcp_config.json`, `.kiro/settings/mcp.json`, `.mcp.json`, `.claude/mcp.json`) — they contain PATs and credentials
- DO NOT commit credentials or secret files (`.sdd-credentials.json`, `.env`, `.env.local`)
- DO NOT commit `.sdd-memory/` (local session memory)
- DO NOT store specs outside the repo (they are team-shared)
- DO NOT store work items in the repo (they live in ADO)
