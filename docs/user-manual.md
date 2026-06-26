# mcp-agentlink 用户手册

> **版本**: v0.5.0 | 跨项目、跨 Agent 通信的 MCP 中心服务器
>
> 涵盖 Phase 1-4 全部功能：PM 角色、Charter 系统、本地缓存、事件驱动协作。

---

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [服务器管理](#3-服务器管理)
4. [项目管理](#4-项目管理)
5. [Token 认证](#5-token-认证)
6. [Agent 注册](#6-agent-注册)
7. [事件系统](#7-事件系统)
8. [文件链接](#8-文件链接)
9. [Charter 管理](#9-charter-管理)
10. [MCP 工具](#10-mcp-工具)
11. [REST API](#11-rest-api)
12. [客户端接入](#12-客户端接入)
13. [Agent 行为规则](#13-agent-行为规则)
14. [Slash 命令](#14-slash-命令)
15. [错误处理与重试](#15-错误处理与重试)
16. [最佳实践](#16-最佳实践)
17. [常见问题](#17-常见问题)

---

## 1. 概述

### 1.1 什么是 mcp-agentlink

mcp-agentlink 是一个 **MCP（Model Context Protocol）中心服务器**，专为解决多 AI Agent 协作问题设计。它提供了一个集中的存储和注册中心，让多个拥有独立上下文的 AI 编码 Agent 能够：

- **注册身份** — 告知中心"我是谁、我在哪、我在做什么项目"
- **发布事件** — 在完成任务后通知其他 Agent
- **查询事件** — 拉取与自己相关的工作状态
- **文件关联** — 建立跨仓库的文件映射关系

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **中心只存事实，不做判断** | 服务器存储 events/registrations 等数据，Agent 自行决定是否响应 |
| **独立上下文** | 每个 Agent 上下文完全独立，不混用 |
| **事件驱动通信** | Agent 之间通过事件通信，而非共享上下文 |
| **半自动化** | Agent 通知用户，由用户决定是否/如何转达给下游 Agent |
| **可开关** | 每个 Agent 可通过 workspace 配置开关连接 |

### 1.3 架构图

```
                    ┌──────────────┐
                    │  Cloudflare   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  Linux 服务器  │
                    │  (bare metal) │
                    │               │
                    │ mcp-agentlink │
                    │   -server     │
                    └──────┬───────┘
                           │ MCP over SSE
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    Agent A            Agent B            Agent C
   npm install        npm install        npm install
   mcp-agentlink      mcp-agentlink      mcp-agentlink
   -client            -client            -client
```

### 1.4 包结构

| 包 | 版本 | 说明 |
|----|------|------|
| `mcp-agentlink-server` | v0.5.0 | 中心服务器：CLI + SQLite + MCP over SSE + 认证 + REST API |
| `mcp-agentlink-client` | v0.5.0 | 客户端库：初始化 Agent 配置、skill 规则、MCP 代理 |

---

## 2. 快速开始

### 2.1 启动服务器

```bash
# 安装后直接启动（默认端口 3000）
mcp-agentlink server start

# 指定端口
mcp-agentlink server start --port 8080
```

启动日志：

```
[mcp-agentlink] MCP server listening on http://localhost:3000/sse
```

### 2.2 创建项目和 Token

```bash
# 创建项目
mcp-agentlink project create my-project

# 生成 Token（同一项目可有多个角色各自的 Token）
mcp-agentlink token generate --project my-project --role api-owner
```

输出示例：

```
✅ Token generated:
  Token:       a1b2c3d4e5f6... (64位十六进制字符串)
  ID:          uuid-xxxx
  Role:        api-owner
  Permissions: write
  Status:      active
  ⚠️  这是唯一一次显示原始 Token，请妥善保管！
```

### 2.3 连接 Agent

Agent 安装客户端包后，通过 Q&A 流程配置：

```bash
npm install mcp-agentlink-client
# 然后 Agent 运行 init 流程，回答：项目ID、角色、Sender标识、工作路径、Git地址、服务器URL、Token
```

配置写入后，Agent 能通过 MCP 工具调用中心和 REST API 进行通信。

### 2.4 验证服务器状态

```bash
# 查看整体状态
mcp-agentlink status

# 健康检查（HTTP）
curl http://localhost:3000/health
```

---

## 3. 服务器管理

### 3.1 命令列表

| 命令 | 说明 |
|------|------|
| `mcp-agentlink server start` | 启动 MCP over SSE 服务器 |
| `mcp-agentlink server stop` | 停止服务器 |
| `mcp-agentlink server status` | 查看运行状态 |
| `mcp-agentlink server logs` | 查看日志指引 |
| `mcp-agentlink server cleanup-registrations` | 清理超时注册 |

### 3.2 启动服务器

```bash
mcp-agentlink server start --port 3000
```

- 默认端口：3000
- 监听 `/sse`（SSE 流端点）和 `/message`（消息端点）
- 健康检查：`GET /health`
- 数据库自动创建在 `~/.mcp-agentlink/data.db`
- 可通过环境变量 `MCP_AGENTLINK_DB_PATH` 自定义数据库路径

### 3.3 查看服务器状态

```bash
mcp-agentlink server status
```

输出示例：

```
Status:    🟢 Running
Sessions:  2
```

### 3.4 清理过期注册

当 Agent 断线后未正常下线时，可手动清理：

```bash
# 标记超过3600秒（1小时）未更新的注册为离线
mcp-agentlink server cleanup-registrations --timeout 3600
```

### 3.5 全局状态概览

```bash
mcp-agentlink status
```

输出示例：

```
mcp-agentlink v0.5.0
Projects:      3
Registrations: 5/8 online
Events:        42
Active tokens: 6
```

---

## 4. 项目管理

### 4.1 命令列表

| 命令 | 说明 |
|------|------|
| `mcp-agentlink project create <name>` | 创建项目 |
| `mcp-agentlink project list` | 列出所有项目 |
| `mcp-agentlink project show <id>` | 查看项目详情 |
| `mcp-agentlink project archive <id>` | 归档项目 |
| `mcp-agentlink project unarchive <id>` | 恢复项目 |

### 4.2 创建项目

```bash
# 创建项目（ID 自动由名称转换：小写+连字符）
mcp-agentlink project create "My Project"

# 创建项目并添加描述
mcp-agentlink project create "Payment Rebuild" --description "重构支付系统"
```

项目 ID 由名称自动生成：`My Project` → `my-project`。

### 4.3 查看项目

```bash
# 列出所有
mcp-agentlink project list

# 查看详情（含统计）
mcp-agentlink project show my-project
```

详情输出示例：

```
ID:          my-project
Name:        My Project
Description: 测试项目
Status:      active
Registrations: 2
Events:      15
Active tokens: 3
File links:  1
Created:     2026-06-25 10:00:00
Updated:     2026-06-25 12:00:00
```

### 4.4 归档项目

归档项目会级联执行以下操作：
1. 将项目状态设为 `archived`
2. **撤销项目的所有 Token**（全部设为 `revoked`）
3. **将所有注册标记为离线**

```bash
# 归档（安全模式，预览要操作的内容）
mcp-agentlink project archive my-project --dry-run

# 归档（需要确认）
mcp-agentlink project archive my-project

# 归档（跳过确认）
mcp-agentlink project archive my-project --force

# 硬归档：删除所有事件、注册记录和文件链接（不可恢复！）
mcp-agentlink project archive my-project --force --hard
```

### 4.5 恢复项目

```bash
# 恢复（需要确认）
mcp-agentlink project unarchive my-project

# 恢复（跳过确认）
mcp-agentlink project unarchive my-project --force
```

恢复操作：
1. 项目状态恢复为 `active`
2. 恢复所有被撤销的 Token（设为 `active`）
3. 将所有注册标记为 `online`

### 4.6 结项

项目结项由 PM 执行。结项后项目不再接受新事件和注册。

```bash
# 结项（需要确认）
mcp-agentlink project close my-project

# 结项（跳过确认）
mcp-agentlink project close my-project --force
```

结项操作：
1. 项目状态设为 `closed`
2. 后续 `postEvent` 操作将被拒绝
3. 后续注册操作将被拒绝

> 已关闭的项目可通过归档/恢复流程重新激活（归档 → 恢复）。

---

## 5. Token 认证

### 5.1 命令列表

| 命令 | 说明 |
|------|------|
| `mcp-agentlink token generate` | 生成 Token |
| `mcp-agentlink token revoke <token>` | 撤销 Token |
| `mcp-agentlink token list` | 列出项目所有 Token |

### 5.2 生成 Token

```bash
# 生成 write 权限的 Token（默认）
mcp-agentlink token generate --project my-project --role api-owner

# 生成 read-only Token
mcp-agentlink token generate --project my-project --role frontend-consumer --perms read

# 生成 admin Token
mcp-agentlink token generate --project my-project --role admin --perms admin
```

**权限层级**：

```
read < write < admin
```

- `read` — 只允许查询事件和状态
- `write`（默认）— 允许注册、发布事件、创建链接
- `admin` — 允许所有操作

### 5.3 Token 生成规则

- Token：64 位十六进制随机字符串（`randomBytes(32).toString("hex")`）
- 存储：**SHA-256 哈希**，永不存储原始 Token
- 同一项目可以有多个 Token，每个绑定一个角色

### 5.4 撤销 Token

```bash
# 通过 Token 值撤销
mcp-agentlink token revoke a1b2c3d4...

# 列出项目所有 Token
mcp-agentlink token list --project my-project
```

Token 一旦撤销，使用该 Token 的 Agent 将无法进行任何操作，直到换用新的 Token。

---

## 6. Agent 注册

### 6.1 命令列表

| 命令 | 说明 |
|------|------|
| `mcp-agentlink register list` | 列出注册的 Agent |

### 6.2 注册信息

Agent 通过 MCP 工具的 `register` 或 REST API 的 `POST /api/agent/register` 进行注册。注册包含以下信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| `project` | 项目 ID | `my-project` |
| `sender` | Agent 标识符 | `repo-A/coder` |
| `role` | 功能角色（kebab-case） | `api-owner` |
| `workpath` | 工作目录绝对路径 | `/home/user/repo-A` |
| `giturl` | Git 远程 URL | `https://github.com/user/repo-A` |
| `token` | 认证 Token | 64 位 hex 字符串 |

### 6.3 查看注册

```bash
# 列出所有注册
mcp-agentlink register list

# 按项目筛选
mcp-agentlink register list --project my-project
```

输出示例：

```
🟢 repo-A/coder            api-owner            online    last: 2026-06-25 10:30:00
🔴 repo-B/tester           tester               offline   last: 2026-06-24 15:00:00
```

### 6.4 注册冲突规则

每个 `(project_id, sender)` 组合是唯一的。如果同一个 sender 被不同的 Agent 注册，第二次注册会失败（返回 `SENDER_CONFLICT`）。

---

## 7. 事件系统

### 7.1 命令列表

| 命令 | 说明 |
|------|------|
| `mcp-agentlink event list` | 列出事件 |
| `mcp-agentlink event count` | 统计事件数 |
| `mcp-agentlink event stats` | 事件统计详情 |
| `mcp-agentlink event purge` | 删除事件 |

### 7.2 事件类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| `start` | 开始工作 | 开始一个新功能/任务时 |
| `finish` | 完成工作 | 完成一个功能/修复时 |
| `milestone` | 里程碑 | 达到重要阶段性成果时 |
| `error` | 错误 | 遇到阻塞性问题时 |
| `assignment` | 任务指派 | 需要其他角色配合时 |

### 7.3 查看事件

```bash
# 列出项目事件
mcp-agentlink event list --project my-project

# 筛选作用域
mcp-agentlink event list --project my-project --scope api-owner

# 筛选事件类型
mcp-agentlink event list --project my-project --type finish

# 限制返回数量
mcp-agentlink event list --project my-project --limit 10
```

输出示例：

```
[finish    ] 完成支付接口重构                              repo-A/coder @ 2026-06-25 10:30:00
[start     ] 开始数据库迁移                                repo-B/tester @ 2026-06-25 09:00:00
[milestone ] 测试覆盖率达到 90%                            repo-B/tester @ 2026-06-24 18:00:00
```

### 7.4 统计事件

```bash
# 统计所有项目
mcp-agentlink event count

# 统计单个项目
mcp-agentlink event count --project my-project

# 详细统计（按类型、作用域、月度分布）
mcp-agentlink event stats --project my-project
```

统计输出示例：

```
📊 Event Statistics for "my-project"
   Total events:  42

   By type:
     finish       18
     start        12
     milestone    8
     error        3
     assignment   1

   By scope:
     *            25
     api-owner    10
     tester       7

   Monthly (last 12):
     2026-06      42
```

### 7.5 清理事件

```bash
# 预览会删除多少事件
mcp-agentlink event purge --project my-project --before 2026-01-01 --dry-run

# 删除某类型某日期之前的事件
mcp-agentlink event purge --project my-project --before 2026-06-01 --type finish

# 清除项目所有事件
mcp-agentlink event purge --project my-project --all

# 强制删除（跳过确认）
mcp-agentlink event purge --project my-project --all --force
```

---

## 8. 文件链接

### 8.1 命令列表

| 命令 | 说明 |
|------|------|
| `mcp-agentlink link create` | 创建文件链接 |
| `mcp-agentlink link list` | 列出文件链接 |
| `mcp-agentlink link find` | 查找文件链接 |
| `mcp-agentlink link delete` | 删除文件链接 |

### 8.2 为什么需要文件链接

在多仓库项目中，一个接口的定义在 repo-A，实现和测试在 repo-B 和 repo-C。文件链接可以记录这些跨仓库的关联关系，让 Agent 了解文件间的映射。

### 8.3 创建链接

```bash
mcp-agentlink link create \
  --project my-project \
  --source-repo repo-A \
  --source-path src/api/user.ts \
  --target-repo repo-B \
  --target-path src/consumer/user.ts \
  --description "API 定义 → 前端消费"
```

### 8.4 查看链接

```bash
# 列出项目所有链接
mcp-agentlink link list --project my-project

# 按文件路径搜索（双向匹配）
mcp-agentlink link find --project my-project --repo repo-A --path src/api/user.ts
```

输出示例：

```
  abc12345  repo-A:src/api/user.ts
       ↔ repo-B:src/consumer/user.ts
       "API 定义 → 前端消费"
```

### 8.5 删除链接

```bash
mcp-agentlink link delete --id abc12345
```

---

## 9. Charter 管理

### 9.1 命令列表

| 命令 | 说明 |
|------|------|
| `mcp-agentlink charter set --project <id> --file <path>` | 发布 Charter（PM 专属） |
| `mcp-agentlink charter show --project <id>` | 查看 Charter |

### 9.2 发布 Charter

PM 通过 CLI 发布项目 Charter。Charter 是项目的宪法文件，定义协作规则。

```bash
mcp-agentlink charter set --project my-project --file ./charter.yaml
```

每次发布生成新的 GUID，Agent 通过 `/agentlink sync` 拉取最新版本。

### 9.3 查看 Charter

```bash
mcp-agentlink charter show --project my-project
```

输出示例：

```
Charter for "my-project":
  GUID:       a1b2c3d4-...
  Published:  2026-06-26 10:00:00
  By:         pm
  Updated:    2026-06-26 10:00:00
──────────────────────────────────────────────────
① 方向: 重构支付系统
② 都有谁:
  - api-owner/repo-A: api-owner
  - tester/repo-B: tester
③ 谁干什么:
  ...
```

---

## 10. MCP 工具

Agent 通过 MCP 协议连接到服务器后，可以调用以下工具。每个工具都需要在参数中传入 Token 进行认证。

### 10.1 register — 注册 Agent

注册 Agent 身份到中心服务器。**幂等操作**。

```json
{
  "project": "my-project",
  "sender": "repo-A/coder",
  "role": "api-owner",
  "workpath": "/home/user/repo-A",
  "giturl": "https://github.com/user/repo-A",
  "token": "64位hex字符串"
}
```

返回：

```json
{
  "registrationId": "uuid-xxx",
  "status": "online"
}
```

### 10.2 postEvent — 发布事件

完成任务或达成里程碑时发布事件。

```json
{
  "project": "my-project",
  "type": "finish",
  "sender": "repo-A/coder",
  "summary": "完成支付接口重构",
  "scope": "*",
  "docRef": {
    "path": "docs/payment-refactor.md",
    "script": "src/api/payment.ts"
  },
  "token": "64位hex字符串"
}
```

- `type` 枚举值：`start`, `finish`, `milestone`, `error`, `assignment`
- `scope`：`"*"` 表示所有角色可见，或指定角色名如 `"api-owner"`
- `docRef` 可选，提供文档和脚本路径

### 10.3 queryEvents — 查询事件

拉取事件列表，支持游标分页。

```json
{
  "project": "my-project",
  "scope": "api-owner",
  "type": "finish",
  "sinceId": "上一个事件的ID",
  "token": "64位hex字符串"
}
```

- `scope` 过滤
- `type` 过滤
- `sinceId`：只返回比此 ID 大的事件（用于增量拉取）

返回：

```json
{
  "events": [
    {
      "id": "uuid",
      "project_id": "my-project",
      "type": "finish",
      "sender": "repo-A/coder",
      "summary": "完成支付接口重构",
      "scope": "*",
      "doc_path": "docs/payment-refactor.md",
      "doc_script": "src/api/payment.ts",
      "timestamp": "2026-06-25 10:30:00"
    }
  ]
}
```

### 10.4 status — 服务器状态

获取服务器概览和当前 Agent 的连接信息。

```json
{
  "token": "64位hex字符串"
}
```

### 10.5 linkFile — 创建文件链接

跨仓库建立文件关联。

```json
{
  "project": "my-project",
  "sourceRepo": "repo-A",
  "sourcePath": "src/api/user.ts",
  "targetRepo": "repo-B",
  "targetPath": "src/consumer/user.ts",
  "description": "API 定义 → 前端消费",
  "token": "64位hex字符串"
}
```

### 10.6 queryLinks — 查询文件链接

按源/目标路径搜索关联。

```json
{
  "project": "my-project",
  "repo": "repo-A",
  "path": "src/api/user.ts",
  "token": "64位hex字符串"
}
```

### 10.7 unlinkFile — 删除文件链接

```json
{
  "linkId": "要删除的链接ID",
  "token": "64位hex字符串"
}
```

### 10.8 publishCharter — 发布 Charter

发布项目 Charter（PM 专属工具）。每次发布生成新的 GUID。

```json
{
  "project": "my-project",
  "content": "Charter 内容（YAML/文本格式）",
  "token": "64位hex字符串（PM Token）"
}
```

返回：

```json
{
  "guid": "a1b2c3d4-...",
  "timestamp": "2026-06-26 10:00:00"
}
```

### 10.9 syncCharter — 拉取 Charter

拉取指定项目的最新 Charter 和项目状态。

```json
{
  "project": "my-project",
  "token": "64位hex字符串"
}
```

返回：

```json
{
  "charter": {
    "content": "Charter 内容",
    "guid": "a1b2c3d4-...",
    "published_at": "2026-06-26 10:00:00"
  },
  "project": {
    "id": "my-project",
    "status": "active"
  }
}
```

---

## 11. REST API

除了 MCP 协议，服务器还提供 REST API 供 HTTP 客户端直接调用。

### 10.1 健康检查

```
GET /health
```

无需 Token。返回服务器运行状态和统计：

```json
{
  "status": "ok",
  "version": "0.4.0",
  "uptime": "2026-06-25T12:00:00.000Z",
  "sessionCount": 2,
  "projects": 3,
  "registrations": "5/8 online",
  "events": 42,
  "tokensActive": 6
}
```

### 10.2 获取 Agent 状态

```
GET /api/agent/status?token=xxx
```

返回当前 Token 对应的 Agent 信息、项目详情、事件统计：

```json
{
  "agent": {
    "projectId": "my-project",
    "role": "api-owner"
  },
  "project": {
    "id": "my-project",
    "name": "My Project",
    "status": "active"
  },
  "events": {
    "total": 42,
    "scoped": 10
  },
  "registrations": [
    {
      "sender": "repo-A/coder",
      "status": "online",
      "lastSeen": "2026-06-25 10:30:00"
    }
  ],
  "server": {
    "sessionCount": 2
  }
}
```

### 10.3 Agent 注册（REST）

```
POST /api/agent/register
Content-Type: application/json

{
  "project": "my-project",
  "sender": "repo-A/coder",
  "role": "api-owner",
  "workpath": "/home/user/repo-A",
  "giturl": "https://github.com/user/repo-A",
  "token": "64位hex字符串"
}
```

---

## 12. 客户端接入

### 11.1 安装

```bash
npm install mcp-agentlink-client
```

### 11.2 初始化流程

Agent 运行 `init` 后通过 Q&A 收集以下信息，写入 workspace 配置：

| 问题 | 说明 | 示例 |
|------|------|------|
| 项目 ID | 在服务器上已创建的项目 | `my-project` |
| 角色 | kebab-case 格式 | `api-owner` |
| Sender | 仓库/Agent 标识 | `repo-A/coder` |
| 工作路径 | 仓库绝对路径 | `/home/user/repo-A` |
| Git URL | Git 远程地址 | `https://github.com/user/repo-A` |
| Token | 从服务器获取的认证 Token | 64 位 hex |

### 11.3 写入的配置

配置写入到工作区文件（如 `CLAUDE.md`）：

```markdown
## mcp-agentlink Config
enabled: true
project: my-project
role: api-owner
sender: repo-A/coder
workpath: /home/user/repo-A
giturl: https://github.com/user/repo-A
server_url: https://mcp-agentlink.example.com
<!-- mcp-agentlink-end -->
```

Token 单独存储在 `.mcp-agentlink.token` 文件中（已在 `.gitignore` 中）。

### 11.4 读取配置和 Token

客户端库提供 API 用于读取：

```typescript
import { readConfig, readToken } from "mcp-agentlink-client";

const config = readConfig("CLAUDE.md");
const token = readToken();
```

---

## 13. Agent 行为规则

以下规则定义了 AI Agent 如何自动与 mcp-agentlink 交互，来源于 `skill/skill.md`。

### 12.1 启动时

如果 workspace 配置中 `enabled: true`：

1. 读取配置块（`## mcp-agentlink Config`）
2. 调用 `register` MCP 工具 → 服务器确认 Agent 身份
3. 调用 `queryEvents`，`scope` 设为自身角色 → 拉取待处理事件

如果 `enabled: false` 或找不到配置 → 跳过，不执行任何操作。

### 12.2 完成任务后

完成一个有意义的任务后（如实现功能、修复 bug、完成重构）：

1. **写本地文档** — 记录以下内容到本地文件
   - 完成内容的一行摘要
   - 相关的脚本/文件路径
   - 相关的文档路径
2. **调用 `postEvent`** — 发送事件到中心服务器
   - `type`: `finish`（或 `milestone`，如果是重大阶段性成果）
   - `summary`: 一行摘要
   - `scope`: 如果影响所有人则用 `"*"`，否则指定角色名
   - `docRef.path`: 本地文档路径（相对仓库根目录）
   - `docRef.script`: 相关脚本路径
3. **如果 scope 指向特定角色** → 提醒用户：
   > "我已完成了 [摘要]。这影响了 [角色]，请通知他们。"

### 12.3 工作期间

定期（开始新任务前，或用户提示时）：

1. 调用 `queryEvents`，`scope` 设为自身角色，检查新事件
2. 对于每个新事件：
   - 阅读 `summary` → 如果相关，查看 `docRef.path` 获取完整上下文
   - 决定是否采取行动或确认收到

---

## 14. Slash 命令

Agent 可通过 `/agentlink` 斜杠命令管理连接。

### 14.1 `/agentlink status`

显示当前连接状态：

```
mcp-agentlink Connection
─────────────────────────
Status:     🟢 Connected
Server:     https://mcp-agentlink.example.com
Project:    my-project  (active)
Role:       api-owner
Sender:     repo-A/coder
Events:     12 total · 3 scoped to your role
Sessions:   2 active connections
Registration: online (last seen: 2026-06-25 10:30 UTC)
```

操作流程：
1. 读取 `CLAUDE.md` 获取本地配置（`project`, `role`, `sender`, `server_url`）
2. 读取 `.mcp-agentlink.token` 获取 Token
3. 检查服务器可达性：`GET {server_url}/health`
4. 获取 Agent 状态：`GET {server_url}/api/agent/status?token={token}`
5. 格式化并展示组合结果

### 14.2 `/agentlink on` / `/agentlink enable`

启用 mcp-agentlink 连接并注册到服务器：

1. 读取配置和 Token
2. 更新 CLAUDE.md：`enabled: false` → `enabled: true`
3. 注册：`POST {server_url}/api/agent/register`
4. 拉取待处理事件
5. 报告结果

### 14.3 `/agentlink off` / `/agentlink disable`

禁用连接，仅修改配置，不注销：

1. 读取当前配置
2. 设置 `enabled: false`

### 14.4 `/agentlink reconnect`

完整重新连接：

1. 读取配置和 Token
2. 验证服务器可达
3. 重新注册
4. 拉取 Agent 状态
5. 报告新事件数

---

## 15. 错误处理与重试

### 15.1 MCP 工具调用重试

所有 MCP 工具调用都会自动重试。使用指数退避 + 随机抖动：

| 参数 | 默认值 |
|------|--------|
| 最大尝试次数 | 3 |
| 基础延迟 | 1000ms |
| 最大延迟 | 10000ms |

### 15.2 SQLite 忙重试

对于 `SQLITE_BUSY` 错误（多进程并发写入），自动重试：

| 参数 | 默认值 |
|------|--------|
| 最大尝试次数 | 3 |
| 基础延迟 | 100ms |

### 14.3 错误码参考

| 错误码 | 说明 | 可能的原因 |
|--------|------|-----------|
| `INVALID_TOKEN` | Token 无效或已被撤销 | Token 错误、已过期、项目已归档 |
| `UNAUTHORIZED_SCOPE` | Token 未授权此项目 | Token 属于另一个项目 |
| `PERMISSION_DENIED` | Token 权限不足 | 用 read Token 尝试写操作 |
| `VALIDATION_ERROR` | 参数验证失败 | 缺少必填字段、事件类型不对 |
| `SENDER_CONFLICT` | Sender 已被注册 | 同一个 sender 被不同的 Agent 注册 |
| `PM_EXISTS` | 项目已有 PM | 再次以 `pm` 角色注册时返回 |
| `NO_PM` | 项目无 PM | 非 PM 角色尝试注册，但项目尚无 PM |
| `PROJECT_CLOSED` | 项目已关闭 | 已关闭的项目不允许发事件、注册 |
| `UNKNOWN_TOOL` | MCP 工具不存在 | 调用了未定义的工具名 |
| `INTERNAL_ERROR` | 服务端内部错误 | 服务器异常，重试或联系管理员 |

---

## 16. 最佳实践

### 15.1 角色命名

使用 kebab-case 命名角色，保持清晰和一致：

```
✅ api-owner
✅ frontend-consumer
✅ schema-owner
✅ tester
❌ API_Owner
❌ 后端负责人
```

### 15.2 事件摘要

**摘要要简短且信息量大**。Agent 通过摘要决定是否需要阅读完整文档：

```
✅ "完成支付接口重构 — 改进了错误处理，添加了重试逻辑"
✅ "数据库迁移脚本 v2 — 需要 schema-owner 审核"
❌ "完成了一个任务"
❌ "fix: some stuff"
```

### 15.3 作用域策略

- **`*`** — 所有 Agent 都应该知道的事件（如 API 发布、架构变更）
- **`角色名`** — 只影响特定角色的事件（如前端样式调整）

### 15.4 文件链接的使用场景

- API 定义仓库 → 消费端仓库的映射
- 类型定义共享仓库 → 使用方仓库的映射
- 文档仓库 → 实现仓库的映射

### 15.5 事件清理策略

- 定期清理过期事件（如删除 90 天前的 finish/start 事件）
- 保留 milestone 和 error 事件作为历史记录
- 归档项目时使用 `--hard` 彻底清理

### 15.6 多项目隔离

- 每个项目完全隔离，Token 不能跨项目使用
- 不同团队应有独立的项目
- 同一团队的不同微服务可以属于同一项目

---

## 17. 常见问题

### 16.1 服务器无法启动

**问题**：端口被占用  
**解决**：更换端口启动，或先停掉占用端口的进程

```bash
mcp-agentlink server start --port 8080
```

### 16.2 Agent 注册失败（INVALID_TOKEN）

**可能的原因**：
1. Token 输入错误
2. Token 已被撤销
3. 项目已被归档

**解决**：
```bash
# 重新生成 Token
mcp-agentlink token generate --project my-project --role api-owner
```

### 16.3 Agent 注册失败（SENDER_CONFLICT）

**原因**：同一个 sender 已在其他 Agent 会话中注册。  
**解决**：使用不同的 sender 标识，或等原 Agent 离线后重试。

### 16.4 数据库在哪里

默认路径：`~/.mcp-agentlink/data.db`

可通过环境变量自定义：

```bash
export MCP_AGENTLINK_DB_PATH=/data/mcp-agentlink.db
mcp-agentlink server start
```

### 16.5 如何备份

数据库是一个 SQLite 文件，直接复制即可：

```bash
cp ~/.mcp-agentlink/data.db ~/.mcp-agentlink/backup-$(date +%Y%m%d).db
```

### 16.6 如何从零重置

```bash
# 1. 停止服务器
mcp-agentlink server stop

# 2. 删除数据库文件
rm ~/.mcp-agentlink/data.db

# 3. 重新启动（会自动创建新数据库并执行迁移）
mcp-agentlink server start
```

### 16.7 Agent 离线后还能收到事件吗

可以。事件存储在服务器上，Agent 重新上线后通过 `queryEvents`（使用 `sinceId` 游标）拉取离线期间错过的事件。

### 16.8 是否支持 HTTPS/WSS

生产部署时建议在反向代理（如 Nginx、Cloudflare）层配置 TLS。服务器本身监听 HTTP。

---

> 更多技术细节请阅读：
> - [设计文档](design.md)
> - [架构概览](architecture-overview.md)（中文）
> - [项目结构](project-structure.md)
> - [CI/CD 规范](pipeline-and-rules.md)
