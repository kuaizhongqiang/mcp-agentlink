---
name: agentlink
description: Manage the mcp-agentlink connection — status, on/off toggle, reconnection.
---

# /agentlink — mcp-agentlink Slash Command

Manage your agent's connection to the mcp-agentlink server.

## Usage

```
/agentlink status          Show connection status
/agentlink on              Enable the connection and register
/agentlink off             Disable the connection (no auto-register)
/agentlink reconnect       Full re-registration + catch up on events
/agentlink sync            Fetch latest charter from server (overwrites local cache)
```

---

## /agentlink status

Show the current connection state by combining local config and server data.

### Steps

1. **Read local config**
   - Import `readConfig` from `mcp-agentlink-client`
   - Call `readConfig("./CLAUDE.md")` — returns `{ project, role, sender, workpath, giturl, server_url, token }`
   - If no config found → show "Not configured. Run `init` first." and stop.

2. **Read token**
   - Import `readToken` from `mcp-agentlink-client`
   - Call `readToken()` — returns the raw token string or null

3. **Check server connectivity**
   - Parse `server_url` from config (default: `http://localhost:3000`)
   - Call `GET {server_url}/health` — returns `{ status, sessionCount }`
   - If unreachable → show server as 🔴 Offline

4. **Call server agent status API** (if reachable)
   - `GET {server_url}/api/agent/status?token={token}`
   - Returns `{ agent, project, events, registrations }`
   - If token invalid → show connection as 🔴 Auth Failed

5. **Display formatted output**

   ```
   mcp-agentlink Connection
   ─────────────────────────
   Status:     🟢 Connected  (or 🔴 Offline / ⚠️ Disabled)
   Server:     https://mcp-agentlink.example.com
   Project:    payment-rebuild  (active)
   Role:       api-owner
   Sender:     repo-A/coder
   Events:     12 total · 3 scoped to your role
   Sessions:   2 active connections
   Registration: online (last seen: 2026-06-25 10:30 UTC)
   ```

   If `enabled: false` in config → show Status: ⚠️ Disabled regardless of server state.

---

## /agentlink on (or /agentlink enable)

Enable the mcp-agentlink connection and register with the server.

### Steps

1. **Read config + token** (same as `status` step 1-2)
   - If no config → show error: "Not configured. Run `init` first."

2. **Enable in config**
   - Read CLAUDE.md
   - Find the `## mcp-agentlink Config` block
   - Change `enabled: false` to `enabled: true`
   - Write back to CLAUDE.md
   - Use the `init()` function's config replacement logic:
     - Match the marker-start to marker-end block
     - Replace with updated block

3. **Register with server**
   - Call `POST {server_url}/api/agent/register` with JSON body:
     ```json
     { "project": "...", "sender": "...", "role": "...",
       "workpath": "...", "giturl": "...", "token": "..." }
     ```
   - If the REST endpoint isn't available, fall back to using the `register` MCP tool (if the server is configured as an MCP server in Claude Code settings)

4. **Pull pending events**
   - Call `queryEvents` for the agent's own scope
   - Display a summary:
     ```
     ✅ mcp-agentlink enabled and registered
     📥 3 pending events found
     ```

5. **If server unreachable**
   - Config is still updated to `enabled: true`
   - Warn: "⚠️ Config updated but server unreachable — will auto-register on next startup"

---

## /agentlink off (or /agentlink disable)

Disable the mcp-agentlink connection. The agent will NOT auto-register or query events.

### Steps

1. **Read config** (same as `status` step 1)

2. **Disable in config**
   - Read CLAUDE.md
   - Find the `## mcp-agentlink Config` block
   - Change `enabled: true` to `enabled: false`
   - Write back

3. **Confirm**
   ```
   ⏸️  mcp-agentlink disabled
   Run "/agentlink on" to re-enable
   ```

---

## /agentlink reconnect

Full reconnection flow: verify server, re-register, catch up on missed events.

### Steps

1. **Read config + token**

2. **Verify server reachable**
   - `GET {server_url}/health`
   - If unreachable → error and abort

3. **Re-register**
   - Same as `/agentlink on` step 3

4. **Catch up on events**
   - Call `queryEvents` to pull all events within scope
   - If there's a local cursor (`last_queried_event_id` in a local file `.mcp-agentlink.cursor`), use `sinceId` to get only new events
   - Show a summary of new events

5. **Report**
   ```
   🔄 mcp-agentlink reconnected
   Server:     🟢 online
   Project:    payment-rebuild
   New events: 3 (since cursor abc-123)
   ```

---

## /agentlink sync

Fetch the latest charter from the server and update the local cache.

### Steps

1. **Read identity + token**
   - Read `.mcp-agentlink/identity.json` for project, server_url
   - Read `.mcp-agentlink/token` for the auth token

2. **Call server sync API**
   - `POST {server_url}/api/agent/sync` with JSON body:

     ```json
     { "project": "...", "token": "..." }
     ```

   - Returns `{ charter: { content, guid, published_at }, project: { id, status } }`

3. **Write to local cache**
   - Write charter content to `~/.mcp-agentlink/cache/{project-id}/charter.yaml`
   - Write sync metadata to `~/.mcp-agentlink/cache/{project-id}/sync-meta.json`

4. **Display summary**
   ```
   🔄 Charter synced for "my-project"
      GUID:      abc-123-def
      Published: 2026-06-25 10:00:00
      Status:    active
   ```

5. **If no charter published yet**
   ```
   ℹ️  No charter published yet for "my-project"
   ```

---

## Config Reference

The config block in CLAUDE.md looks like:

```markdown
## mcp-agentlink Config
enabled: true
project: payment-rebuild
role: api-owner
sender: repo-A/coder
workpath: /home/user/repo-A
giturl: https://github.com/user/repo-A
server_url: https://mcp-agentlink.example.com
<!-- mcp-agentlink-end -->
```

The enable/disable toggle changes only the `enabled:` line.
