# mcp-agentlink 架构概览

> 跨项目、跨 AI agent 的通信中枢 —— 中心化存储与注册的 MCP 服务器。

---

## 核心定位

mcp-agentlink 是一个 **中心化 MCP 服务器**，承载两个核心职责：

1. **存储** — 持久化跨仓库的文件链接、变更记录、Agent 上下文
2. **注册** — 记录谁在线、在做什么、关注什么文件

部署在私有的公网服务器上（有域名），所有 AI Agent 通过 MCP 协议连接到这个中心。

---

## 领域模型

### Project（项目）
一个独立的工作域，隔离不同项目的数据。每个 project 拥有独立的命名空间。

- 一个 project = 一组相关的仓库 + Agent
- 数据在 project 级别隔离

### Sender（发送者）
每次操作或消息的发起者身份标识，包含：

- 来自哪个仓库
- 哪个 Agent 实例
- 时间戳

所有写入中心的记录都带有 sender 信息，用于追溯"谁干的"。

### Role（角色）
职能标识，用于按角色路由信息。例如：

- `api-owner` — API 提供方
- `frontend-consumer` — 前端消费方  
- `schema-owner` — 数据库/Schema 维护方

Agent 注册时声明自己的 role，中心可以根据 role 做定向推送或查询过滤。

---

## 展现形式：Skill + MCP

mcp-agentlink 通过两层方式交付：

| 层 | 职责 | 使用者 |
|----|------|--------|
| **MCP Server** | 核心后端：存储、注册、查询、推送 | 所有连接的 AI Agent |
| **Claude Skill** | 面向用户的交互界面：Slash Command | 使用 Claude 的开发者 |

用户通过 `/agentlink` 之类的 Slash Command 调用 Skill，Skill 背后调用 MCP Server 的能力。

---

## 通信流程（草案）

```
Agent A                         mcp-agentlink                       Agent B
   |                                  |                                  |
   |---- register(sender, role) ----->|                                  |
   |---- link-file(paths) ----------->|                                  |
   |                                  |---- notify(change, sender) ---->|
   |                                  |<--- ack -------------------------|
   |<--- relevant changes ------------|                                  |
   |                                  |                                  |
```

1. Agent 启动时向中心注册（project + sender + role）
2. Agent 工作时可以创建文件链接（"我关注这个文件"）
3. Agent 发生变更时通知中心
4. 中心按 role / 链接关系，将变更推送给相关 Agent
5. Agent 查询上下文时，中心返回聚合结果

---

## 技术方向（初步）

| 层面 | 选型 |
|------|------|
| 协议 | MCP (Model Context Protocol) |
| 语言 | TypeScript / Node.js |
| 传输 | stdio（本地开发）/ SSE（公网部署） |
| 存储 | 待定（SQLite / PostgreSQL / 其他） |
| SDK | `@modelcontextprotocol/sdk` |
