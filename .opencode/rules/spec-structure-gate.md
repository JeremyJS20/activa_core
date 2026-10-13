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
| 11 | Dump a multi-workflow Macro-Feature into a single monolithic spec (e.g. *-core/, mvp/, all-in-one) without modular decomposition | BLOCK |
| 12 | Generate superficial, brief, or placeholder-ridden documentation without exhaustive technical detail | BLOCK |
| 13 | Create downstream artifact (design.md / tasks.md / code) while upstream artifact header still contains "[pending]" | BLOCK |
| 14 | Cascade a single approval across multiple artifacts, or stamp approval on an artifact not explicitly named by the user | BLOCK |
| 15 | Corrupt file encoding or introduce mojibake via non-UTF-8 tools (e.g. raw PowerShell redirection) | BLOCK |
| 16 | Update docs/modules/{module}.md without synchronizing all 3 master diagrams (State Machine, Component Flow, ERD) or leaving corrupted table rows | BLOCK |
| 17 | Implement UI components or frontend screens without a defined design system (DESIGN.md) or producing generic unstyled boilerplate | BLOCK |

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
- Gate 11: Stop immediately and delete/split the monolithic spec. Classify the system into domain sub-modules under `specs/{module}/01-{submodule}/`, `02-{submodule}/`, etc. Propose the decomposition breakdown to the user, obtain explicit approval, initialize `docs/modules/{module}.md`, and author requirements ONLY for Sub-module 01.
- Gate 12: Redraft documentation with exhaustive technical depth: full DDL schemas with column types, nullability, constraints; complete API contracts with real request/response JSONs and HTTP error codes; exact mathematical formulas; and rendered Mermaid diagrams. Ban 'etc.', 'TODO', or summarized placeholders.
- Gate 13: Stamp the upstream artifact's header with the formal human approval (`> ✅ Approved by: [Approver Name / Role] · [YYYY-MM-DD]`) BEFORE creating or proposing the downstream artifact. Never leave `[pending]` in an approved artifact.
- Gate 14: Obtain explicit, independent approval for EACH artifact individually. Approval for requirements.md NEVER authorizes design.md. Approval for design.md NEVER authorizes tasks.md. Colloquial words ("dale", "continúa", "ok") apply ONLY to the single artifact currently under review.
- Gate 15: Restore clean UTF-8 encoding and use safe tools (replace_file_content, write_to_file, or Node.js UTF-8) for all file mutations. Ban raw PowerShell stream redirection.
- Gate 16: Fully synchronize all 3 master diagrams (Section 3.1 stateDiagram-v2, Section 3.2 flowchart, Section 4 erDiagram) in docs/modules/{module}.md to reflect certified sub-module changes (new sub-states, engines/resolvers, entities), and eliminate empty lines or malformed rows in Markdown tables.
- Gate 17: Establish a formal Design System specification (`DESIGN.md` in repository root or `docs/architecture/design-system.md` using `design-system-template.md`). Define the aesthetic theme narrative, dual-mode color tokens (Canvas, Surface, Inset, Text, Ghost Borders), the "No-Line" spatial layout rule, the typographic triad (Display, Sans, Monospace for codes/numbers), and interactive component states before implementing frontend code. Ban generic unstyled Bootstrap or flat-white boilerplate.

## What NEVER to do
- DO NOT bypass gates even if the user says "just do it"
- DO NOT create files that would violate a gate
- DO NOT ignore block warnings
