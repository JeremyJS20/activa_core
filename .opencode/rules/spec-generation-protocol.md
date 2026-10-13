# Spec Generation Protocol — Forward, Reverse & Hybrid Specs

> The agent NEVER writes code for a feature without an approved `requirements.md`, `design.md`, and `tasks.md`.
> Jumping directly from a chat discussion to implementation violates Hard Gates 1, 2, and 5.
> This protocol defines how to document features: new, existing (legacy), or hybrid (extending existing code).

---

## The Three Spec Modes

| Mode | Situation | Workflow |
|------|-----------|----------|
| **1. Forward Spec** | New feature (greenfield or new capability) | Discussion / WI ➔ `requirements.md` ➔ `design.md` ➔ `tasks.md` ➔ implementation |
| **2. Reverse Spec (As-Built)** | Existing code without specs (legacy/undocumented) | Codebase inspection via `codebase-memory` ➔ `requirements.md` (As-Built) ➔ `design.md` (As-Built) ➔ `tasks.md` (gaps/tests) |
| **3. Hybrid Spec (Extension)** | Existing module getting a new sub-feature (e.g. Payroll ➔ Distribution) | Inspect existing base code ➔ Document context ➔ Forward spec for the new sub-feature |

---

## Language Governance: Framework vs Domain Specifications

To eliminate linguistic confusion between framework standards and business domains:

1. **SDD Framework & Tooling Layer (`sdd-standard/`, `.agents/`, rules, templates)**:
   - Authored strictly in **English**.
   - Ensures universal compatibility with global LLM reasoning, developer tooling, and cross-platform standards.

2. **Project Domain & Feature Specifications (`specs/`, `docs/modules/`)**:
   - Authored in the **primary business language of the project stakeholders and regulatory jurisdiction**.
   - If the project operates in a Spanish-speaking domain (e.g., Dominican Republic Payroll, TSS Ley 87-01, DGII, Código de Trabajo), the User Stories, Acceptance Criteria, business formulas, and domain documentation MUST be written in **Spanish**.
   - **NEVER** force English translations onto local legal terminology, tax concepts, government agency standards (e.g., TSS, DGII, NCF, Regalía), or stakeholder User Stories. The template scaffolding is in English; the domain substance is in the stakeholder's language.

---

## Mode 1: Forward Spec (New Feature or Greenfield System)

When creating a new feature from scratch, from an elicitation session/PRD, or from an ADO User Story:

### Step 0: Scope Evaluation & Anti-Monolith Decomposition Check (MANDATORY GATE 11)
Before writing any specification files, the agent MUST evaluate the scope of the incoming requirements:
1. **Litmus Test — Single Feature vs. Multi-Workflow Macro-Feature**:
   - **Single Isolated Feature**: A single focused workflow, screen, or endpoint (e.g. "Export to Excel", "Dark Mode Toggle", "Filter by Date Range").
     - Can be drafted directly under `specs/{AB#id-feature}/` (or `specs/{feature}/`).
   - **Multi-Workflow Macro-Feature / Business System**: Any project, module, or initiative that encompasses:
     - More than 1 primary business domain entity with an independent lifecycle (e.g. Departments, Assets, Depreciation Runs, Accounting Entries).
     - Multiple distinct user personas or RBAC boundaries (e.g. Admin vs Custodian vs Accountant vs Auditor).
     - Multiple distinct frontend screens, routes, or workflows.
     - Batch calculation engines, regulatory logic (DGII, TSS), or external web service integrations.
2. **STRICT PROHIBITION (Hard Gate 11)**:
   - For a Multi-Workflow Macro-Feature, the agent is **STRICTLY FORBIDDEN** from bundling all requirements into a single monolithic `requirements.md` (e.g. `specs/{system}-core/requirements.md` or `specs/mvp/requirements.md`).
   - Any agent that outputs a single `requirements.md` covering all entities, workflows, calculations, and integrations of a macro-system violates Hard Gate 11.
