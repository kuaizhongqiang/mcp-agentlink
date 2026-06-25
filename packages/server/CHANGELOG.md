# Changelog — mcp-agentlink-server

## [0.3.0] - 2026-06-25

### Added

- REST API for agent self-service: `GET /api/agent/status` (agent connection status with event counts) and `POST /api/agent/register` (REST alternative to MCP register tool)
- `.github/` issue and PR templates for standardized workflow
- `.claude/skills/agentlink.md`: `/agentlink` slash command skill (status, on, off, reconnect)

### Changed

- Version bumped to 0.3.0

## [0.2.0] - 2026-06-24

### Added

- `/agentlink` slash command support: `mcp-agentlink status` CLI, `status` MCP tool
- File linking: `file_links` table, `linkFile`/`queryLinks`/`unlinkFile` MCP tools, `mcp-agentlink link` CLI
- Project archive cascade: auto-revoke tokens + mark registrations offline + `--hard` cleanup
- Error handling: `withRetry()` exponential backoff utility
- Heartbeat cleanup: `server cleanup-registrations --timeout` CLI command
- Event purge: `event purge --project --before --type` + `event count`

### Changed

- Version bumped to 0.2.0

## [0.1.0] - 2026-06-24

### Added

- Monorepo scaffold with npm workspaces and TypeScript strict mode
- CLI framework with 14 commands (commander): server/project/token/register/event management
- SQLite storage layer (sql.js): projects, registrations, events, tokens tables with CRUD
- Migration system: auto-applied on startup, file-convention based
- MCP over SSE server: GET /sse + POST /message + GET /health
- Auth middleware: SHA-256 token verification on every tool call
- MCP tools: register (idempotent), postEvent, queryEvents (with sinceId cursor)
- Project archiving auto-revokes all associated tokens
- File-backed persistence at ~/.mcp-agentlink/data.db (configurable via MCP_AGENTLINK_DB_PATH)
