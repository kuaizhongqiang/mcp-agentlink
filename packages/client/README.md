# mcp-agentlink-client

**Client library for AI agents** connecting to an mcp-agentlink center server.

## What This Is

mcp-agentlink is a cross-project, cross-agent communication hub. Multiple AI agents
with independent contexts can share events, file references, and work status via a
centralized MCP server.

This package is the **client side** — agents install it to connect to the center.

## Concepts

| Term | Meaning |
|------|---------|
| **Project** | An isolated work domain (e.g., "payment-rebuild"). Data never crosses project boundaries. |
| **Sender** | Who initiated an operation. Format: `<repo>/<agent-id>` (e.g., `repo-A/coder`). |
| **Role** | Functional identifier used for auth and routing. Kebab-case: `api-owner`, `frontend-consumer`, `schema-owner`, `tester`. |
| **Event** | The core data unit — a typed message with summary, scope, and optional doc references. |
| **Center** | The mcp-agentlink-server instance that stores registrations and events. |

## Quick Start (for Agents)

### 1. Install

```
npm install mcp-agentlink-client
```

### 2. Read Skill Rules

Read `./skill/skill.md` — it defines automatic behaviors:
- **On startup**: auto-register + query events for your scope; suggest running `/agentlink sync`
- **On task completion**: post event + alert user for cross-role notifications
- **During work**: periodically query new events; sync on milestone events
- **PM role**: if registered as `pm`, can publish charter via `publishCharter`

### 3. Init (First Time)

The agent runs a Q&A flow with the user to collect:
- Project, role, sender, workpath, giturl, server_url, token

Then calls the `init()` function to write identity to `.mcp-agentlink/identity.json`
and token to `.mcp-agentlink/token` (auto-created `.gitignore`).

### 4. Connect

Use the MCP tools (`register`, `postEvent`, `queryEvents`, `status`,
`linkFile`, `queryLinks`, `unlinkFile`, `publishCharter`, `syncCharter`)
via the MCP protocol against the center's SSE endpoint.

## Package Contents

```
node_modules/mcp-agentlink-client/
├── README.md          ← This file
├── skill/
│   └── skill.md       ← Agent behavior rules (auto-read)
├── dist/
│   ├── index.js       ← init() / readToken() / readConfig() / sync()
│   └── format.js      ← formatTable() / formatJson() / paginate()
└── package.json
```

## Related

- [mcp-agentlink-server](https://github.com/kuaizhongqiang/mcp-agentlink) — The center server
- [docs/design.md](https://github.com/kuaizhongqiang/mcp-agentlink/blob/main/docs/design.md) — Full design specification
