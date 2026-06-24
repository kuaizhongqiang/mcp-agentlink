# mcp-agentlink PM 审查报告

> 审查日期：2026-06-24 | 最新轮次：Phase 2 审查 | Issues: #1-#26

---

## Phase 1 里程碑（✅ 已验收）

| # | 模块 | 最终状态 |
|---|------|---------|
| 1 | Monorepo scaffold | ✅ |
| 2 | Server CLI 框架 | ✅ |
| 3 | SQLite 存储层 | ✅ |
| 4 | MCP over SSE 传输 | ✅ |
| 5 | Auth 鉴权中间件 | ✅ |
| 6 | Server MCP Tools | ✅ |
| 7 | Client npm 包 | ✅ |
| 8 | DevOps | ✅ |

---

## Phase 2 里程碑审查

### 功能完成度

| 模块 | 完成度 | 评价 |
|------|--------|------|
| **File Linking** | ✅ **100%** | migration `002_file_links` + FileLinkStore + 3 MCP tools (`linkFile`/`queryLinks`/`unlinkFile`) + CLI `link create/list/find/delete` 全链路 |
| **/agentlink Slash Command** | ⚠️ **80%** | `slash-agentlink.md` 定义到位（status/on/off/reconnect），但纯文档无 TypeScript 代码支持 |
| **Error Handling & Retry** | ⚠️ **30%** | `withRetry()` 已实现（指数退避+抖动），但**零调用**；SQLITE_BUSY 未处理 → [#25](https://github.com/kuaizhongqiang/mcp-agentlink/issues/25) |
| **Project Archive** | ⚠️ **60%** | 核心 `archive --hard` 可用，缺 `unarchive`、`--dry-run`、`--force`、cascade to file_links |
| **Event Purge** | ⚠️ **70%** | `event purge --project --before --type` 可用，缺 `--dry-run`、`--all`、确认提示 |
| **Overall** | **~70%** | |

### 🔴 流程违规 — 分支与 PR 管理

> **这是本轮最严重的问题，必须在下个 Phase 纠正。**

| 问题 | 详情 |
|------|------|
| **无 feature 分支** | Phase 2 全部在 `main` 直接开发，0 个 `feat/*` 分支 |
| **无 PR** | 5 个 issue 直接 close，无任何 PR 记录 |
| **无 Code Review** | 变更未经审查直接合入 main |
| **Git 历史** | 仅 2 个 commit：`Initial commit` + `docs: add CLAUDE.md and design documents` |

**规范要求：**

| 规范 | 要求 | 实际 |
|------|------|------|
| 分支命名 | `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*` | ❌ 全部直推 main |
| PR 模板 | closes / type / changelog / breaking / affected | ❌ 无 PR |
| 合入条件 | CI 通过 + 关联 issue + CHANGELOG + 版本号 | ❌ 全部跳过 |
| Commit 规范 | Co-Authored-By 行 | ❌ 无 |

→ Issue [#24](https://github.com/kuaizhongqiang/mcp-agentlink/issues/24)

### 🔴 版本号同步

| 位置 | 当前值 | 应有值 |
|------|--------|--------|
| `packages/server/package.json` | `0.1.0` | `0.2.0` |
| `packages/client/package.json` | `0.1.0` | `0.2.0` |
| Server 代码硬编码 | `"0.2.0"`（handlers.ts L29, cli/index.ts L35） | 应从 package.json 读取 |
| `packages/server/CHANGELOG.md` | 无 v0.2.0 | 需补 |
| `packages/client/CHANGELOG.md` | 无 v0.2.0 | 需补 |
| `README.md` Status | 仍写 "Phase 1 (MVP) complete"，Next: Phase 2 | 应更新 |

→ Issue [#26](https://github.com/kuaizhongqiang/mcp-agentlink/issues/26)

---

## Phase 2 新发现问题（3 项）

| # | Issue | 严重度 |
|---|-------|--------|
| [#24](https://github.com/kuaizhongqiang/mcp-agentlink/issues/24) | **无分支管理 + 无 PR** — 全部直推 main | 🔴 流程违规 |
| [#25](https://github.com/kuaizhongqiang/mcp-agentlink/issues/25) | retry.ts 零调用 + SQLITE_BUSY 未处理 | 🔴 功能残缺 |
| [#26](https://github.com/kuaizhongqiang/mcp-agentlink/issues/26) | 版本号 0.1.0 未升至 0.2.0 + CHANGELOG 缺失 | 🔴 发布阻塞 |

---

## 文档一致性检查

| 检查项 | 状态 |
|--------|------|
| docs/*.md 之间无矛盾 | ✅ |
| architecture-overview.md MVP/目标态分节 | ✅ |
| project-structure.md CI/CD 完整 | ✅ |
| CLAUDE.md/CODEBUDDY.md co-author 独立 | ✅ |
| CLAUDE.md 状态与代码同步 | ✅ |
| CODEBUDDY.md 状态与代码同步 | ✅ |
| **README.md 与实际代码一致** | **❌ 仍写 Phase 1 complete，Phase 2 已完成** |

## 包发布审查

| 检查项 | Server | Client |
|--------|--------|--------|
| README.md agent 可读 | ✅ | ✅ |
| CHANGELOG.md | ❌ 无 v0.2.0 | ❌ 无 v0.2.0 |
| skill/ 目录 | N/A | ✅ |
| dist/ 编译产物 | ✅ | ✅ |
| main/exports 字段 | ✅ | ✅ |
| tag 格式 | ❌ 无 v0.2.0 tag | ❌ 同上 |
| 版本号 | ❌ 0.1.0 | ❌ 0.1.0 |

---

## 遗留问题（Phase 3+）

| 问题 | 优先级 |
|------|--------|
| 事件保留/清理策略 | P2 |
| 心跳/offline 判定时间窗口 | P2 |
| 裸跑进程管理（systemd） | P3 |
| Issue 提交流程豁免条款 | P2 |
| Project Archive unarchive / --dry-run / --force / file_links cascade | P1（Phase 2 残留） |
| Event Purge --dry-run / --all / 确认 | P2（Phase 2 残留） |
| /agentlink TypeScript 代码支持 | P2（Phase 2 残留） |

---

## 📊 总结

| 阶段 | Issues | 状态 |
|------|--------|------|
| Phase 1 计划 | #1-#8 | ✅ 全部 close |
| 文档审计修正 | #9-#10 | ✅ 全部 close |
| Phase 1 偏差审查 | #11-#18 | ✅ 全部 close（含 3 项复盘 comment） |
| Phase 2 计划 | #19-#23 | ✅ 全部 close |
| Phase 2 偏差审查 | #24-#26 | 🔴 待修复 |
| **总计** | **26** | **5 close / 3 open** |

### 🔴 Phase 2 发布阻塞清单（按 priority）

1. **#24 分支与 PR 流程** — 下个 Phase 必须 `feat/*` 分支 + PR
2. **#26 版本号** — package.json + CHANGELOG + README 全部升到 0.2.0
3. **#25 retry 集成** — `withRetry()` 接入 MCP handler + database 层
