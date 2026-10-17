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
