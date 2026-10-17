# Protected Files — never edit

> These files are managed by the SDD standard or contain sensitive data.
> Editing them can break the configuration or expose secrets.

## Files that must NEVER be edited by the agent

| File | Why | Who manages it |
|------|-----|----------------|
| opencode.json | OpenCode MCP config with credentials | sdd-init.sh / manual with approval |
| .sdd-config.json | Project configuration (role, org, project) | sdd-init.sh / manual with approval |
| .sdd-credentials.json | Local credentials store (PATs, API keys) | sdd-init.sh |
| VERSION | Version marker | sdd-init.sh |
| .kiro/settings/mcp.json | Kiro MCP config with credentials | sdd-init.sh / adapter |
| .mcp.json | Claude / Cursor MCP config with credentials | sdd-init.sh / adapter |
| .claude/mcp.json | Claude Code project MCP config with credentials | sdd-init.sh / adapter |
| .agents/mcp_config.json | Antigravity MCP config with credentials | sdd-init.sh / adapter |

## What to do if the agent tries to edit a protected file
1. STOP immediately
2. Notify the human: "This is a protected file. I cannot edit it."
3. If the change is necessary: request explicit human approval
4. If approved: the human edits it manually, not the agent

## Auto-recovery
If a protected file is accidentally modified:
- The agent should detect the change and warn the human
- The human can restore via git: `git checkout -- <file>`
- Or re-run sdd-init.sh with --force to regenerate
