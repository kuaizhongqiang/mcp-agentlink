# Changelog — mcp-agentlink-client

## [0.5.1] - 2026-06-26

### Updated

- Documentation: README.md updated to reflect Phase 4 storage layout and all 9 MCP tools

## [0.5.0] - 2026-06-26

### Added

- **Two-layer storage**: global `~/.mcp-agentlink/` (config + cache) + project `.mcp-agentlink/` (identity + token)
- **New init layout**: `init()` writes `.mcp-agentlink/identity.json`, `.mcp-agentlink/token`, and `.gitignore`
- **Token migration**: token moved from `.mcp-agentlink.token` to `.mcp-agentlink/token`; backward compatible read fallback
- **Global config**: `readGlobalConfig()` / `writeGlobalConfig()` for shared project registry
- **Charter cache**: `writeCharterCache()` / `readCharterCache()` / `writeSyncMeta()` / `readSyncMeta()` for local sync persistence
- **Sync**: `sync(serverUrl, projectId, token)` fetches charter via `POST /api/agent/sync` and writes to local cache
- **Sync status**: `getSyncStatus(projectId)` reads cached sync state without network call
- **Skill formalization**: `writeSkillFile()` auto-generates `.claude/skills/agentlink.md` with Phase 4 rules
- **Sender auto-generation**: `detectRepo()` / `detectAgentName()` / `generateSender()` for `{repo}/{agent}` format
- **Legacy migration**: `detectLegacyConfig()` / `migrateLegacyConfig()` one-time migration from old format
- **CLI formatting**: `formatTable()` / `formatJson()` / `paginate()` / `formatConnectionStatus()` utilities
- **Skill docs**: Updated `skill/skill.md` with Phase 4 storage layout, PM role rules, all 9 MCP tools
- **Test isolation**: `setGlobalDir()` for overriding global config directory in tests

### Changed

- `readConfig()` now derives root directory from workspace file path for token lookup
- `readToken()` checks `.mcp-agentlink/token` first, falls back to `.mcp-agentlink.token`
- Version bumped to 0.5.0

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
