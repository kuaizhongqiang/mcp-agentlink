# 包发布规范

## 双包 monorepo

```
mcp-agentlink/
├── packages/
│   ├── server/   # mcp-agentlink-server (npm)
│   └── client/   # mcp-agentlink-client (npm)
```

- 两个包各自独立版本号（server v0.1.0 + client v0.2.0 可以不同步）
- 各自维护独立 CHANGELOG.md
- 各自走独立 CI/CD 流水线

## 每个发布包必须包含

```
package-name/
├── README.md       # Agent 可读 —— 用途、概念、快速开始、MCP 工具清单
├── CHANGELOG.md    # 按版本记录变更
├── skill/          # Client 包的核心交付物
│   └── skill.md
└── dist/           # 编译产物
```

## README 要求

写给 agent 看，包含：
- 这个包是做什么的
- 核心概念（Project / Sender / Role）
- 快速开始（安装、连接、注册）
- MCP 工具清单（client 包）
- CLI 命令清单（server 包）

## CHANGELOG 格式

```markdown
## [0.2.0] - 2026-06-22

### Added
- 新增 xxx 功能

### Changed
- xxx 变更描述

### Fixed
- 修复 xxx 问题
```

## Commit 规范

```
分支命名: feat/* | fix/* | docs/* | refactor/* | chore/*
Commit: 末尾加 Co-Authored-By 行（各 agent 写各自的标识）
```

- CLAUDE.md 相关 commit → `Co-Authored-By: Claude <noreply@anthropic.com>`
- CODEBUDDY.md 相关 commit → `Co-Authored-By: CodeBuddy <noreply@agent.local>`
