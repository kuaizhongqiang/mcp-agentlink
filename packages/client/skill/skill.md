# mcp-agentlink Agent Skill

> Skill rules for AI agents using mcp-agentlink-client.
> These rules execute AUTOMATICALLY (not as slash commands).

---

## 1. On Startup

If `enabled: true` is found in workspace config (CLAUDE.md / CODEBUDDY.md):

1. Read the config block (`## mcp-agentlink Config`)
2. Call `register` MCP tool → center confirms agent identity
3. Call `queryEvents` with `scope` set to own role → pull pending events

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

---

## Config Reference

Expected workspace config format:

```markdown
## mcp-agentlink Config
enabled: true
project: <project-id>
role: api-owner
sender: <repo>/<agent-id>
workpath: /absolute/path/to/repo
giturl: https://github.com/user/repo
server_url: https://mcp-agentlink.example.com
```

Token is stored separately in `.mcp-agentlink.token` (never in workspace file).

---

## MCP Tools Available

| Tool | Purpose | When to Call |
|------|---------|-------------|
| `register` | Register agent identity | On startup |
| `postEvent` | Post completion/status event | After long tasks |
| `queryEvents` | Pull events by scope/type | Periodically during work |
