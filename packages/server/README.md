# mcp-agentlink-server

**Center server** for mcp-agentlink — a cross-project, cross-agent communication hub.

## Features

- **CLI management**: 14 commands to manage projects, tokens, registrations, events, and the server process
- **SQLite storage**: Persistent data via sql.js, 4 tables (projects, registrations, events, tokens)
- **MCP over SSE**: Connect AI agents via `GET /sse` + `POST /message`
- **Token auth**: SHA-256 hashed tokens, project-isolated, role-based access
- **3 MCP tools**: `register`, `postEvent`, `queryEvents`

## Quick Start

```bash
# Start the server
mcp-agentlink server start

# Create a project and generate a token
mcp-agentlink project create my-project
mcp-agentlink token generate --project my-project --role api-owner

# See all commands
mcp-agentlink --help
```

## CLI Commands

```
mcp-agentlink server start|stop|status|logs  — Server lifecycle
mcp-agentlink project create|archive|list|show — Project management
mcp-agentlink token generate|revoke|list     — Token management
mcp-agentlink register list                   — Agent registrations
mcp-agentlink event list —project <id>        — Event log
```

## Configuration

- Database path: `~/.mcp-agentlink/data.db` (override via `MCP_AGENTLINK_DB_PATH`)
- Server port: 3000 (override via `--port`)

## Related

- [mcp-agentlink-client](https://github.com/kuaizhongqiang/mcp-agentlink) — Agent client package
- [docs/design.md](../docs/design.md) — Full design specification
