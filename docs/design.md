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
    path?: string,          // 文档路径（相对仓库根，与 script 至少提供一个）
    script?: string         // 相关脚本/文件路径
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
## mcp-agentlink Config

enabled: true    ← false 时断开连接
project: payment-rebuild
role: api-owner
sender: repo-A/coder
workpath: /home/user/repo-A
giturl: https://github.com/user/repo-A
server_url: https://mcp-agentlink.example.com
```

- `enabled: false` → 不 register、不 postEvent、不 queryEvents
- `enabled: true` → 正常走完整流程

**Token 安全：** token 不写入版本控制文件。`init` 流程将 token 存入独立文件 `.mcp-agentlink.token`，加入 `.gitignore`。Agent 运行时从该文件读取 token，**工作区文件（CLAUDE.md / AGENTS.md / CODEBUDDY.md）不包含 token**。

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
| 存储 | SQLite（sql.js，纯 JS/WASM，无需编译） |
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
        │   server_url: <url>
        │   同时将 token 写入 .mcp-agentlink.token（已在 .gitignore 中）
        │   注：token 不写入版本控制文件，防止泄露到仓库历史
    ↓
Step 5: Agent 调用 register tool → 中心确认
    ↓
Step 6: Agent 就绪，开始工作
```

---

## 五、MVP 接口定义

### 分层说明

系统分两层：

|层|职责|示例|
|---|---|------|
|**Client 本地操作**|纯本地，不调服务端 API|`init` — Q&A 引导 + 写配置文件|
|**Server MCP Tools**|服务端提供，client 通过 MCP 协议代理调用|`register`、`postEvent`、`queryEvents`|

Client 包不重复实现 `register/postEvent/queryEvents`——它通过 MCP 协议代理到 server 端执行。

---

### Client 本地操作：init

- 触发 Q&A 流程，采集：project / role / sender / workpath / giturl / server_url / token
- 将非敏感配置写入 workspace 文件（CLAUDE.md / AGENTS.md）
- 将 token 写入独立文件 `.mcp-agentlink.token`（已在 `.gitignore` 中）
- **不调用任何服务端 API**

```typescript
interface InitParams {
  project: string;
  role: string;         // kebab-case
  sender: string;       // 格式: <repo>/<agent-id>
  workpath: string;     // 本地绝对路径
  giturl: string;       // Git 远程地址
  server_url: string;   // MCP 服务器地址
  token: string;        // 写入 .mcp-agentlink.token，不入 workspace
}
// 返回: { configWritten: boolean }
```

---

### Server MCP Tools

所有 server tool 统一鉴权方式：请求头携带 token。错误响应统一格式（见 §七 错误码）。

#### register

agent 向中心注册身份和路径。

```typescript
interface RegisterParams {
  project: string;
  sender: string;
  role: string;
  workpath: string;
  giturl: string;
  token: string;
}
// 返回: { registrationId: string, status: "online" }
```

- 使用 token 鉴权
- 中心记录 agent 在线状态
- **幂等规则**：
  - 同一 agent 用相同 sender 重新 register → 更新 `last_seen` + `workpath`/`giturl`，不报错
  - 不同 agent 试图用已被占用的 sender 注册 → 返回 `SENDER_CONFLICT` 错误
  - 实现：`registrations` 表加 `(project_id, sender)` UNIQUE 约束，register 时检查 sender 是否已被**不同** registration_id 占用

#### postEvent

向中心发送一条事件。

```typescript
interface PostEventParams {
  project: string;
  type: "start" | "finish" | "milestone" | "error" | "assignment";
  summary: string;       // 一句话摘要（省 token）
  scope: string;         // 目标 role 名称，或 "*" 表示所有人
  docRef?: {
    path?: string;        // 文档路径（相对仓库根，与 script 至少提供一个）
    script?: string;      // 相关脚本/文件路径
  };
  token: string;
}
// 返回: { eventId: string }
```

- agent 完成长任务链时自动调用
- 若 scope 指向特定 role，agent 提示用户手动通知下游

#### queryEvents

从中心查询事件。

```typescript
interface QueryEventsParams {
  project: string;
  scope?: string;       // 按 role 过滤，缺省返回全部
  type?: string;        // 按事件类型过滤
  sinceId?: string;     // 只返回大于此 ID 的新事件（client 本地游标用）
  token: string;
}
// 返回: { events: Event[] }
```

- client 端维护 `last_queried_event_id` 游标，避免重复拉取已处理事件
- Event 结构见 §二 Event

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
3. agent 在 init 时由用户手动填入，存入 `.mcp-agentlink.token`（不入版本控制）
4. 每次 MCP 调用携带 token
5. 项目归档后 token 自动失效

**Token 格式：**

```text
生成: crypto.randomBytes(32).toString('hex')  →  64 字符 hex 字符串
存储: SHA-256 哈希存入 tokens.token_hash，原始 token 永远不落盘
传输: 请求头 Bearer 或参数 token
```

---

### 错误码

所有 Server MCP Tool 返回统一错误格式：

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    detail?: any;
  }
}
```

预定义错误码：

|错误码|HTTP 类比|触发条件|
|---|---|------|
|`INVALID_TOKEN`|401|token 无效或已吊销|
|`PROJECT_NOT_FOUND`|404|project 不存在或已归档|
|`UNAUTHORIZED_SCOPE`|403|token 的 role 无权访问目标 scope|
|`VALIDATION_ERROR`|400|请求参数不合法（缺字段/格式错）|
|`SENDER_CONFLICT`|409|sender 已被**不同 agent** 占用；同一 agent 重复注册幂等不报错|
|`INTERNAL_ERROR`|500|服务端内部错误|

---

## 八、存储设计

### 数据库：SQLite（sql.js）

实现使用 **sql.js**（SQLite 编译为 WebAssembly，纯 JS 无原生编译依赖）
而非 `better-sqlite3`（需要 C++ 编译工具链），以降低 Windows 环境安装门槛。
需原生性能时可切换为 `better-sqlite3`——API 层面已做抽象，更换驱动只需修改 `database.ts`。

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

**并发处理：** MVP 阶段启用 WAL 模式（`PRAGMA journal_mode=WAL`），写操作加超时重试。Phase 3 评估是否需要迁移到 PostgreSQL。

**数据库迁移：** 采用文件约定 + CLI 命令：

```text
packages/server/migrations/
├── 001_initial.sql           # 初始建表
├── 002_add_event_index.sql   # 新增索引
└── ...
```

- CLI 命令：`mcp-agentlink server migrate` 按序号顺序执行未应用的迁移
- 通过 `_migrations` 表记录已应用的迁移版本

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

Server MCP Tools:
  ├── register（身份注册 + 路径登记）
  ├── postEvent（发事件）
  └── queryEvents（查事件）

Client 本地功能:
  └── init（Q&A 引导，写入 workspace 和 token 文件）

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

### Phase 4 ✅

```text
  ├── PM 角色机制（register --role pm、project close）
  ├── Charter 系统（五层框架、publishCharter/syncCharter）
  ├── 本地存储重构（两层结构：全局 + 项目级）
  ├── 数据流重构（五阶段流程、/agentlink sync）
  ├── CLI 输出增强（表格、JSON、分页）
  ├── Skill 正式化（自动注册 skill）
  └── Sender 自动生成（{repo}/{agent} 格式）
```
