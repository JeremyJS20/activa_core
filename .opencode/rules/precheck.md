# Precheck — 6-step first interaction (mandatory)

> This check is MANDATORY before any action.
> If any step fails, DO NOT proceed. Notify the human and explain what is missing.

## Step 1: Memory read
Use server-memory to load context from previous sessions:
- `search_nodes` for the project, the module and any AB# in context → `open_nodes` on results
- Load entity types: `Decision`, `Convention`, `Correction`, `BugFix`, `Module`
- **Report to user**: "🧠 Memoria: N entidades (X Decisions, Y Corrections, Z BugFixes)" or "🧠 Memoria vacía (primera sesión)"
- If memory is empty (first session): OK, proceed — and START WRITING to it (see `tool-protocol.md` §Write protocol)
- If memory has data: use that context in all subsequent decisions
- NEVER repeat a decision that is already in memory without new information

## Step 2: Git identity
Verify git has user.name and user.email configured:
- `git config user.name` and `git config user.email`
- If not configured locally, check global: `git config --global user.name`
- If no identity: notify human "Configure git identity before proceeding"
- DO NOT continue without git identity (commits need an author)

## Step 3: MCP health check + codebase index
Verify MCP servers are connected and responding:
- **server-memory**: try reading entities. If responds: OK. If not: CRITICAL ERROR.
- **codebase-memory**: `list_projects`.
  - Not responding → warn (limits capability but does not block)
  - Responding but repo NOT indexed → run `index_repository` now (tell the user)
  - Indexed but stale (new commits since last index, check with `index_status` / `detect_changes`) → re-index
  - **Report**: "🗺️ Grafo: indexado (N nodos)" / "indexando…" / "no disponible"
- **azure-devops**: if configured (host != "none" and org is set), try list_projects. If responds: OK. If not: warn "Azure DevOps not available — cannot read work items automatically". If host is "none" or standalone mode: skip (standalone/local mode active).
- **context7**: no check needed (on-demand).
- **sequential-thinking**: no check needed (on-demand).
- **github**: no check needed (on-demand).
- **playwright**: no check needed (on-demand).
- **stitch**: no check needed (on-demand).

## Step 4: Project type detection
Read project configuration:
- `.sdd-config.json` → role, ides, spec_prefix, azure_devops_org, azure_devops_project, wi_states, wi_types, app_dir (if configured)
- Look for manifest in repo root OR inside `app_dir` (e.g. `app/`, `apps/*/`, `src/`):
  - `package.json` → Node.js/TypeScript/JavaScript
  - `requirements.txt` or `pyproject.toml` → Python
  - `pubspec.yaml` → Flutter/Dart
  - `go.mod` → Go
  - `Cargo.toml` → Rust
  - `composer.json` → PHP
- Check for `docs/requirements/functional-packages/` directory
  - If exists: note "Functional Packages detected — agent will use these as PRIMARY entry point for features"
- If stack not detected: warn "Stack not detected. Specify your stack manually."

## Step 5: Code presence & lifecycle detection (Brownfield vs Greenfield)
Verify if the repo contains existing application code or is a new project from scratch.

**Use codebase-memory FIRST** — do NOT use glob/grep before codebase-memory.

1. If codebase-memory IS available (Step 3 OK):
   - Call `codebase-memory get_architecture` for the current project
   - If codebase-memory returns nodes (functions, classes, files) → **Brownfield project** (existing code present) → OK
   - If codebase-memory is empty but source files exist → warn "Code exists but is not indexed in codebase-memory. Run index_repository." → **Brownfield project**
2. If codebase-memory is NOT available (Step 3 warned):
   - Fall back to glob for source files: `*.py`, `*.ts`, `*.js`, `*.go`, `*.rs`, `*.dart`, `*.java`, `*.cs`, `*.php`, `*.rb`, `*.kt`, `*.swift`
   - Check source directories: `src/`, `lib/`, `app/`, `cmd/`, `internal/`, `pkg/`, `tests/`, `test/`
   - If source files found → **Brownfield project** (existing code present) → OK
3. If codebase-memory is empty AND no source files found:
   - Detect as **🌱 Greenfield Project (Project from scratch)**:
     - The workspace is ready to bootstrap a new application from scratch using SDD!
     - Report: "🌱 Modo Greenfield detectado: proyecto nuevo desde cero. Listo para definir arquitectura inicial, especificaciones y Wave 0 (scaffolding)."
     - **DO NOT BLOCK!** Route to Greenfield Project Inception flow (see `workflow-router.md`).
     - Allowed in Greenfield: project architecture, stack selection, Forward specs, Wave 0 scaffolding execution (with approval).
     - Prohibited in Greenfield: bug fixes (no code exists to fix).

EXCLUDE from this check: `.opencode/`, `.agents/`, `.kiro/`, `.claude/`, `.sdd-memory/`, `specs/`, `.sdd-config.json`, `opencode.json`, `sdd-init.sh`

## Step 6: Readiness verification
Verify all above is OK:
- Memory: OK or empty (first session) → OK
- Git identity: OK → OK. If not → BLOCK
- MCP health: server-memory OK → OK. codebase-memory and azure-devops: warn but do not block
- Project type: detected (Brownfield) OR Greenfield (new project) → OK
- If all OK: "Precheck completed. Ready to proceed." (indicate Brownfield or Greenfield)
- If something fails (e.g. no git identity): "Precheck failed at step X. [explanation]. Cannot proceed until resolved."

## What NEVER to do during precheck
- DO NOT present "explore codebase" as an option to the user — that is automatic
- DO NOT present "load context into memory" as an option — that is automatic
- DO NOT skip precheck even if the user says "just do it fast"
- DO NOT omit precheck steps
