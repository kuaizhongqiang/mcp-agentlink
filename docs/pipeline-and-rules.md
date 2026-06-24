# mcp-agentlink 流水线与发布规则

> 修路通车 —— 自动化流水线让每次改动都能快速交付、真实测试。

---

## 一、CI/CD 流水线

### 触发方式

- **push** 到任意分支 → 自动触发构建 + 测试
- **push tag** → 自动触发发布
- **PR merge** 到 main → 自动打 tag + 发布

### 流水线阶段

```
push → lint/typecheck → test → build → [tag → publish]
                                    ↑ main 分支或 tag push 才执行
```

| 阶段 | 说明 |
|------|------|
| lint / typecheck | ESLint + TypeScript 类型检查 |
| test | 单元测试 + 集成测试 |
| build | 构建产物 |
| tag | 自动打版本 tag（semver） |
| publish | 自动发布到 npm / PyPI / 其他 |

### 版本号策略

语义化版本（semver）：

- **patch** — bugfix、文档更新
- **minor** — 新增功能，向后兼容
- **major** — 不兼容的 API 变更

tag 格式：`v<major>.<minor>.<patch>`（如 `v0.1.0`）

---

## 二、包规范

每个发布包必须包含：

```
package-name/
├── README.md       # Agent 可读的说明 —— 用途、概念、快速开始
├── skill/          # 打包发布的 Skill —— 跟随包的版本
│   └── skill.md
├── CHANGELOG.md    # 变更记录 —— Agent 更新后查询 "改了什么"
└── ... (代码)
```

### README 要求

写给 agent 看的，不是给人看的。包含：
- 这个包是做什么的
- 核心概念（Project / Sender / Role）
- 快速开始（安装、连接、注册）
- MCP 工具清单

### CHANGELOG 要求

每个版本记录：

```
## [0.2.0] - 2026-06-22

### Added
- 新增 link-file 工具
- 新增按 role 查询订阅

### Changed
- 注册协议字段调整：sender 改为结构化对象

### Fixed
- 鉴权 token 过期未自动刷新
```

---

## 三、Issue 规则

所有 issue 必须通过 skill 提交，确保结构化。

> **Phase 1 豁免**：skill（`/agentlink` 命令）是 Phase 2 产物。Phase 1 开发期间允许通过 GitHub Web UI 直接提交 issue，skill 就绪后切换。

### Issue 模板

```yaml
project:   # 所属项目名称
sender:    # 发起者身份（仓库 + agent）
role:      # 发起者角色
type:      # bug | feature | improvement | question
scene:     # 场景描述（哪个 agent、在做什么、遇到了什么）
priority:  # high | medium | low
```

### 自动操作

- 提交时自动打 label（bug / feature / 等）
- 自动分配维护者（按 project 路由）
- 自动关联相关 issue（中心查询相似场景）

---

## 四、PR 规则

所有 PR 必须通过 skill 提交，必须关联 issue。

> **Phase 1 豁免**：同上，Phase 1 期间允许通过 GitHub Web UI 直接提交 PR。

### PR 模板

```yaml
closes:        # 关联 issue 编号
type:          # fix | feat | refactor | docs | chore
changelog:     # 一句话变更描述（写入 CHANGELOG）
breaking:      # true | false （是否破坏性变更）
affected:      # [affected packages]
```

### 合入条件

- [ ] CI 通过（lint + test + build）
- [ ] 关联至少一个 issue
- [ ] CHANGELOG 描述写入
- [ ] 版本号已更新

### 自动操作

- PR merge 到 main → 自动打 tag + 触发发布
- 自动生成 / 追加 CHANGELOG
- 自动关闭关联 issue