3. **Mandatory Step 0 Action**:
   - **Step 0.1**: Decompose the macro-system into a logical sequence of sub-modules:
     `specs/{module}/01-{submodule-a}/`, `specs/{module}/02-{submodule-b}/`, etc.
   - **Step 0.2**: Present the proposed decomposition to the human and **WAIT FOR EXPLICIT APPROVAL**.
   - **Step 0.3**: Initialize or update the master living documentation `docs/modules/{module}.md` documenting the overall domain architecture, state machine, ERD, and capability matrix.
   - **Step 0.4**: Only after human approval of the modular structure, proceed to Step 1 for **Sub-module 01 ONLY**.

### Step 1: Requirements Generation (`requirements.md`)
1. **Gather Input via One of 3 Channels**:
   - **Channel A (Document / File)**: Parse PRD, brief, functional spec, or client file (Markdown, PDF, TXT, etc.).
   - **Channel B (Business Elicitation Interview)**: Conduct an interactive discovery interview (problem, actors, entities, business rules, integrations, NFRs) if requirements are underspecified or starting from scratch.
   - **Channel C (Azure DevOps / Functional Package)**: Read Functional Package (PRIMARY) or ADO User Story / Feature + linked WIs (FALLBACK).
2. Load `specs/_templates/requirements-template.md`.
3. Draft `specs/{module}/01-{submodule}/requirements.md` (or `specs/{AB#id-feature}/requirements.md` for single features):
   - Traceability (WI ID, parent feature, branch name).
   - Overview & Business context.
   - User Stories in **EARS** notation (`WHEN/WHILE/IF/WHERE [condition], the system SHALL [behavior]`).
   - Acceptance Criteria (Given / When / Then).
   - Measurable NFRs (security, performance, compliance).
   - Use Case & supporting diagrams in Mermaid.
   - Out of Scope explicitly listed.
4. **STOP & PROPOSE**: Present `requirements.md` to the human. **DO NOT generate design yet.** Wait for explicit approval.

### Step 2: Technical Design (`design.md`)
1. Once `requirements.md` is approved, load `specs/_templates/design-template.md`.
2. Draft `specs/{module}/01-{submodule}/design.md` (or `specs/{AB#id-feature}/design.md` for single features):
   - Traceability linking back to `requirements.md`.
   - Technology decisions & justifications.
   - System overview & Component diagrams in Mermaid.
   - Data design: DB tables, DTOs, schemas, validation rules.
   - API contracts (endpoints, methods, payloads, status codes).
   - State machine diagrams (if stateful transitions exist).
   - **UI / UX & Frontend Design (MANDATORY for features with UI)**:
     - Screen wireframe and spatial layout under the "No-Line" rule.
     - Integration with root `DESIGN.md` tokens (Dual-mode palette, ghost borders).
     - Typographic triad mapping (Display, Sans, Monospace for numbers/codes).
     - Component states & micro-interactions (default, hover +2px, pressed, disabled/gated).
     - Empty, loading (skeleton shimmer), and error states.
   - Error handling & edge cases.
3. **STOP & PROPOSE**: Present `design.md` to the human. **DO NOT generate tasks yet.** Wait for explicit approval.

### Step 3: Task Breakdown (`tasks.md`)
1. Once `design.md` is approved, load `specs/_templates/tasks-template.md`.
2. Draft `specs/{AB#id-feature}/tasks.md`:
   - Group tasks into logical Waves (Wave 1: Data/Models, Wave 2: Backend/Services, Wave 3: UI, Wave 4: Integration/E2E).
   - Apply estimation rules: maximum **4 hours** per task.
   - Build the dependency graph in Mermaid.
   - Define exact verification criteria for each task.
3. **STOP & PROPOSE**: Present `tasks.md` to the human.
4. **Handoff**: Only after `tasks.md` is approved can implementation begin in `sdd-build` (Task by task).

---

## Mode 2: Reverse Spec (Documenting Existing Code)

When a module was built without SDD specs and needs documentation for compliance, audit, QA, or future maintenance:

### Step 1: Code Mining with codebase-memory & Git Archeology (MANDATORY)

Code tells you **WHAT** is there; Git history tells you **WHY** it was built that way.

