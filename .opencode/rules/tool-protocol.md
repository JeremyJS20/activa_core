# Tool Protocol — MANDATORY MCP usage (automatic, without user asking)

> The agent knows when to use each tool WITHOUT the user telling it.
> The user NEVER says "use codebase-memory" or "save to memory". The agent does it by itself.
> server-memory and codebase-memory are NOT optional helpers — they are MANDATORY checkpoints.

## Mandatory checkpoints

These calls are REQUIRED at these moments. Skipping them is a protocol violation.

| Moment | MCP | Required call | Must show to user |
|--------|-----|---------------|-------------------|
| Session start | server-memory | `read_graph` or `search_nodes` (project, module) | "🧠 Memoria: N entidades (X Decisions, Y Corrections, Z BugFixes)" or "vacía" |
| Session start | codebase-memory | `list_projects` / `index_status` → index if missing or stale | "🗺️ Grafo: indexado (N nodos)" or "indexando…" |
| Before reading any source file | codebase-memory | `search_graph` → `get_code_snippet` | — |
| Before changing a function/component | codebase-memory | `trace_path(direction="inbound")` | List of callers |
| Before fixing a bug | server-memory | `search_nodes` for module → Corrections, BugFixes | Applicable memory or "none" |
| After a technical decision | server-memory | `create_entities` (Decision) | "🧠 Guardado: Decision [name]" |
| After fixing a bug | server-memory | `create_entities` (BugFix) | "🧠 Guardado: BugFix AB#XXXX" |
| After a correction / Reopen / user correction | server-memory | `create_entities` (Correction) | "🧠 Guardado: Correction [name]" |
| After discovering a convention | server-memory | `create_entities` (Convention) | "🧠 Guardado: Convention [name]" |
| Before ending the session | server-memory | `add_observations` with session summary on active AB# | — |

## server-memory → ALWAYS FIRST, ALWAYS WRITE BACK

### Read protocol (session start and before each task)
1. `search_nodes` with: project name, module name, AB# in context
2. `open_nodes` on relevant results
3. Apply what you find: do NOT re-discover a convention, do NOT repeat a corrected mistake, do NOT contradict a recorded decision without new information (anti-flip-flop)
4. Report what was loaded (see table above). If empty: say so — empty memory is normal on first sessions, NOT a reason to stop using it

### Write protocol (the part most often skipped)
Memory is only useful if it is written. The agent MUST write at the moments in the checkpoint table.

Entity types and required observations:

| Entity type | Name format | Observations (one fact per observation) |
|-------------|-------------|------------------------------------------|
| `Decision` | `decision-<topic>` | what was decided · why · alternatives rejected · date · AB# |
| `Convention` | `convention-<topic>` | the pattern · where it applies · example file |
| `Correction` | `correction-<topic>` | what was wrong · why it happened · correct approach · AB# |
| `BugFix` | `bugfix-AB#XXXX` | module · root cause · fix summary · files changed · tests added · risk level |
| `Module` | `module-<name>` | purpose · key files · known fragile areas · related BugFixes |

Relations (`create_relations`):
- `BugFix` → `affects` → `Module`
- `Correction` → `corrects` → `BugFix` / `Decision`
- `BugFix` → `regression_of` → `BugFix` (when a fix broke something that was fixed before)

Rules:
- One fact per observation — short, specific, searchable
- Include the AB# whenever there is one
- NEVER store secrets, PATs, passwords, personal data
- If an entity exists → `add_observations`, do NOT create a duplicate

## codebase-memory → BEFORE grep/glob/reading files (MANDATORY)

### Index check (session start)
1. `list_projects` → is the current repo indexed?
2. Not indexed → `index_repository` (tell the user it is indexing)
3. Indexed → `index_status` / `detect_changes` → if stale (new commits since last index) → re-index
4. NEVER silently fall back to grep because the project is not indexed — index it

