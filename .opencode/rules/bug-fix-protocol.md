# Bug Fix Protocol — evidence-based fixes, no regressions

> A bug is NOT fixed until there is verifiable evidence that:
> (1) the root cause is fixed, (2) nothing else broke, (3) the fix is visible in the target environment.
> The agent NEVER declares "fixed" based on reasoning alone. Evidence or it did not happen.

## Why this exists

Common failure modes this protocol prevents:

| Failure | Root cause | Phase that prevents it |
|---------|-----------|------------------------|
| Fix is incomplete | Symptom fixed, not root cause. Not validated against repro steps / acceptance criteria | Phase 2 (Reproduce) + Phase 5 (Verify) |
| Fix breaks something else | Callers of the changed code not analyzed or tested | Phase 3 (Impact) + Phase 5 (Verify) |
| "Fixed but QA doesn't see it" | Branch not merged, deploy not run, migration/env var/cache missing | Phase 7 (Deployment verification) |
| Same bug comes back | No regression test, no memory of past fix | Phase 2 (failing test) + Phase 8 (Learn) |

## Phase 1: Investigate (before touching code)

The agent MUST gather all of the following before proposing any fix:

1. **Work item context** (azure-devops): title, description, repro steps, expected vs actual, severity, attachments, ALL linked WIs (Data Dictionary, Structure, Business Rule, parent HU)
2. **Memory** (server-memory): search for entities related to the module/feature
   - `Correction` entities → past mistakes in this area
   - `BugFix` entities → previous fixes in this module
   - `Decision` / `Convention` entities → constraints that apply
3. **Code location** (codebase-memory): `search_graph` for the functions/components involved → `get_code_snippet` to read them. NOT grep, NOT reading full files
4. **Git history** of the affected files:
   - `git log --oneline -15 -- <file>` → who changed it recently and why
   - `git log --all --oneline --grep="<module or keyword>"` → previous fixes in this area
   - `git blame -L <start>,<end> <file>` → origin of the faulty lines
5. **Similar resolved bugs** (azure-devops): search Bugs in the same area/module with state Done → read how they were fixed
6. **Regression check**: Did a recent commit introduce this? If yes → link to the original WI and mention it in the analysis

**Output of Phase 1** (present to human):
```
🔍 Análisis — AB#XXXX
Síntoma: [what the user sees]
Causa raíz: [why it happens — file:line, logic]
Origen: [commit/PR that introduced it, or "pre-existing"]
Bugs relacionados: [AB#YYYY (Done) — same module, fixed by ...]
Memoria aplicable: [Corrections/Decisions found, or "none"]
```

If root cause is NOT clear → STOP. Do not guess. Ask for more info (logs, screenshots, data) or propose a diagnostic step.

## Phase 2: Reproduce first

- Write a **failing test** that reproduces the bug BEFORE writing the fix
  - Logic/backend bug → unit or integration test
  - UI bug → Playwright E2E following the repro steps (if E2E infra exists)
- Run it → confirm it FAILS for the right reason
- If the bug cannot be reproduced → STOP and ask. NEVER fix blind.
- If the project has no test infrastructure → document manual repro steps executed and flag "no automated test infra" as a risk

## Phase 3: Impact analysis (before the fix)

1. **Inbound trace** (codebase-memory): `trace_path(function_name=<fn to change>, direction="inbound")` → every caller
2. **Outbound trace** if changing return types, side effects or shared state
3. Identify shared code: utils, hooks, services, DB queries, stored procedures, shared components used in multiple screens
4. List affected features/screens

**Output of Phase 3** (present to human BEFORE implementing):
```
⚠️ Impacto — AB#XXXX
Función/componente a cambiar: [name]
Callers: [N] → [list of modules/screens]
Funcionalidades que podrían verse afectadas: [list]
Riesgo: BAJO / MEDIO / ALTO
Plan de regresión: [which tests will cover the affected callers]
```

