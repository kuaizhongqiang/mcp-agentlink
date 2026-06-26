# Changelog — mcp-agentlink-server

## [0.5.0] - 2026-06-26

### Added

- **PM role mechanism**: `register --role pm` for project PM registration (idempotent); `project close <id>` sets project to closed status, blocking new events and registrations; new error codes `PM_EXISTS`, `NO_PM`, `PROJECT_CLOSED`
- **Charter system**: `charters` table with GUID versioning; `publishCharter` MCP tool (PM-only, publishes project constitution); `syncCharter` MCP tool (all agents, returns charter + project status); `POST /api/agent/sync` REST endpoint
- **CLI commands**: `mcp-agentlink project close <id>` (close projects), `mcp-agentlink charter set --project --file` (publish charter), `mcp-agentlink charter show --project` (view charter)
- **Migration 005**: Rebuilds projects table with `closed` in status CHECK constraint, creates charters table

### Changed

- Auth module: added `assertPmRole()`, `assertProjectHasPm()`, `assertProjectNotClosed()` assertion functions
- RegistrationStore: added `findPm()`, `hasPm()` PM lookup helpers
- ProjectStore: extended `status` type to `active | archived | closed`, added `close()` and `isClosed()` methods
- MCP tools: handleRegister enforces PM-first registration flow; handlePostEvent rejects closed projects
- Version bumped to 0.5.0

### Fixed

- Project list display now shows closed projects with ⏹ icon and status text

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