### Usage
| Need | Call |
|------|------|
| Find a function, class, component, route | `search_graph(name_pattern=...)` |
| Read source of a symbol | `get_code_snippet(qualified_name=...)` — NOT reading the whole file |
| Who calls this? (impact analysis) | `trace_path(direction="inbound")` |
| What does this call? | `trace_path(direction="outbound")` |
| Complex patterns | `query_graph` (Cypher) |
| Project overview | `get_architecture` |
| Text search inside code | `search_code` |

### When grep/glob IS allowed
- String literals, error messages, config values, non-code files (Dockerfile, YAML, .env.example, SQL scripts)
- codebase-memory returned no results → state it explicitly: "codebase-memory: sin resultados para X → fallback grep"
- Never as the first option for code discovery

## azure-devops → work items, PRs, pipelines (when integrated)
- **Applicability**: Active only when Azure DevOps is configured (`host: "azure"`). In standalone/local mode (`host: "none"`), this tool is skipped and requirements are drawn from local files, interviews, or Git issues.
- **Session start**: read assigned items in current sprint + active cortes (see `qa-corte-workflow.md`)
- **Before working an AB#**: read WI + ALL linked WIs
- **Before fixing a bug**: search resolved Bugs in the same area (see `bug-fix-protocol.md` Phase 1)
- **After PR**: link PR to WI, move to Fixed (with approval)
- NEVER create work items (developer receives, does not report). NEVER close WIs without approval

## sequential-thinking → complex problems
- **When**: root cause not obvious, architecture, impact analysis with risk MEDIO/ALTO, multi-step planning
- NOT for trivial changes

## context7 → library/framework docs
- **When**: need docs for an external library (resolve-library-id → query-docs)
- NOT for project code. NOT for things you already know

## playwright → E2E, smoke tests
- **When**: UI bug repro (Phase 2), local smoke test before PR (Phase 5.1), smoke test in DEV/QA after deploy (Phase 7)
- NOT for unit tests or pure API tests

## github → PRs, Actions (dual CI/CD)
- **When**: project hosts code or CI on GitHub (PRs, Actions status, pipeline verification)

## stitch → UI generation
- **When**: designing new UI screens or design systems. NOT for backend

## Priority order for finding information
1. **server-memory** — decisions, conventions, corrections, past bug fixes
2. **codebase-memory** — code structure, symbols, callers
3. **azure-devops / local specs** — requirements, linked WIs, resolved bugs (ADO if configured; otherwise local PRDs or git issues)
4. **git history** — `git log`, `git blame` on affected files
5. **Read project files** — only what memory and the graph could not answer
6. **context7** — external library docs

## File Mutations & UTF-8 Clean Encoding Directive (MANDATORY)
- **Zero-Mojibake Rule**: All files containing non-ASCII characters (Spanish accents: á, é, í, ó, ú, ñ, or currency/mathematical symbols) MUST retain 100% clean UTF-8 encoding.
- **Forbidden Windows PowerShell Redirection**:
  - NEVER use PowerShell stream redirection operators (`>` or `>>`) to generate or edit text files on Windows (PowerShell 5.1 defaults to UTF-16LE / ANSI, producing immediate mojibake corruption).
  - NEVER use `Set-Content` without explicit `-Encoding utf8`.
- **Approved File Mutation Tooling**:
  - ALWAYS prefer native IDE editing tools (`replace_file_content`, `write_to_file`).
  - For command-line edits or scripting, use Node.js (`fs.readFileSync(file, 'utf8')`, `fs.writeFileSync(file, content, 'utf8')`).

## Tool discipline
- NEVER skip a mandatory checkpoint
- NEVER use grep for code discovery before codebase-memory
- NEVER finish a task that produced a decision, fix or correction without writing it to server-memory
- NEVER call azure-devops without an AB# or a sprint/corte query purpose
- NEVER call context7 if you already know the answer
- NEVER call playwright if there is no UI to test
- NEVER use non-UTF-8 stream redirections that corrupt text files with mojibake
