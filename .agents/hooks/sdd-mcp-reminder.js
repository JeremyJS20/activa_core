// SDD Standard — PreInvocation hook. Injects the MCP checklist on the first model call.
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch (e) {}
  if ((input.invocationNum || 0) > 1) { process.stdout.write('{}'); return; }
  const msg = [
    'SDD MCP checklist (mandatory, see sdd-tool-protocol):',
    '1. server-memory: search_nodes/read_graph -> report "Memoria: N entidades"',
    '2. codebase-memory: list_projects -> index_repository if missing/stale -> report "Grafo: ..."',
    '3. Code discovery: search_graph + get_code_snippet BEFORE grep or reading files',
    '4. Before changing code: trace_path inbound (callers)',
    '5. Bug? activate skill bug-fix-protocol. Write BugFix/Decision/Correction to server-memory when done',
  ].join('\n');
  process.stdout.write(JSON.stringify({ injectSteps: [{ ephemeralMessage: msg }] }));
});
