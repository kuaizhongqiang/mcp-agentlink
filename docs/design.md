# mcp-agentlink 设计方案

> 跨仓库、跨 AI agent 的通信中枢 —— 中心化存储与注册，让多个独立 context 的 agent 能够协作。

---

## 一、项目定位

**核心理念：**
- 中心只存事实，不判逻辑 —— 依赖关系由 agent 自行判断
- 每个 agent 独立 context，不杂糅
- 按角色（role）划分权限与信息通路
- 半自动化 —— agent 完成工作后提示用户通知下游，不追求全自动推送

---

## 二、领域模型

### Project（项目）

一个独立的工作域，隔离不同项目的数据。

- 可以归档（archive）
- 通过 CLI 管理：`mcp-agentlink project create / archive / list`
- 归档后关联 token 自动失效

### Sender（发送者）

每次操作的发起者身份标识。

- 包含：仓库标识 + agent 实例标识
- 所有写入中心的数据都带有 sender 信息

### Role（角色）

职能标识，用于鉴权和信息路由。

- 示例：`api-owner` / `frontend-consumer` / `schema-owner` / `tester`
- **鉴权按 role 粒度** —— 每个 role 一个 token
- 同 role 的不同 sender 共享 token

### Event（事件）

中心里的核心数据单元，取代传统的"任务"概念。一切皆事件。

```typescript
Event {
  id: string,
  project: string,
  type: "start" | "finish" | "milestone" | "error" | "assignment",
  sender: string,           // 谁发的
  summary: string,          // 一句话摘要
  scope: string,            // 谁应该看到：role 名称 或 "*"
  docRef?: {
    path: string,           // 文档路径（相对仓库根）
    script: string          // 相关脚本/文件路径
  },
  timestamp: string
}
```

**设计原则：**

- 摘要很简短（省 token）
- 详细内容在本地文档里（另一个 agent 自己决定是读摘要还是读脚本）
- scope 用于过滤 —— agent 只拉自己关心的事件

### 开关设计

agent 可以随时关闭 mcp-agentlink 连接，避免不必要的 context 开销：

```markdown
## mcp-agentlink 配置

enabled: true    ← false 时断开连接
project: payment-rebuild
role: api-owner
sender: repo-A/coder
workpath: /home/user/repo-A
giturl: https://github.com/user/repo-A
server_url: https://mcp-agentlink.example.com
token: xxx
```

- `enabled: false` → 不 register、不 postEvent、不 queryEvents
- `enabled: true` → 正常走完整流程

---

## 三、包结构

### mcp-agentlink-server

| 项目 | 说明 |
|------|------|
| 语言 | TypeScript / Node.js |
| 发布 | npm 包 |
| 部署 | Linux 服务器裸跑 |
| 管理 | 自带 CLI 命令 + OpenClaw 调用 |
| 传输 | MCP over SSE |
| 存储 | SQLite |
| 鉴权 | Role 级别 token |

**CLI 命令清单：**

```text
mcp-agentlink help                          # 帮助信息
mcp-agentlink server start                  # 启动服务器
mcp-agentlink server stop                   # 停止服务器
mcp-agentlink server status                 # 查看服务器状态
mcp-agentlink server logs                   # 查看服务器日志
mcp-agentlink project create <name>         # 创建项目
mcp-agentlink project archive <id>          # 归档项目
mcp-agentlink project list                  # 项目列表
mcp-agentlink project show <id>             # 查看项目详情
mcp-agentlink token generate --project <id> --role <role>  # 生成 token
mcp-agentlink token revoke <token>          # 吊销 token
mcp-agentlink token list --project <id>     # 查看 project 下所有 token
mcp-agentlink register list                 # 查看已注册的 agent
mcp-agentlink event list --project <id>     # 查看事件列表
```

### mcp-agentlink-client

| 项目 | 说明 |
|------|------|
| 语言 | TypeScript / Node.js |
| 发布 | npm 包 |
| 安装 | Agent 自主 `npm install mcp-agentlink-client` |
| 安装产物 | README.md + skill/ 目录（skill.md + 相关资源） |
| 交付能力 | 一组 MCP tools + skill 规则供 agent 调用 |

---

## 四、Agent 初始化流程

```text
Step 1: 用户告诉 agent "接入 mcp-agentlink"
        └── 已接入过的 agent 也可以通过 `/agentlink` 启动
    ↓
Step 2: Agent 检查 workspace 中是否已有注册信息
        └── 有, enabled=true → 跳至 Step 5（自动 register）
        └── 有, enabled=false → 跳过，断开
        └── 无 → 执行 Step 3
    ↓
Step 3: Agent 通过 Q&A 向用户提问：
        ├── "你要接入哪个 project？"
        ├── "你的 role 是什么？"
        ├── "你的 sender 标识是什么？"
        ├── "你的工作路径是什么？"
        ├── "你的 Git 地址是什么？"
        └── "你的 token 是什么？"
    ↓
Step 4: Agent 写入 workspace 文件（CLAUDE.md / AGENTS.md）
        │   enabled: true
        │   project: <name>
        │   role: <role>
        │   sender: <id>
        │   workpath: <本地路径>
        │   giturl: <远程地址>
        │   token: <token>
        │   server_url: <url>
    ↓
Step 5: Agent 调用 register tool → 中心确认
    ↓
Step 6: Agent 就绪，开始工作
```

