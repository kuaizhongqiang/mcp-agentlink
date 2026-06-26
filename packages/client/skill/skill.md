# mcp-agentlink Agent Skill

> Skill rules for AI agents using mcp-agentlink-client.
> These rules execute AUTOMATICALLY (not as slash commands).

---

## 1. On Startup

If `enabled: true` in `.mcp-agentlink/identity.json` or workspace config:

1. **Read identity** from `.mcp-agentlink/identity.json` (new format) or config block in CLAUDE.md (legacy)
2. **Read token** from `.mcp-agentlink/token` (new format) or `.mcp-agentlink.token` (legacy)
3. Call `register` MCP tool → center confirms agent identity
4. Call `queryEvents` with `scope` set to own role → pull pending events
5. **Suggest** running `/agentlink sync` to fetch the latest charter

If `enabled: false` or no config found → skip, do nothing.

---

## 2. On Long Task Completion

After completing a meaningful work unit (e.g., implemented a feature, fixed a bug, finished a refactor):

1. **Write local doc** — save a brief note to a local file containing:
   - One-line summary of what was done
   - Related script/file paths
   - Related documentation paths
2. **Call `postEvent`** — send an event to the center:
   - `type`: `finish` (or `milestone` for significant completions)
   - `summary`: the one-line summary
   - `scope`: `"*"` if the change affects everyone, or a specific role name
   - `docRef.path`: path to the local doc (relative to repo root)
   - `docRef.script`: paths to related scripts
3. **If scope targets a specific role** → alert the user:
   > "I've finished [summary]. This affects the [role] — please let them know."

---

## 3. During Work

Periodically (before starting a new task, or on user prompting):

1. Call `queryEvents` with `scope` set to own role to check for new events
2. For each new event:
   - Read the `summary` — if relevant, read the `docRef.path` for full context
   - Decide whether to act on it or acknowledge
3. If a new `milestone` or `start` event is found → execute `/agentlink sync`

---

## 4. PM Role

If your agent is registered with `role: pm`:

- You can call `publishCharter` to update the project's charter
- You can call `project close` (via CLI) to close the project
- You are responsible for drafting the project's Charter (5-layer framework)

---

## Storage Reference

Two-layer structure:

```
# Global (shared across all projects)
~/.mcp-agentlink/
├── client-config.json         # defaultServerUrl, project list
└── cache/{project-id}/
    ├── charter.yaml           # Cached project charter
    └── sync-meta.json         # Last sync metadata

# Project-level (one per repo)
{repo-root}/.mcp-agentlink/
├── identity.json              # project, role, sender, server_url
├── token                      # Auth token (in .gitignore)
└── .gitignore                 # Ignores token file
```

---

## MCP Tools Available

| Tool | Purpose | When to Call |
|------|---------|-------------|
| `register` | Register agent identity | On startup |
| `postEvent` | Post completion/status event | After long tasks |
| `queryEvents` | Pull events by scope/type | Periodically during work |
| `status` | Get server + agent status | Connection diagnostics |
| `linkFile` | Create cross-repo file link | When files span repos |
| `queryLinks` | Query file links | When looking up file associations |
| `unlinkFile` | Delete a file link | Cleanup |
| `publishCharter` | Publish project charter | PM only — when charter changes |
| `syncCharter` | Fetch latest charter | During sync workflow |
