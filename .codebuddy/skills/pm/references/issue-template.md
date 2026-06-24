# Issue 模板与规则

## 模板

```yaml
project:   # 所属项目名称（即 mcp-agentlink project 概念，如 payment-rebuild）
sender:    # 发起者身份（仓库 + agent，如 repo-A/coder）
role:      # 发起者角色（kebab-case: api-owner / frontend-consumer / schema-owner / tester）
type:      # bug | feature | improvement | question
scene:     # 场景描述（哪个 agent、在做什么、遇到了什么）
priority:  # high | medium | low
```

## Labels 自动打标

- `type: bug` → label `bug`
- `type: feature` → label `enhancement`
- `type: improvement` → label `improvement`
- `type: question` → label `question`

## 提交流程

- **Phase 1 开发期间**：允许通过 GitHub Web UI 直接提交 issue，不要求通过 skill
- **Phase 2+（skill 就绪后）**：所有 issue 必须通过 `/agentlink` skill 提交，确保结构化

## Milestone 关联

每个 issue 必须关联一个 milestone：
- `MVP (v0.1.0)` — Phase 1 核心功能
- `v0.2.0` — Phase 2 增强
- `v0.3.0` — Phase 3 优化
- `Backlog` — 尚未排期
