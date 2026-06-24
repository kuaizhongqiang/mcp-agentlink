# PR 模板与合入规则

## 模板

```yaml
closes:        # 关联 issue 编号（必填）
type:          # fix | feat | refactor | docs | chore
changelog:     # 一句话变更描述（写入 CHANGELOG）
breaking:      # true | false （是否破坏性变更）
affected:      # [server | client | docs | ci] 受影响的包
```

## 合入条件（全部满足）

- [ ] CI 通过（lint + typecheck + test + build）
- [ ] 关联至少一个 issue
- [ ] CHANGELOG 描述已写入对应包的 CHANGELOG.md
- [ ] 版本号已更新（按 semver）
- [ ] PR 标题遵循 conventional commits：`type(scope): description`

## 自动化

- PR merge 到 main → 自动打 tag + 触发 npm publish
- 自动追加 CHANGELOG（从 PR 模板 changelog 字段）
- 自动关闭关联 issue

## 分支命名

- `feat/*` — 新功能
- `fix/*` — Bug 修复
- `docs/*` — 文档变更
- `refactor/*` — 重构
- `chore/*` — 构建/CI/工具