1. **MCP Graph Discovery**:
   - `search_graph(name_pattern=...)`: locate models, controllers, services, routes, UI components.
   - `get_code_snippet`: read signatures, validations, schemas, SQL queries, DTOs.
   - `trace_path`: trace the execution path from entrypoint (route/button) to DB.
   - Identify existing DB tables, columns, relations, and enums.

2. **Git Archeology & Business Intent Mining**:
   - `git log --oneline -25 -- <feature_files>`: extract the feature's evolution and all related commit messages (e.g. `feat(payroll): connect cycles...`, `refactor: clean redirects`).
   - `git log --all --grep="AB#" --oneline`: find linked User Stories and historical Bugs that touched this module.
   - `git blame -L <start>,<end> <file>` on key business logic: uncover why magic numbers, legal formulas, or regulatory rates were set (e.g., discovering `salario / 23.83 / 8` comes from MT Labor Code, or TSS `2.87% / 3.04%` from Law 87-01).
   - `git log -S "<keyword>"`: trace when and why specific business rules or validations were added or modified.
   - **CRITICAL ANTI-DISPARATE RULE (Bug != Feature)**:
     - Commits with `fix(AB#...)` or branches `fix/AB#...` are **BUGS**, NOT the Feature itself!
     - The agent SHALL NEVER put Bug IDs in the `Work Item:` header of a spec.
     - Bug IDs from git history belong STRICTLY in an optional context section: `### Bugs Históricos Resueltos en este Módulo (Contexto)`.
     - The `Work Item:` header MUST only contain an Epic, Feature, or User Story/PBI ID. If none exists in ADO, set `Work Item: Pendiente (Sin PBI / Feature asignado aún en ADO)`.

3. Combine both sources to reconstruct the original functional intent, edge case fixes, and unwritten domain rules.

### Step 2: Generate `requirements.md` (As-Built)
1. Use `requirements-template.md`.
2. Set header: `> 📋 As-Built Specification — Reverse-engineered from codebase and git history [commit hash]`.
3. Express existing business logic in formal EARS notation:
   - What the system *already does* today.
   - Domain rules justified by git commit history and PR references.
   - Known limitations or unhandled edge cases observed in code.
4. Document existing acceptance criteria verified in the code and past bug fixes.
5. PROPOSE to human for validation: "This is what the code and git history show the feature currently does. Does this match expectations?"

### Step 3: Generate `design.md` (As-Built)
1. Use `design-template.md`.
2. Document real architecture, component hierarchy, and database schemas as they exist.
3. Mermaid diagrams of the real component tree and database entity-relationships.
4. Document all existing endpoints, methods, payload structures, and external integrations discovered via graph and git.

### Step 4: Generate `tasks.md` (Gaps & Hardening)
1. The tasks for an existing module are NOT "build from scratch". They are:
   - Missing unit tests for critical business logic.
   - Playwright E2E tests for happy and edge paths.
   - Technical debt or refactoring tasks identified during mining.
   - Missing input validations or error boundaries.

---

## Mode 3: Hybrid Spec (Extending Existing Modules)

When adding a new sub-feature to an already functioning module (e.g., adding *Dispersión Bancaria* to an existing *Payroll* module):

1. **Phase 1: Map the Foundation (Existing)**:
   - Identify which existing tables, endpoints, and states the new sub-feature depends on (e.g., `payroll_cycles`, `employee_payrolls`, `disbursement_status`).
   - Note them in the `Dependencies` and `Assumptions` section of the new spec.
2. **Phase 2: Forward Spec for the New Sub-Feature**:
   - Follow **Mode 1** strictly for the new sub-feature:
     - `requirements.md` focusing on the new capability (bank file layouts, disbursement states, validations).
     - `design.md` defining new endpoints, file generator architecture, and UI.
     - `tasks.md` broken into waves.
3. **NEVER jump to code** before completing Phase 2.

---

## Spec Granularity & Macro-Feature Decomposition Protocol (Anti-Monolith Rule)

### When to Decompose a Macro-Feature
A specification represents a coherent, reviewable, and testable unit of functionality.
When documenting or planning a **Macro-Feature / Full Domain Module** (e.g. *Nómina Completa*, *Facturación Electrónica*, *Gestión de Inventario*), **DO NOT create a single monolithic `requirements.md`** mixing multiple unrelated business sub-domains.

