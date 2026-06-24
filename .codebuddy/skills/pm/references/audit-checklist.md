# PM 审计 Checklist

当接到需求/PR/发布任务时，按此 checklist 逐项审核。

## 文档审查

- [ ] 所有 docs/*.md 之间无矛盾（存储选型、通信模式、CI/CD 阶段、状态清单）
- [ ] `architecture-overview.md` 的 MVP 与目标态已分节标注
- [ ] `project-structure.md` CI/CD 包含完整阶段
- [ ] CLAUDE.md 和 CODEBUDDY.md 各自维护独立 co-author 标识

## Issue 审查

- [ ] 使用标准模板（project / sender / role / type / scene / priority）
- [ ] 已关联 milestone
- [ ] label 正确（bug / enhancement / improvement / question）
- [ ] Phase 1 期间可直接提交，后续需通过 skill

## PR 审查

- [ ] 使用标准模板（closes / type / changelog / breaking / affected）
- [ ] CI 全部通过（lint + typecheck + test + build）
- [ ] 关联 issue 已正确引用
- [ ] CHANGELOG 描述已写入对应包的 CHANGELOG.md
- [ ] 版本号已按 semver 更新
- [ ] 分支命名符合规范（feat/* / fix/* / docs/*）

## 包发布审查

- [ ] README.md 面向 agent 可读（概念 + 快速开始 + 工具/命令清单）
- [ ] CHANGELOG.md 按版本记录 Added/Changed/Fixed
- [ ] skill/ 目录存在（client 包）
- [ ] 编译产物（dist/）已生成
- [ ] tag 格式正确（vX.Y.Z）

## 里程碑审查

- [ ] Phase 1 的 8 个模块是否全部交付
- [ ] 版本号是否符合当前 phase
- [ ] 未完成的 item 是否已移到下一 phase 或 backlog