Risk levels:
- **BAJO**: change is local, 0–2 callers, no shared state
- **MEDIO**: 3+ callers OR shared utility OR DB query change
- **ALTO**: shared core logic, auth, calculations, money, data migration, or 10+ callers → requires explicit human acknowledgment

## Phase 4: Fix (minimal and scoped)

- Fix the ROOT CAUSE, not the symptom
- Minimal diff — do NOT refactor unrelated code in a bug fix
- Do NOT change behavior of callers that are not part of the bug
- If the correct fix requires changing functional behavior → Functional Escalation Protocol (see `azure-devops-workflow.md`)
- PROPOSE the diff → wait for approval → implement

## Phase 5: Verify (proportional to severity and risk)

| Check | When required |
|-------|---------------|
| Phase 2 test now PASSES | ALWAYS |
| Existing test suite of the affected module passes | ALWAYS |
| Lint + type-check pass | ALWAYS |
| Tests covering each caller from Phase 3 | Risk MEDIO or ALTO |
| New unit tests for uncovered callers | Risk MEDIO or ALTO and caller has no tests |
| **Local smoke test** (Playwright against local app, see §5.1) | UI bug, OR any bug with UI impact (risk MEDIO/ALTO) |
| Playwright E2E suite following repro steps | UI bug, OR risk ALTO with UI impact (if E2E infra exists) |
| Full test suite | Risk ALTO |
| Validate against acceptance criteria of the WI / parent HU | ALWAYS — "no error" is NOT the same as "correct" |

If any check fails → back to Phase 4. NEVER propose the PR with failing checks.

### 5.1 Local smoke test (before the PR)

Verifies the fix works in a running app and the affected screens still work. Does NOT replace DEV/QA verification (Phase 7) — local cannot detect missing migrations, env vars or flags in other environments.

1. **Resolve local config** from `.sdd-config.json` → `environments.local`:
   - `url` (e.g., `http://localhost:3000`) and `start_command` (e.g., `npm run dev`)
   - If empty → detect from the stack: `package.json` scripts (`dev`, `start`), framework defaults (Vite 5173, Next/CRA 3000, Angular 4200, Django 8000, Flask 5000, Rails 3000, .NET launchSettings.json), `docker-compose.yml` ports. PROPOSE the detected values → wait for confirmation → save them as a `Convention` in server-memory
2. **Check if already running**: probe the URL. If it responds → reuse it, do NOT start a second instance
3. **Start the app** in the background with `start_command` → wait until the URL responds (timeout ~120s). If it fails to start → report the error, do NOT continue
4. **Run Playwright against the local URL**:
   - The repro steps from the WI → the bug no longer happens
   - The expected behavior / acceptance criteria → correct result, not just "no error"
   - Each affected screen from Phase 3 (callers with UI) → still works
   - Capture a screenshot of the fixed scenario → attach/reference it in the evidence report
5. **Stop the app** if the agent started it (never kill a server the user was already running)
6. Local data: use seed/test data. NEVER point the local app to the QA or prod database to run the smoke test

If the app cannot run locally (missing secrets, external dependencies, no local DB) → flag "local smoke test not possible: [reason]" in the evidence report and rely on DEV verification (Phase 7.1).

## Phase 6: Confidence gate (evidence report)

The agent does NOT create the PR or move the WI to Fixed until this report is complete. The report goes in the PR body:

```
## 🐛 Bug Fix Evidence — AB#XXXX

**Causa raíz:** [explanation]
**Origen:** [commit/PR or "pre-existing"]

**Reproducción:** ✅ [test name] — failed before, passes after
**Impacto revisado:** [N callers] — [modules]  · Riesgo: [BAJO/MEDIO/ALTO]

**Tests:**
- Unit/integration: [N passed / N total]
- Regresión (callers): [N passed] / no aplica
- E2E Playwright: [scenario] ✅ / no aplica / sin infra E2E (riesgo)
- Smoke test local: ✅ [url] — [screens checked] (screenshot) / no aplica / no posible: [reason]
- Criterios de aceptación validados: [list]

**Requisitos de despliegue:** [migrations / env vars / feature flags / cache / none]
**Riesgos conocidos:** [list or "ninguno"]
```

