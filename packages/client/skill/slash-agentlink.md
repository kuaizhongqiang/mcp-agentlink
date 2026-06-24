# /agentlink — mcp-agentlink Slash Command

> Slash command for agents to manage their mcp-agentlink connection.
> Invoke with: `/agentlink [subcommand]`

---

## Commands

### `/agentlink status`

Show current connection status:

```text
Status:     🟢 Connected
Project:    payment-rebuild
Role:       api-owner
Sender:     repo-A/coder
Server:     https://mcp-agentlink.example.com
Events:     12 total, 3 since last check
```

Implementation: call `readConfig()` to get local config, `readToken()` to get token,
then call the `status` MCP tool with the token.

### `/agentlink on` / `/agentlink enable`

Enable the mcp-agentlink connection:

1. Read current config via `readConfig()`
2. Call `register` MCP tool to re-register
3. Call `queryEvents` to pull pending events
4. Report status to user

### `/agentlink off` / `/agentlink disable`

Disable the mcp-agentlink connection:

1. Read current config via `readConfig()`
2. Set `enabled: false` in the workspace config block
3. Report to user that connection is paused

### `/agentlink reconnect`

Full reconnection:

1. Read config + token
2. Call `status` MCP tool to verify server reachable
3. Call `register` to re-register identity
4. Call `queryEvents` to catch up on missed events
5. Report result

---

## Config Handling

Read config from workspace file (CLAUDE.md / CODEBUDDY.md / AGENTS.md):

```typescript
import { readConfig, readToken } from "mcp-agentlink-client";

const config = readConfig("CLAUDE.md");
const token = readToken();
if (config?.enabled !== "true") {
  // Connection is disabled
}
```

Write updated config back to workspace file using `init()` or direct file manipulation.
