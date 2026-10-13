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
     - **UI / UX Design System Definition (MANDATORY for frontend projects)**:
       - Propose the design persona, theme narrative (e.g. Institutional Authority), dual-mode tokens, typographic triad, and console layout shell.
       - Author master `DESIGN.md` in repository root (or `docs/architecture/design-system.md`) based on `specs/_templates/design-system-template.md`.
       - Await explicit human approval of the visual identity before scaffolding Wave 0.
     - On human approval, record as a `Decision` entity in `server-memory`.
2. **Scope Classification & Modular Decomposition (MANDATORY GATE 11)**:
   - **Single Feature vs. Multi-Workflow System Check**: Evaluate whether the greenfield project is a single-purpose utility/tool or a multi-workflow business system (e.g. Fixed Assets, Payroll, Invoicing, ERP, E-commerce, Inventory).
   - **Anti-Monolith Mandate**: For Multi-Workflow Systems, the agent is **STRICTLY FORBIDDEN** from dumping all MVP requirements into a single monolithic spec (e.g. `specs/initial-setup/requirements.md`, `specs/mvp/requirements.md`, or `specs/{system}-core/requirements.md`).
   - **Protocol for Multi-Workflow Systems**:
     1. Propose the modular sub-feature breakdown: `specs/{system}/01-{submodule}/`, `specs/{system}/02-{submodule}/`, etc.
     2. Await explicit human approval of the modular architecture.
     3. Initialize `docs/modules/{system}.md` documenting the full domain architecture, ERD, state machines, and capability matrix.
     4. Scaffold Wave 0 (Application Subfolder Scaffolding in `app/`).
     5. Author `requirements.md` ONLY for Sub-module 01 (`specs/{system}/01-{submodule}/requirements.md`).
   - **Protocol for Single-Purpose Utilities**: Author `specs/{feature}/requirements.md` using standard template.
3. **Scaffolding Execution (Wave 0 & Subfolder Isolation)**:
   - **Application Subfolder Isolation**: To avoid mixing SDD orchestration files (`.agents/`, `.opencode/`, `specs/`, `docs/`, `.sdd-memory/`, `.sdd-*`, `sdd-init.sh`) with application source code and runtime dependencies (`node_modules/`, `.venv/`, `dist/`), the application SHALL be scaffolded inside a dedicated application directory (e.g. `app/`, `apps/{name}/`, or `{app-name}/`).
   - Run framework setup commands targeting the subfolder (e.g. `npx create-next-app@latest app`, `npm create vite@latest app`, `nest new app`, `cargo new app`) with explicit human approval.
   - Configure `"app_dir": "app"` in `.sdd-config.json` so prechecks, linters, and start commands know where the application root resides.
   - Wire design tokens into `app/tailwind.config.ts` and global CSS (`app/globals.css`) matching the approved `DESIGN.md` specification.
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
