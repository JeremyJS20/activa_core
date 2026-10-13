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
When a module covers multiple distinct workflows, screens, or regulatory domains (e.g. Payroll, Billing, Fixed Assets, Inventory), it SHALL be decomposed into modular sub-specs:
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

> ⚠️ **STRICT PROHIBITION (Hard Gate 11)**:
> Creating monolithic folders such as `specs/{module}-core/`, `specs/mvp/`, or `specs/{system}/` containing a single `requirements.md` that aggregates all entities and workflows of a multi-capability system is a CRITICAL VIOLATION of Hard Gate 11.
> The agent MUST decompose into sequential numbered sub-features (`01-...`, `02-...`), obtain approval for the breakdown, and author specs strictly one sub-feature at a time.

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