Any ⚠️ or "sin infra" item must be explicitly acknowledged by the human.

## Phase 7: Deployment verification — DEV and QA ("fixed but I don't see it")

Code being correct is not enough. The fix must be verified in EACH environment it reaches.
Environment branches and URLs come from `.sdd-config.json` → `environments` (see below).
Prod has its own flow (see `qa-corte-workflow.md` §Production release flow).

### 7.1 DEV environment (after PR merged to `develop`)

1. **PR merged** — not just created
2. **Branch check**: `git branch -r --contains <fix-commit>` → includes `origin/develop`
3. **Pipeline**: CI/CD for DEV ran and succeeded after the merge
4. **Deploy requirements** (from Phase 6) applied in DEV: migrations, env vars, feature flags, cache
5. **Smoke test**: if UI and `environments.dev.url` known → Playwright check of the fixed scenario on DEV
6. Notify: "AB#XXXX verified in DEV"

### 7.2 QA environment (after release/corte merged to `qa`)

1. **Included in the release**: the fix commit is in `release/corte-DD-MM-YYYY` (verified during the corte audit — see `qa-corte-workflow.md`)
2. **Release PR merged** to `qa`
3. **Branch check**: `git branch -r --contains <fix-commit>` → includes `origin/qa`
4. **Pipeline**: CI/CD for QA ran and succeeded after the merge
5. **Environment parity** (most common cause of "works in DEV, not in QA"):
   - Migrations applied in the QA database (not only DEV)
   - Env vars / secrets set in the QA environment (not only DEV)
   - Feature flags enabled in QA
   - Seed / reference data required by the fix exists in QA
   - CDN / browser / server caches invalidated
6. **Smoke test**: if UI and `environments.qa.url` known → Playwright check of the fixed scenario on QA
7. Notify: "AB#XXXX verified in QA — ready for QA validation"

If any step fails → report exactly which step and environment to the human. NEVER say "it should be there".

### Environment configuration (`.sdd-config.json`)

```json
"environments": {
  "local": { "url": "http://localhost:3000", "start_command": "npm run dev" },
  "dev":   { "branch": "develop", "url": "" },
  "qa":    { "branch": "qa",      "url": "" },
  "prod":  { "branch": "main",    "url": "" }
}
```

- `local` → used by Phase 5.1 (smoke test before PR). Empty → agent detects from the stack and asks to confirm
- `dev` / `qa` → used by Phase 7 (deployment verification)

If a URL is empty → skip the smoke test and flag "no environment URL configured" in the evidence report.

## Phase 8: Learn (server-memory)

After every fix, WRITE to server-memory (see `tool-protocol.md` §server-memory write protocol):
- `BugFix` entity: module, root cause, fix summary, files, AB#
- If the bug was a regression → `Correction` entity linking the original change and why it broke

When QA **Reopens** a bug:
1. Read the QA comment / new evidence
2. Write a `Correction` entity: what the previous fix missed and why
3. Restart from Phase 1 — do NOT patch on top of the previous fix without re-analysis
4. Re-read related `Correction` entities before proposing the new fix

## What the agent NEVER does

- NEVER declares "fixed" without the Phase 6 evidence report
- NEVER fixes without reproducing (or explicitly flagging that it could not)
- NEVER skips impact analysis because "the change is small"
- NEVER uses grep to find callers when codebase-memory is available
- NEVER says "ready for QA" without Phase 7 deployment verification
- NEVER patches a reopened bug without restarting from Phase 1
- NEVER mixes refactoring with a bug fix
