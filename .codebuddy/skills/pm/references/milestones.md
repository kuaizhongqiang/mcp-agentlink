# Milestone 定义

## Phase 1 — MVP (v0.1.0)

**目标**：最小可用，端到端拉通

| 序号 | 模块 | 内容 |
|------|------|------|
| 1 | Monorepo scaffold | root package.json (workspaces), packages/, TypeScript config, tsconfig.base.json |
| 2 | Server CLI framework | `mcp-agentlink` binary: help, server start/stop/status/logs, project CRUD, token CRUD, register list, event list |
| 3 | Server SQLite storage | 4 表 DDL (projects/registrations/events/tokens), CRUD, migration |
| 4 | Server MCP over SSE | @modelcontextprotocol/sdk, SSE transport, tool registration |
| 5 | Server Auth middleware | token verification, project isolation, role-based access |
| 6 | Server MCP tools | register, postEvent, queryEvents |
| 7 | Client npm package | init (local), skill/ directory, README |
| 8 | DevOps | CI/CD pipeline, CHANGELOG, v0.1.0 release |

## Phase 2 — v0.2.0

| 模块 | 内容 |
|------|------|
| /agentlink command | 开关切换、状态查询 slash command |
| File linking | repo A ↔ repo B 文件映射 |
| Project archive | 完整归档流程 |
| Error handling | 错误处理与重试机制 |
| Event purge | `mcp-agentlink event purge` CLI |

## Phase 3 — v0.3.0

| 模块 | 内容 |
|------|------|
| Event history | 事件历史与统计 |
| Finer auth | 更细粒度鉴权 |
| Performance | 性能优化、缓存 |
| Monitoring | 监控与日志 |

## Backlog

未排期的 idea 和优化项。
