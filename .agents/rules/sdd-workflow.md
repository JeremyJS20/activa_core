---
trigger: always_on
---

# Workflow Router — lifecycle detection, hard gates and routing (automatic)

## HARD GATES (NEVER violate, non-negotiable)

### Gate 1: AI proposes, human approves
The agent NEVER executes without explicit human approval.
- Propose what you will do and why
- Wait for human to say "go", "proceed", "yes", etc.
- Execute ONE single step
- Propose the next step
- Repeat
- NEVER execute multiple steps without intermediate approval

### Gate 2: One spec at a time
Do not mix features/bugs in the same context.
- If there is an active AB#, finish before starting another
- DO NOT work on AB#5678 and AB#1234 at the same time
- If user asks to switch AB#: warn "You have AB#5678 in progress. Finish first?"

### Gate 3: No auto-deploy prod
Production deploy requires explicit human approval.
- NEVER deploy to prod without human saying "deploy to prod"
- dev: auto-deploy OK (with step approval)
- cert: manual approval OK
- prod: TRIPLE sign-off mandatory

### Gate 4: No auto-merge PRs
Every PR requires human review.
- The agent CREATES the PR (with approval)
- The agent NEVER merges the PR
- The agent NEVER auto-approves the PR

### Gate 5: Templates mandatory
NEVER create specs without using templates from specs/_templates/.
- requirements.md → based on requirements-template.md
- design.md → based on design-template.md
- tasks.md → based on tasks-template.md
- NEVER invent sections not in the template
- Respect ALWAYS marks (always include) and CONDITIONAL (include if applicable)

### Gate 6: Meaningful commit scope & work item reference
Every commit must reference the work item when integrated with Azure DevOps, or use standard Conventional Commits with clear scope in standalone/local mode.
- ADO mode: `feat(AB#5678): add export endpoint`, `fix(AB#1234): resolve login google oauth`
- Standalone / Local mode: `feat(payroll): add export endpoint`, `fix(auth): resolve login google oauth`
- NEVER make vague commits like `update files` or commit without a defined scope/AB#.

### Gate 7: Memory-first
server-memory before reading files. codebase-memory before grep.
- Always load memory at start
- Always search codebase-memory before grep
- NEVER read a file if info is already in memory

### Gate 8: No editing protected files
Do not edit: opencode.json, .sdd-config.json, .sdd-credentials.json, VERSION, .agents/mcp_config.json, .kiro/settings/mcp.json, .mcp.json, .claude/mcp.json
- If changes needed: request explicit human approval
- If agent tries to edit them: STOP and notify

- **Feature**: follow `spec-generation-protocol.md` (Forward, Reverse, or Hybrid): `requirements.md` → `design.md` → `tasks.md` → implement task by task
- **Bug**: receive bug directly → analyze → fix → test → PR (no design or tasks, follow `bug-fix-protocol.md`)
- NEVER create design.md for a bug
- NEVER skip design.md or tasks.md for a feature

### Gate 10: Requirements come from Grounded Input Context
The agent NEVER invents requirements without grounding in authoritative input.
- In ADO Mode:
  1. **Functional Package** (PRIMARY): if `docs/requirements/functional-packages/Functional-Package-HU-{id}-*.md` exists, use it as the authoritative source
  2. **Azure DevOps WI** (FALLBACK): if no Functional Package, read the WI from ADO via MCP
  - The agent brings requirements into the repo as `specs/AB#id/requirements.md` (or `specs/{module}/{sub-feature}/requirements.md`).
- In Standalone / Local Mode:
  1. **Channel A (Document / File)**: Parse PRD, brief, functional spec, or local client file in `docs/` or workspace.
  2. **Channel B (Business Elicitation Interview)**: Conduct an interactive discovery interview across the 5 dimensions (Value, Roles, Entities, Rules, NFRs).
- NEVER create requirements.md without grounding in one of these authoritative sources.

## Entry points

The agent detects the entry point automatically based on the AB#:

### 1. Functional Package (PRIMARY)
- Path: `docs/requirements/functional-packages/Functional-Package-HU-{id}-{title}.md`
- If exists: this is the authoritative functional baseline
- Contains: Business Rules, Data Dictionaries, E2E Context, Test Context, Implementation Contract, Traceability Map
- The Functional Package is READ-ONLY — the agent NEVER edits it
- The agent creates `specs/AB#id/requirements.md` that REFERENCES the package (link, not copy)
- The agent respects the Implementation Contract (what dev can/cannot do)
- If ambiguity/contradiction → STOP → Functional Escalation Protocol → wait for human decision

### 2. Azure DevOps WI (FALLBACK)
- If no Functional Package found: read the WI from ADO via MCP
- Get: title, description, acceptance criteria, linked WIs (Data Dictionary, Structure, Business Rule)
- The agent creates `specs/AB#id/requirements.md` from the WI content using template

## Automatic type detection

The agent automatically detects if it is a Feature, Bug, or QA Corte:
1. Check for Functional Package: `docs/requirements/functional-packages/Functional-Package-HU-{id}-*.md`
2. If Functional Package exists → read it → type is in "Package Identity" section (usually User Story/Feature)
3. If no Functional Package → read WI from Azure DevOps (type: Task, User Story, Bug, PBI)
4. If type = Task/User Story/Feature → Feature flow
5. If type = Bug → Bug flow
6. If type = PBI AND title contains `corte al` → QA Corte context (see `qa-corte-workflow.md`)
7. If no type → ask human "Is this a feature or bug?"

### QA Corte detection (automatic at session start)
Even without an explicit AB#, the agent checks for active cortes:
- Query ADO for PBIs with `corte al` in title and state = `Acceptance`
- If found → show corte summary and prioritize corte bugs
- See `qa-corte-workflow.md` for full detection rules and developer flow

## Automatic phase detection

The agent detects what phase of work it is in:
- No branch → need to start (create branch)
- Branch exists but no specs → need to create design + tasks (feature) or analyze (bug)
- Specs exist but no code → need to implement
- Code exists but no tests → need to test
- Tests pass → need to create PR
- PR created → need to update WI

## Greenfield project flow (project from scratch)

1. **Inception & Requirements Elicitation (Step 1)**:
   The agent gathers requirements through one of three flexible input channels:
   - **Channel A: Local File / Document (File-based Discovery)**: The user provides a path to a file (PRD, RFP, Markdown, PDF, TXT, or brief in `docs/`). The agent parses it, extracts entities, actors, workflows, and business rules.
   - **Channel B: Business Elicitation Interview (Discovery Session)**: If no document exists, the agent conducts an interactive interview (focused questions across 5 dimensions):
     1. *Core Value & Business Model*: What problem does it solve? Who pays/uses it?
     2. *Actors & Access (RBAC)*: What roles exist (Admin, Operador, Cliente)? What are their boundaries?
     3. *Domain Entities & Lifecycle*: What are the main nouns (Order, Invoice, Asset) and their state machines?
     4. *Critical Business Rules*: Validations, legal/tax calculations, limits, edge cases.
     5. *Integrations & NFRs*: External APIs, volume, response times, security constraints.
   - **Channel C: Azure DevOps (ADO Backlog)**: Reads an Epic or Feature WI and linked requirements.
   - **Stack & Architecture Decision**:
     - Based on the elicited domain, propose the optimal stack (Frontend, Backend, Database, Cloud/Infra) and folder conventions.
     - Present pros/cons and justifications.
     - On human approval, record as a `Decision` entity in `server-memory`.
2. **Initial Spec Creation**:
   - Follow `spec-generation-protocol.md` Mode 1 (Forward Spec) under `specs/initial-setup/` or `specs/{AB#id-setup}/`:
   - `requirements.md`: Core MVP requirements, actors, scope.
   - `design.md`: Architecture, project folder structure, database schema, deployment strategy.
   - `tasks.md`: Broken down into Waves:
     - **Wave 0 (Scaffolding / Subfolder Isolation)**: Framework init into a dedicated subfolder (`app/` or `apps/{name}/`), linters, TypeScript config, testing setup, preserve SDD root files, CI/CD pipeline setup, configure `app_dir` in `.sdd-config.json`.
     - **Wave 1**: Core data models & migrations.
     - **Wave 2**: Core backend services / APIs.
     - **Wave 3**: Core UI layout / screens.