Criteria requiring decomposition:
- The module covers more than 2 distinct business workflows or regulatory domains (e.g. TSS vs DGII vs ACH Bancario).
- The module spans multiple distinct frontend screens or URL paths.
- The module has separate state machines or independent database entity clusters.

### Modular Spec Structure for Macro-Features
```text
specs/{module-name}/
├── 01-{sub-feature-a}/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── 02-{sub-feature-b}/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
└── ...
```

### Execution Strategy: One Sub-feature at a Time (Hard Gate 2)
1. **Step 0 — Propose Modular Breakdown**: The agent lists all proposed sub-features with clear boundaries and asks for approval of the decomposition.
2. **Execute Sub-feature by Sub-feature**: Start with Sub-feature 1. Follow the full lifecycle (`requirements.md` ➔ approval ➔ `design.md` ➔ approval ➔ `tasks.md`).
3. NEVER generate specs for subsequent sub-features until the active one is approved.

---

## Explicit Human Approval & Stamp Protocol (Hard Gates 1, 10 & 13)

- **Approval MUST BE EXPLICIT**: The agent SHALL NEVER assume approval based on general continuation, follow-up questions, or feedback comments.
- **Valid Approval Keywords**: "Approved", "Aprobado", "Acepto", "Proceder con el diseño", "Adelante con tasks", "LGTM".
- **Invalid Signals**: "continúa", "¿por qué hiciste X?", "¿qué opinas de Y?", or silence.
- If the human asks a question, points out a bug, or raises a concern: **STOP IMMEDIATELY**. Address the question, provide clarifications, and **WAIT** for explicit approval. **NEVER advance to the next artifact (`design.md` or `tasks.md`) without explicit confirmation.**

### Mandatory 2-Step Approval Stamp Workflow (Hard Gate 13)
When explicit human approval is received:
1. **Step 1: Stamp the Upstream Artifact (MANDATORY BEFORE ADVANCING)**:
   - The agent MUST immediately edit the approved artifact's header.
   - Replace `> ✅ Approved by: [pending]` with the actual human approver's name and ISO date:
     `> ✅ Approved by: [Approver Name / Role] · [YYYY-MM-DD]` (e.g. `> ✅ Approved by: Jeremy Michel Solano Frías · 2026-10-08`).
   - Save or commit this stamped update.
2. **Step 2: Generate the Downstream Artifact**:
   - ONLY after Step 1 is completed may the agent load the next template and draft the downstream artifact (`design.md` or `tasks.md`).
   - **STRICT PROHIBITION**: The agent SHALL NEVER generate `design.md` while `requirements.md` still contains `[pending]`. The agent SHALL NEVER generate `tasks.md` while `design.md` still contains `[pending]`. The agent SHALL NEVER write code while `tasks.md` still contains `[pending]`.

---

## Exhaustive Engineering Depth & Anti-Superficiality Protocol (Hard Gate 12)

Every document generated by an agent (`requirements.md`, `design.md`, `tasks.md`, `docs/architecture/*.md`, `docs/modules/*.md`) MUST provide complete, exhaustive engineering depth. Superficiality, hand-waving, and placeholders are strictly prohibited.

### 1. Mandatory Depth Standards per Artifact

