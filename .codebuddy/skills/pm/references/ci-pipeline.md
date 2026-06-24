# CI/CD 流水线规范

## 触发方式

- **push** 到任意分支 → 自动触发 lint + typecheck + test + build
- **push tag**（`v*`）→ 自动触发 npm publish
- **PR merge** 到 main → 自动打 tag + 触发发布

## 流水线阶段

```
push → lint/typecheck → test → build → [tag vX.Y.Z → npm publish]
                                        ↑ main 分支或 tag push 才执行
```

| 阶段 | 工具 | 说明 |
|------|------|------|
| lint | ESLint | 代码风格检查 |
| typecheck | `tsc --noEmit` | TypeScript 类型检查 |
| test | vitest | 单元测试 + 集成测试 |
| build | `tsc` | TypeScript 编译 |
| tag | 自动 | semver tag，仅 main 分支 |
| publish | npm | 发布到 npm registry |

## 版本号策略

语义化版本（semver）：

- **patch** — bugfix、文档更新
- **minor** — 新增功能，向后兼容
- **major** — 不兼容的 API 变更

tag 格式：`v<major>.<minor>.<patch>`（如 `v0.1.0`）

两个包（server / client）各自独立版本号，各自走独立 CI/CD 流水线。

## 测试要求

- **单元测试**：storage 层 CRUD + auth middleware，覆盖率 >80%
- **集成测试**：MCP tools 端到端（启动 server → register → postEvent → queryEvents）
- **不做 E2E**（无 UI）
