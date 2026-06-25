# /agentlink — mcp-agentlink Slash Command

> Slash command for agents to manage their mcp-agentlink connection.
> Invoke with: `/agentlink [subcommand]`

This skill is registered via `.claude/skills/agentlink.md` in the project
config. The markdown here is the reference for npm-published client package.

---

## Commands

### `/agentlink status`

Show current connection status by combining local config and server data:

```text
mcp-agentlink Connection
─────────────────────────
Status:     🟢 Connected
Server:     https://mcp-agentlink.example.com
Project:    payment-rebuild  (active)
Role:       api-owner
Sender:     repo-A/coder
Events:     12 total · 3 scoped to your role
Sessions:   2 active connections
Registration: online (last seen: 2026-06-25 10:30 UTC)
```

**Steps:**

1. Call `readConfig("./CLAUDE.md")` to get local config (`project`, `role`, `sender`, `server_url`)
2. Call `readToken()` to get the auth token
3. Check server reachability: `GET {server_url}/health`
4. Get agent status: `GET {server_url}/api/agent/status?token={token}`
5. Format and display the combined result

If the server is unreachable, show Status: 🔴 Offline with local config only.
If `enabled: false` in config, show Status: ⚠️ Disabled regardless of server.

### `/agentlink on` / `/agentlink enable`

Enable the mcp-agentlink connection and register with the server:

1. Read config + token via `readConfig()` / `readToken()`
2. Update CLAUDE.md: change `enabled: false` → `enabled: true`
3. Register via REST: `POST {server_url}/api/agent/register` with JSON body
4. Pull pending events via `GET {server_url}/api/agent/status`
5. Report result

If the server is unreachable, config is still updated. The agent will
auto-register on next startup when the server is available.

### `/agentlink off` / `/agentlink disable`

Disable the mcp-agentlink connection:

1. Read current config via `readConfig()`
2. Set `enabled: false` in the workspace config block
3. Report to user that connection is paused

### `/agentlink reconnect`

Full reconnection flow:

1. Read config + token
2. Verify server reachable: `GET {server_url}/health`
3. Re-register: `POST {server_url}/api/agent/register`
4. Pull agent status: `GET {server_url}/api/agent/status?token={token}`
5. Report result with new event count

---

## Config Handling

See [./skill.md](./skill.md) for the full config format and agent behavior rules.

```typescript
import { readConfig, readToken } from "mcp-agentlink-client";

const config = readConfig("CLAUDE.md");
const token = readToken();
if (config?.enabled !== "true") {
  // Connection is disabled
}
```

Toggle `enabled` by editing the config block in the workspace file.
The `<!-- mcp-agentlink-end -->` marker delimits the config block.