3. **Scaffolding Execution (Wave 0 & Subfolder Isolation)**:
   - **Application Subfolder Isolation**: To avoid mixing SDD orchestration files (`.agents/`, `.opencode/`, `specs/`, `docs/`, `.sdd-memory/`, `.sdd-*`, `sdd-init.sh`) with application source code and runtime dependencies (`node_modules/`, `.venv/`, `dist/`), the application SHALL be scaffolded inside a dedicated application directory (e.g. `app/`, `apps/{name}/`, or `{app-name}/`).
   - Run framework setup commands targeting the subfolder (e.g. `npx create-next-app@latest app`, `npm create vite@latest app`, `nest new app`, `cargo new app`) with explicit human approval.
   - Configure `"app_dir": "app"` in `.sdd-config.json` so prechecks, linters, and start commands know where the application root resides.
   - Preserve existing root `.gitignore`, SDD rules, and configuration during scaffolding.
4. **Codebase Indexing**:
   - Immediately run `codebase-memory index_repository` on the newly scaffolded codebase.
5. Proceed to subsequent waves as standard SDD development.

## Routing

- Analysis/planning → sdd-plan agent (read-only, proposes)
- Implementation → sdd-build agent (edits with approval)
- Switch between agents: Tab

## What NEVER to present as an option to the user
- "Explore codebase" → do it automatically (codebase-memory)
- "Load context into memory" → do it automatically (server-memory)
- "View project status" → do it automatically (precheck)
- Only present WORK options:
  - In Brownfield (existing code): Feature, Bug, or QA Corte bugs
  - In Greenfield (new repo): Project Inception (Stack & Architecture), MVP Spec (requirements/design/tasks with Wave 0 scaffolding)

---

# Spec Integration

