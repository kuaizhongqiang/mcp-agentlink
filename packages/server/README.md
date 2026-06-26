# mcp-agentlink-server

**Center server** for mcp-agentlink — a cross-project, cross-agent communication hub.

## Features

- **CLI management**: 20+ commands to manage projects, tokens, registrations, events, charters, file links, and the server process
- **SQLite storage**: Persistent data via sql.js, 6 tables (projects, registrations, events, tokens, file_links, charters)
- **MCP over SSE**: Connect AI agents via `GET /sse` + `POST /message`
- **Token auth**: SHA-256 hashed tokens, project-isolated, role-based access (read/write/admin)
- **9 MCP tools**: `register`, `postEvent`, `queryEvents`, `status`, `linkFile`, `queryLinks`, `unlinkFile`, `publishCharter`, `syncCharter`
- **PM role**: Project Manager registration, Charter system, project lifecycle (active/archived/closed)

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
mcp-agentlink server start|stop|status|logs|cleanup-registrations — Server lifecycle
mcp-agentlink project create|archive|unarchive|close|list|show    — Project management
mcp-agentlink token generate|revoke|list                          — Token management
mcp-agentlink register list                                       — Agent registrations
mcp-agentlink event list|count|stats|purge                        — Event log & statistics
mcp-agentlink link create|list|find|delete                        — Cross-repo file links
mcp-agentlink charter set|show                                    — Charter management
mcp-agentlink status                                              — Server overview
```

## Configuration

- Database path: `~/.mcp-agentlink/data.db` (override via `MCP_AGENTLINK_DB_PATH`)
- Server port: 3000 (override via `--port`)

## Related

- [mcp-agentlink-client](https://github.com/kuaizhongqiang/mcp-agentlink) — Agent client package
- [docs/design.md](../docs/design.md) — Full design specification
