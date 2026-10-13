# Token Optimization

> Reduce token usage to maximize context window and reduce costs.
> Memory-first approach saves 40-70% of tokens.

## Memory-first protocol
- ALWAYS load server-memory before reading files
- If a decision is in memory, do NOT re-read the file that originated it
- If a convention is in memory, do NOT search for it in code
- If a correction is in memory, do NOT re-discover the same error

## codebase-memory before grep
- Use codebase-memory search_graph instead of grep when possible
- Use codebase-memory trace_path instead of manual call tracing
- Use codebase-memory get_code_snippet instead of reading entire files
- Only use grep as fallback when codebase-memory does not have the answer

## Verbosity levels
- **brief** (default): concise responses, only essential info
- **detailed** (on request): full explanations, examples, edge cases
- DO NOT default to detailed unless the user asks for it
- DO NOT repeat context that is already visible in the conversation

## Tool discipline
- NEVER use 3 MCPs for the same task if 1 suffices
- NEVER call context7 if you already know the answer
- NEVER call playwright if there is no UI to test
- NEVER call azure-devops if there is no AB# in context
- NEVER read a 500-line file when you only need 1 function (use codebase-memory get_code_snippet)

## Context management
- If context is getting long, summarize previous work into server-memory
- Do not repeat the same explanation twice
- Reference previous decisions by name, not by re-explaining them