> Specs live in the repo under specs/{AB#id-feature-name}/
> Templates are MANDATORY. The agent NEVER invents spec structure.

## Directory structure

### A. Single Feature
```text
specs/
├── _templates/                    # Templates (do not modify, reference only)
│   ├── requirements-template.md
│   ├── design-template.md
│   └── tasks-template.md
└── AB#5678-export-excel/          # Feature folder (named after WI)
    ├── requirements.md            # Based on template
    ├── design.md                  # Based on template
    └── tasks.md                   # Based on template
```

### B. Modular Macro-Feature / Full Domain Module
When a module covers multiple distinct workflows, screens, or regulatory domains (e.g. Payroll, Billing), it SHALL be decomposed into modular sub-specs:
```text
specs/payroll/
├── 01-cycles-and-calculation/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── 02-adjustments-and-overtime/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── 03-bank-disbursement/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
└── ...
```

## Template usage (MANDATORY)
Every spec file MUST be based on the corresponding template:

| File | Template | Who creates |
|------|----------|-------------|
| requirements.md | requirements-template.md | Agent (from Document, Interview, or ADO) |
| design.md | design-template.md | Developer (with approval) |
| tasks.md | tasks-template.md | Developer (with approval) |

Rules:
- NEVER create a spec without using the template
- NEVER invent sections not in the template
- Respect ALWAYS marks (always include these sections)
- Respect CONDITIONAL marks (include only if applicable)
- Fill all placeholders [in brackets] with real data
- DO NOT leave template placeholders unfilled

## Gates between phases

| Gate | Requirement | Block |
|------|-------------|-------|
| requirements → design | requirements.md exists and is approved | BLOCK if missing |
| design → tasks | design.md exists and is approved | BLOCK if missing |
| tasks → impl | tasks.md exists and has assigned tasks | BLOCK if missing |
| impl → test | code review + lint + unit tests passing | BLOCK if failing |
| test → PR | all tests pass, QA sign-off | BLOCK if failing |

## What NEVER to do
- DO NOT create design.md without requirements.md
- DO NOT create tasks.md without design.md
- DO NOT implement without tasks.md
- DO NOT create specs outside the specs/ directory
- DO NOT create spec files without using templates
- DO NOT modify templates (they are reference only)

---

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

---

# Change Propagation

> When upstream artifacts change, downstream artifacts must be reviewed.
> Anti-flip-flop: never revert a decision without new information.

## Propagation matrix

| If this changes... | ...then mark these as REQUIRES REVIEW |
|---------------------|----------------------------------------|
| requirements.md | design.md, tasks.md |
| design.md | tasks.md, implementation code |
| tasks.md | implementation code |
| .sdd-config.json | all specs (role/org may have changed) |

## How to mark REQUIRES REVIEW
Add at the top of the affected file:
```markdown
> ⚠️ REQUIRES REVIEW — upstream changed: [file] on [date]
```

## Anti-flip-flop rule
- NEVER revert a technical decision without new information that justifies the revert
- If a decision was made and recorded in server-memory, it stands unless:
  - New requirements make it obsolete
  - New technical constraints require a different approach
  - The human explicitly provides new information
- If reverting: document WHY in server-memory as a new Decision

## When to trigger propagation
- When requirements.md is modified → mark design.md and tasks.md
- When design.md is modified → mark tasks.md
- When tasks.md is modified → warn that implementation may need updates
- Propagation is automatic — the agent detects changes and marks downstream

## Upstream Consolidation: Living Documentation (`docs/`)
When a feature or sub-feature specification is completed and approved:

1. **Module Living Document (`docs/modules/{module}.md`)**:
   - **Capabilities Matrix (Section 2)**: Add or update the sub-feature row with current state (`✅ Certified`, `⏳ In Progress`, `⏳ Spec in Review`), relative spec link, and test coverage.
   - **Master State Machine (Section 3.1 - `stateDiagram-v2`)**: If the sub-feature introduces sub-lifecycles, operational states, or state invalidations (e.g. adjustment entry lifecycle, auto-invalidation from calculated back to draft), the master state diagram MUST be updated. Never leave diagrams stale.
   - **Component Architecture Flow (Section 3.2 - `flowchart`)**: If the sub-feature introduces new UI routes, API endpoints, domain engines, or policy resolvers (e.g. `FiscalStrategyResolver`, `LaborPolicyResolver`), the component flow diagram MUST be updated to show these components in context.
   - **Consolidated Data Model (Section 4 - `erDiagram`)**: Merge new entities, relationships, polymorphic columns (e.g. `details JSONB`), and settings tables into the master ERD.
   - **Master API Catalog (Section 5)**: Add all new endpoints with method, path, authorized roles, request payload structure, and 200/201 response schema.
   - **Universal Business Rules & Compliance (Section 6)**: Record statutory formulas, legal rates, precision rules, and RFC 7807 error codes.
   - **Change Log (Section 9)**: Append milestone entry with date, sub-module spec link, git commit hash, and approver name.
   - **Markdown Table Integrity**: NEVER leave blank lines between table rows (breaks native Markdown table rendering). Maintain exact column counts across all rows.

2. **System Architecture (`docs/architecture/`)**:
   - If cross-cutting infrastructure, global services, or root models changed, update `docs/architecture/system-overview.md` and `docs/architecture/database-architecture.md`.

3. **Trigger**: Automatic upon approval of `tasks.md` or PR merge.

---

## What NEVER to do
- DO NOT silently change an upstream artifact without marking downstream
- DO NOT revert a decision without documenting the reason
- DO NOT ignore REQUIRES REVIEW markers — they must be addressed before proceeding

---

# Spec Structure Gate

> Automatic blocks that prevent skipping lifecycle phases.
> If a gate is violated, STOP immediately and notify the human.

## Blocks

| # | Condition | Result |
|---|-----------|--------|
| 1 | Create design.md without requirements.md | BLOCK |
| 2 | Create tasks.md without design.md | BLOCK |
| 3 | Implement code without tasks.md | BLOCK |
| 4 | Create spec file outside specs/ directory | BLOCK |
| 5 | Create spec without using template | BLOCK |
| 6 | Create requirements.md without input context (ADO WI, local PRD/file, or elicitation interview) | BLOCK |
| 7 | Create design.md for a Bug (bugs don't need design) | BLOCK |
| 8 | Create tasks.md for a Bug (bugs don't need tasks) | BLOCK |
| 9 | Link Bug Work Item as the parent Feature/Spec ID in requirements.md or design.md | BLOCK |
| 10 | Advance to next spec phase (design.md / tasks.md) without explicit human approval | BLOCK |
| 11 | Dump a multi-workflow Macro-Feature into a single monolithic spec without decomposition | BLOCK |
| 12 | Generate superficial, brief, or placeholder-ridden documentation without exhaustive technical detail | BLOCK |
| 13 | Create downstream artifact (design.md / tasks.md / code) while upstream artifact header still contains "[pending]" | BLOCK |
| 14 | Cascade a single approval across multiple artifacts, or stamp approval on an artifact not explicitly named by the user | BLOCK |
| 15 | Corrupt file encoding or introduce mojibake via non-UTF-8 tools (e.g. raw PowerShell redirection) | BLOCK |
| 16 | Update docs/modules/{module}.md without synchronizing all 3 master diagrams (State Machine, Component Flow, ERD) or leaving corrupted table rows | BLOCK |

## What happens when a block is triggered
1. STOP immediately — do not proceed
2. Notify the human: "BLOCKED: [explanation of which gate was violated]"
3. Explain what is needed to unblock: "To proceed, you need to: [requirement]"
4. Wait for human to resolve or provide guidance

## How to unblock
- Gate 1: Create requirements.md first (bring from ADO using template)
- Gate 2: Create design.md first (using template)
- Gate 3: Create tasks.md first (using template)
- Gate 4: Move the file to specs/{AB#id-feature}/
- Gate 5: Use the corresponding template from specs/_templates/
- Gate 6: If integrated with Azure DevOps, read the WI via azure-devops MCP. In standalone/local mode, parse a local PRD/specification file (Channel A) or conduct a business elicitation interview (Channel B).
- Gate 7: Bugs don't need design.md — go directly to fix
- Gate 8: Bugs don't need tasks.md — go directly to fix
- Gate 9: Specs are ONLY for Features, Epics, or User Stories/PBIs. NEVER put Bug IDs as the primary Work Item of a spec. If no Feature/PBI exists in ADO, set "Work Item: Pending (No PBI/Feature assigned in ADO yet)". Historical bugs found in Git history belong only in a dedicated "Historical Bugs Resolved" context section.
- Gate 10: Wait for explicit approval from the user ("Approved", "Aprobado", "Proceed"). NEVER advance if the user made a question, complaint, or continuation without explicit approval.
- Gate 11: Decompose the macro-feature into modular sub-features under `specs/{module}/{sub-feature}/`. Propose the breakdown first and tackle one sub-feature at a time.
- Gate 12: Redraft documentation with exhaustive technical depth: full DDL schemas with column types, nullability, constraints; complete API contracts with real request/response JSONs and HTTP error codes; exact mathematical formulas; and rendered Mermaid diagrams. Ban 'etc.', 'TODO', or summarized placeholders.
- Gate 13: Stamp the upstream artifact's header with the formal human approval (`> ✅ Approved by: [Approver Name / Role] · [YYYY-MM-DD]`) BEFORE creating or proposing the downstream artifact. Never leave `[pending]` in an approved artifact.
- Gate 14: Obtain explicit, independent approval for EACH artifact individually. Approval for requirements.md NEVER authorizes design.md. Approval for design.md NEVER authorizes tasks.md. Colloquial words ("dale", "continúa", "ok") apply ONLY to the single artifact currently under review.
- Gate 15: Restore clean UTF-8 encoding and use safe tools (replace_file_content, write_to_file, or Node.js UTF-8) for all file mutations. Ban raw PowerShell stream redirection.
- Gate 16: Fully synchronize all 3 master diagrams (Section 3.1 stateDiagram-v2, Section 3.2 flowchart, Section 4 erDiagram) in docs/modules/{module}.md to reflect certified sub-module changes (new sub-states, engines/resolvers, entities), and eliminate empty lines or malformed rows in Markdown tables.

## What NEVER to do
- DO NOT bypass gates even if the user says "just do it"
- DO NOT create files that would violate a gate
- DO NOT ignore block warnings

---