---

## 五、MVP MCP Tools

一共 4 个 tool：

### init

- 触发 Q&A 流程
- 将注册信息写入 workspace 文件
- 等同于在 agent 上下文中注入"你是谁、你在哪、怎么连接"

### register

- agent 向中心注册（project + sender + role + workpath + giturl）
- 使用 token 鉴权
- 中心记录 agent 在线状态

### postEvent

- 向中心发送一条事件
- 包含：type / summary / scope / docRef
- agent 完成长任务链时自动调用

### queryEvents

- 从中心查询事件
- 过滤条件：project / scope / type / 时间范围

---

## 六、Skill 行为规则

skill.md 中定义的 agent 行为（非 slash command，自动执行）：

```text
1. 启动时：
   - 若 enabled=true → 自动 register + queryEvents（查 scope 为自己的事件）

2. 完成一个长任务链时：
   - 写本地文档：摘要 + 涉及脚本路径 + 涉及文档
   - 自动 postEvent 到中心
   - 若事件 scope 指向特定 role → 提示用户去通知那个 agent

3. 日常工作中遇到相关变更：
   - 自动 queryEvents 检查是否有新事件
   - 根据事件中的 docRef 决定读摘要还是读脚本
```

---

## 七、鉴权模型

| 层次 | 粒度 | 说明 |
|------|------|------|
| Project 隔离 | project 级别 | 不同 project 的数据不可互访 |
| Role 鉴权 | role 级别 | 每个 role 一个 token |
| Token 管理 | CLI 生成 | `mcp-agentlink token generate --project <id> --role <role>` |

**Token 使用方式：**
1. 管理员通过 CLI 为 project 下的每个 role 生成 token
2. token 分发给对应 role 的 agent 使用者
3. agent 在 init 时由用户手动填入
4. 每次 MCP 调用携带 token
5. 项目归档后 token 自动失效

---

## 八、存储设计

### 数据库：SQLite

```sql
-- 项目表
projects (
  id, name, description, status (active/archived), created_at, updated_at
)

-- 注册表
registrations (
  id, project_id, sender, role, token_hash,
  workpath,        -- 本地路径（MCP 读写文件用）
  giturl,          -- Git 远程地址（跨仓库引用用）
  last_seen, status (online/offline)
)

-- 事件表
events (
  id, project_id, type, sender, summary, scope,
  doc_path, doc_script, timestamp
)

-- Token 表
tokens (
  id, project_id, role, token_hash, status (active/revoked), created_at
)
```

---

## 九、流水线与发布

### CI/CD

```text
push → lint/typecheck → test → build → [tag vX.Y.Z → npm publish]
                                   ↑ main 分支或 tag push 才执行
```

### 包规范

每个包发布时包含：
- README.md（agent 可读，说明用途和概念）
- CHANGELOG.md（按版本记录变更，agent 可查）
- skill/ 目录（client 包的核心交付物）
- 代码

### Issue / PR 规则

- 必须通过 skill 提交，确保结构化
- Issue 模板：project / sender / role / type / scene / priority
- PR 模板：closes / type / changelog / breaking / affected
- PR 合入条件：CI 通过 + 关联 issue + CHANGELOG 更新

---

## 十、部署架构

```text
硬件: Linux 服务器（家中）
网络: 实名域名 → Cloudflare → 服务器
运行: 裸跑（无容器化）

服务器上运行:
├── OpenClaw CLI     ← AI agent 框架
└── mcp-agentlink    ← 中心服务器（mcp-agentlink-server）
    -server          ← Node.js 进程 + SQLite
```

---

## 十一、开发路线图

### Phase 1（MVP）

```text
Server 骨架:
  ├── 项目初始化（TypeScript + 包结构）
  ├── CLI 框架（help / server start-stop / project CRUD / token CRUD / event list）
  └── MCP Server over SSE

存储层:
  ├── SQLite 建表（projects / registrations / events / tokens）
  └── CRUD 操作

MCP Tools:
  ├── register（身份注册 + 路径登记）
  ├── postEvent（发事件）
  ├── queryEvents（查事件）
  └── init（Q&A 引导，写入 workspace）

Client 包:
  ├── skill.md（行为规则）
  ├── README.md（agent 可读的概念说明）
  └── npm 打包配置

DevOps:
  ├── CI/CD 流水线
  ├── CHANGELOG 规范
  └── 首版发布（v0.1.0）
```

### Phase 2

```text
  ├── /agentlink 命令（开关切换、状态查询）
  ├── 文件 link 能力（repo A ↔ repo B 文件映射）
  ├── 项目归档完整流程
  └── 错误处理与重试机制
```

### Phase 3

```text
  ├── 事件历史与统计
  ├── 更丰富的鉴权粒度
  ├── 性能优化
  └── 监控与日志
```