| Artifact | Superficial (REJECTED) ❌ | Detailed & Production-Grade (REQUIRED) ✅ |
| :--- | :--- | :--- |
| **Requirements (`requirements.md`)** | "The system calculates statutory social security and taxes according to labor law." | Formal EARS clauses (`WHEN... SHALL...`), exact tax scales (e.g. DGII: 15%, 20%, 25%), social security percentages (e.g. AFP 2.87%, SFS 3.04%), daily rate divisors (`salary / 23.83 / 8`), statutory overtime multipliers (35% and 100%), and boundary conditions (`start_date <= end_date`, Half-Up rounding). |
| **Design (`design.md`)** | "There will be a table for cycles and an endpoint to create them." | Complete PostgreSQL DDL (`CREATE TABLE huro.payroll_cycles (...)`) with exact SQL column types (`NUMERIC(12,2)`, `UUID`, `TIMESTAMPTZ`), default values, primary/foreign key constraints, and indexing strategy. Full REST API contract with HTTP method, path, required headers (`Idempotency-Key`), JSON Request payload, 200/201 Success JSON, and RFC 7807 error responses (400, 404, 409). |
| **Architecture (`docs/architecture/`)** | Generic 3-box diagrams ("Frontend -> Backend -> DB"). | Full C4 Container Mermaid diagram with external actors (e.g. Tax Agency, Banking Portals), layer responsibilities table, multi-tenant logical/RLS isolation strategy, complete RBAC matrix with granular permissions, and concrete environment matrices. |
| **Module Living Docs (`docs/modules/`)** | 2-paragraph high-level overview. | Full Capabilities Matrix with sub-feature states, module-specific Mermaid ERD with cardinalities, Master API Catalog with all route definitions, domain business rules catalog, and migration/versioning notes. |
| **UI / UX Design (`DESIGN.md` / `design.md`)** | "Default white shadcn layout with blue buttons and generic cards." | Master `DESIGN.md` tokens: Semantic dual-mode palette (Canvas, Surface, Inset, Text), 'No-Line' layout rule (tonal background shifts, 8% ghost borders), typographic triad (Display, Sans, Monospace for numbers/codes), responsive shell with dynamic 240px➔64px sidebar, soft tinted status pills (`bg-emerald-50 text-emerald-700`), and interactive state matrices. |
| **Tasks (`tasks.md`)** | "Build cycles backend." | Granular sub-tasks (max 4h) with specific file paths (`src/services/...`), exact test verification commands (`pnpm test:unit cycles.test.ts`), and expected assertions. |

### 2. Prohibited Anti-Patterns (Automatic Quality Rejection)
1. **The "Etc." Anti-Pattern**: Writing "... and other fields", "etc.", or leaving attribute lists truncated.
2. **The Placeholder Anti-Pattern**: Leaving `[TODO: Complete later]`, `[TBD]`, or unexpanded bracket placeholders.
3. **The Omitted Payload Anti-Pattern**: Listing an API endpoint without providing its complete JSON request and response structure.
4. **The Ambiguous Formula Anti-Pattern**: Saying "calculated according to standard rules" without writing out the exact mathematical formula.

---

## Anti-Cascading Approval Protocol (Hard Gate 14)

1. **Strict 1:1 Target Mapping**: Every single specification phase requires an INDEPENDENT, EXPLICIT human approval.
   - User approves `requirements.md` ➔ Agent stamps ONLY `requirements.md`.
   - Agent generates `design.md` and STOPS immediately at Hard Gate 1.
   - User approves `design.md` ➔ Agent stamps ONLY `design.md`.
   - Agent generates `tasks.md` and STOPS immediately at Hard Gate 1.
   - User approves `tasks.md` ➔ Agent stamps ONLY `tasks.md`.

2. **The "Cascading Fallacy" (STRICTLY PROHIBITED)**:
   - The agent SHALL NEVER interpret approval of `requirements.md` as an implicit approval of `design.md`.
   - The agent SHALL NEVER interpret colloquial expressions ("dale", "procede", "continúa", "ok", "avanza") as multi-artifact approvals. If the agent asked *"¿Apruebas requirements.md para pasar al diseño?"* and the user said *"dale"*, that approval applies EXCLUSIVELY to `requirements.md`.
   - The agent SHALL NEVER stamp the human's signature (`> ✅ Approved by: ...`) on an artifact that was not explicitly presented, reviewed, and approved on its own turn.

---

## UTF-8 Encoding & Anti-Mojibake Protocol (Hard Gate 15)

1. **Zero-Tolerance for Mojibake**: Documentation containing accented characters (ó, í, á, é, ú, ñ) or special symbols MUST retain 100% clean UTF-8 encoding.
2. **Safe Mutation Tooling**:
   - Always use native IDE tools (`replace_file_content`, `write_to_file`).
   - If running terminal commands, NEVER use raw PowerShell stream redirections (`>` or `>>`) or `Set-Content` without `-Encoding utf8`. Use Node.js (`fs.writeFileSync`) with `'utf8'` if command-line text transformation is required.

