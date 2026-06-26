# 待定事项清单

> 以下事项需要你决策后才能进入实现阶段。按优先级排列。

---

## Phase 4 范围

### R1. Phase 4 是否拆分为两个 Phase？ ✅ 已关闭

**最终决策**：不拆分，合并为一个 Phase (v0.5.0) 完成。P0/P1 核心机制（PM + Charter + 数据流 + 本地存储）与 P2 增强项（CLI 体验 + Skill 正式化 + Sender 自动生成）在同一个里程碑中实现。

> **来源**：审计报告 H2
> **关联**：[design.md](design.md) §十三、[architecture-overview.md](architecture-overview.md)
> **关闭于**：v0.5.0 完成审查

---

## 领域模型

### R2. Sender 格式统一

当前多个文档写了三种不同格式：

| 格式 | 示例 | 来源 |
|------|------|------|
| `{hostname}/{role}` | `my-pc-api-owner` | design.md |
| `{人名}/{role}` | `davi/api-owner` | architecture-overview.md |
| `{repo}/{agent}` | `repo-A/coder` | CLAUDE.md / CODEBUDDY.md（旧） |

**关键矛盾**：`{人名}/{role}` 格式中 role 出现在 sender 里，与 sender/role 分离的设计理念冲突。

**需决策**：选一种格式统一所有文档。

> **来源**：审计报告 H4

> **意见**： 我们明确 sender和role的概念需要区分； role是扮演的角色 比如 coder/tester/pm/admin 诸如此类；sender是一个比较自由的概念，我觉得`{repo}/{agent}`最好

### R3. Project status 枚举

当前设计新增了 `closed` 状态（PM 结项），需要确认：

- 最终枚举为 `active / archived / closed` 三个值？
- 或者用更复杂的枚举？（如 `active / paused / archived / closed`）

> **来源**：审计报告 H3

> **意见**：`active / archived / closed` 三个值

---

## Charter 内容

### R4. Charter 五层框架内容确认

当前的五层框架：

```text
① 方向      → 我们要去哪         （愿景）
② 都有谁    → 参与的人/角色
③ 谁干什么  → 各人职责           （分工）
④ 怎么做    → 做事标准和规则
⑤ 什么顺序  → 先后依赖关系
```

**需确认**：
- 各层是否需要展开子字段？比如"① 方向"包含 vision + goals？
- 格式倾向 YAML 还是 Markdown？
- 版本管理规则？

> **来源**：Charter 设计讨论
> **关联**：[design.md](design.md) §二 Charter

> **意见**：方向 :我觉得文字字段也可以 因为todo我们依托github issue;都有谁 : sender + role;谁干什么 : sender + github issue;怎么做 : sender + github issue;什么顺序 : sender + github milestone + github issue;

### R5. Charter 的 publishCharter / syncCharter 是否需要版本管理？

PM 更新 Charter 后，Agent sync 时：
- 全量覆盖（简单，当前设计）
- 还是按版本号增量拉取？

> **来源**：design.md §七 MCP 工具定义

> **意见**：timestamp + guid 我觉得可以保证唯一性和时间先后顺序就可以了

---

## PM 角色

### R6. PM 是否可以兼任其他 role？

比如一个 Agent 注册为 `pm`，是否还可以同时注册为 `api-owner`？

> **来源**：PM 角色设计讨论
> **关联**：[pm-role-design.md](pm-role-design.md)

> **意见**：不可以 pm 是独立的 如果同一个agent 那么需要再注册一个token

### R7. PM 注册后如何分发 token 给其他 Agent？

设计上 PM 可以生成 token，但分发路径未定义：
- 由开发者通过外部渠道（IM、邮件）传递？
- 还是 PM 的 Agent 在 CLI 输出 token，开发者手动复制？

> **来源**：Phase 2 数据流讨论

> **意见**：不用系统管 需要在server的cli命令中创建的时候有一个返回 同时可以删改查

---

## 本地缓存

### R8. `cache/{project-id}/` 是否只放 `charter.yaml`？

当前设计缓存精简为主要存 Charter，但不确定：
- 是否需要同步元数据？（如 `sync-meta.json` 记录上次 sync 时间）
- 是否需要存其他文件？

> **来源**：design.md §三、architecture-overview.md §4

> **意见**：我觉得没什么别的了 这个文档里面可以包含时间戳+唯一id能找到就可以了

### R9. sync 的触发时机

Agent 什么时候执行 `/agentlink sync`？
- 启动时自动 sync？
- 收到新事件（milestone）时自动 sync？
- 仅手动执行？

> **来源**：数据流 Phase 3 讨论

> **意见**：手动触发 暂时先不要这么自动 因为需要更新的内容并不是很频繁

---

## 错误码

### R10. 统一错误码命名

| design.md | user-manual.md | 需决策 |
|-----------|----------------|--------|
| `UNAUTHORIZED_SCOPE` | `PERMISSION_DENIED` | 用哪个名称？ |
| — | `UNKNOWN_TOOL` | 是否保留？ |
| `INTERNAL_ERROR` | — | 是否加入 user-manual？ |

> **来源**：审计报告 G4

> **意见**： 名称随便 但是需要统一 而且错误码可能得更强壮和完善一些

**决议**：统一为 `UNAUTHORIZED_SCOPE`（已在 design.md 中使用）。保留 `UNKNOWN_TOOL`。`INTERNAL_ERROR` 加入 user-manual。

---

## CLI 命令

### R11. Slash 命令名称

当前：

```text
/agentlink init      # 本地初始化
/agentlink sync      # 拉取远端 Charter
```

这个命名 OK 吗？是否需要调整？（比如 `/agentlink init` 和 `/agentlink refresh`？）

> **来源**：Phase 3 数据流讨论

> **意见**：这个你来定就好

**决议**：保持现有命名 `init / sync / status / on / off`，不做调整。
