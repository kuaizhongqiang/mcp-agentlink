# Changelog — mcp-agentlink-client

## [0.4.0] - 2026-06-25

### Changed

- Version bumped to 0.4.0 (sync with server v0.4.0 auth/permission model)

## [0.3.0] - 2026-06-25

### Changed

- Updated `skill/slash-agentlink.md` to reflect REST API based `/agentlink` implementation (uses `GET /api/agent/status` and `POST /api/agent/register` instead of MCP tool calls)
- Version bumped to 0.3.0

## [0.2.0] - 2026-06-24

### Added

- `skill/slash-agentlink.md`: `/agentlink` slash command skill (status, enable, disable, reconnect)

### Changed

- Version bumped to 0.2.0

## [0.1.0] - 2026-06-24

### Added

- `init()` function: Q&A-driven config setup, writes to workspace file + separate token file
- `readToken()` / `readConfig()` utilities for agent self-discovery
- `skill/skill.md`: 3 automatic agent behavior rules (startup, task completion, periodic polling)
- `README.md`: agent-readable concept docs (Project/Sender/Role/Event)
- TypeScript strict mode, ESM