---

## Anti-Generic UI & Enterprise Design System Protocol (Hard Gate 17)

Every user-facing frontend application or module MUST adhere to an explicit, enterprise-grade Design System rather than defaulting to generic Bootstrap, unstyled HTML, or flat-white component dumps:

1. **Master Design System Specification (`DESIGN.md`)**:
   - Before scaffolding or implementing UI components in Wave 0 / Wave 3, the project MUST define or follow a master design system specification: `DESIGN.md` in the repository root or `docs/architecture/design-system.md` (based on `specs/_templates/design-system-template.md`).
   - The specification MUST document:
     - **Theme Identity & Persona**: Deliberate design narrative (e.g. Institutional Authority, FinTech High-Density).
     - **Semantic Dual-Mode Tokens**: Canvas Base, Surface Card, Surface Inset, Text Primary/Secondary, Accents, and Ghost Borders for both Light and Dark mode.
     - **The "No-Line" Layout Rule**: Eliminating harsh 1px black divider lines; separating panels via background tonal shifts (`#F9F9FF` vs `#F2F3FF` vs `#FFFFFF`) and diffuse elevation shadows (`shadow-sm shadow-slate-900/5`).
     - **Typographic Triad**:
       * *Display Font* (Manrope / Plus Jakarta Sans) for branding, H1/H2 titles.
       * *Body & UI Font* (Inter / Geist Sans) for forms, navigation, labels.
       * *Monospace Font* (JetBrains Mono / Geist Mono) for entity codes, national IDs, and right-aligned tabular currency figures.
     - **Layout Shell Specifications**:
       * Left Sidebar with dynamic width transitions (240px expanded ➔ 64px collapsed), 4px left vertical active indicator bar, and +2px horizontal hover micro-translation.
       * Top Header (64px) with dynamic breadcrumbs, quick-search trigger (`Cmd+K`), and role preview simulator.
     - **Component Specifications**:
       * Soft status pills (`bg-emerald-50 text-emerald-700 border-emerald-200`) with dot indicators, rather than aggressive solid primary blocks.
       * Dense data tables with fixed column alignment and sticky pagination footer.
     - **Tailwind Config Blueprint**: Exact token exports to `tailwind.config.ts`.

2. **Integration into Feature Designs**:
   - Every feature `design.md` that touches the frontend MUST include the `## UI / UX & Frontend Design` section mapping feature views directly to the tokens and layout patterns of `DESIGN.md`.

---

## What the Agent NEVER Does
- NEVER skips `requirements.md` to start coding immediately because "it seems simple".
- NEVER generates `design.md` before `requirements.md` is explicitly approved.
- NEVER generates `tasks.md` before `design.md` is explicitly approved.
- NEVER starts implementation before `tasks.md` is explicitly approved.
- NEVER invents sections outside the official templates.
- NEVER puts Bug IDs as the primary Work Item or identity of a spec (Bug != Feature).
- NEVER dumps an entire multi-workflow macro-feature into a single monolithic spec file without modular decomposition.
- NEVER advances to the next phase when the user asks a question or reports an issue.
- NEVER generates superficial, hand-wavy, or placeholder-ridden documentation without exhaustive technical detail (Hard Gate 12).
- NEVER leaves "> ✅ Approved by: [pending]" in an upstream artifact when advancing to the downstream phase (Hard Gate 13).
- NEVER cascades approval from one artifact to another without independent review (Hard Gate 14).
- NEVER uses non-UTF-8 stream redirections or commands that introduce mojibake or corrupt character encodings (Hard Gate 15).
- NEVER updates `docs/modules/{module}.md` without synchronizing all 3 master diagrams (State Machine, Flowchart, ERD) (Hard Gate 16).
- NEVER implements frontend UI components or screens without referencing a defined Design System (`DESIGN.md`) or produces generic, unstyled Bootstrap/shadcn boilerplate (Hard Gate 17).
