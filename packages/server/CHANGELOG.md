# Changelog — mcp-agentlink-server

## [0.4.0] - 2026-06-25

### Added

- **Project unarchive**: `mcp-agentlink project unarchive <id>` restores archived projects, re-activates tokens and registrations
- **Archive safety**: `--dry-run` preview and `--force` skip-confirmation flags on `project archive`
- **File links cascade**: `--hard` archive mode now deletes associated file_links records
- **Event purge completion**: `--all` (purge all events), `--dry-run` (preview count), and `--force` (skip prompt) flags
- **Event statistics**: `mcp-agentlink event stats --project <id>` with breakdown by type, scope, and monthly trend
- **SQLITE_BUSY retry**: Database `exec()` and `run()` operations auto-retry up to 3 times with exponential backoff
- **Finer-grained auth**: Tokens now have a `permissions` column (`read`/`write`/`admin`); MCP tools enforce permission checks
- **Token permissions CLI**: `mcp-agentlink token generate --perms <read|write|admin>`
- **Dynamic version**: Version string read from `package.json` at startup — no more hardcoded drift
- **Performance indexes**: Composite indexes for common event/registration/token query patterns (migration 004)
- **Enhanced health endpoint**: `/health` now returns version, uptime, project/registration/event/token metrics
- **Performance migration**: 004_performance_indexes.sql with composite indexes

### Changed

- Version bumped to 0.4.0

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
