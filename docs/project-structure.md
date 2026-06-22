# mcp-agentlink 项目结构

> 两个包、一个中心 —— Server 负责存储与鉴权，Client 让 Agent 自我展开。

---

## 架构总览

```
                   公网 (Cloudflare)
                          │
                    ┌─────┴─────┐
                    │  Linux 服务器 │  ← 裸跑
                    │             │
                    │  OpenClaw   │  ← 通过 CLI 管理
                    │             │
                    │ mcp-agentlink│  ← 中心服务器
                    │  -server    │
                    └─────────────┘
                          │ MCP 协议 (SSE)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    Agent A           Agent B           Agent C
   npm install       npm install       npm install
   mcp-agentlink     mcp-agentlink     mcp-agentlink
   -client           -client           -client
```

---

## 两个包

### mcp-agentlink-server

| 项目 | 说明 |
|------|------|
| 语言 | TypeScript / Node.js |
| 发布方式 | npm 包 |
| 部署 | Linux 服务器裸跑 |
| 管理方式 | OpenClaw CLI 调用 |
| 核心职责 | 存储 + 注册 + 鉴权 |

提供 CLI 命令，OpenClaw 通过它来启动、停止、管理服务器。

### mcp-agentlink-client

| 项目 | 说明 |
|------|------|
| 语言 | TypeScript / Node.js |
| 发布方式 | npm 包 |
| 安装方式 | Agent 自主 `npm install mcp-agentlink-client` |
| 安装产物 | `node_modules/mcp-agentlink-client/` 内包含 skill + README |
| 核心职责 | Agent 读取 skill + README 后自我展开 |

**Agent 安装流程：**

```
1. Agent 执行 npm install mcp-agentlink-client
2. 读取 README.md → 理解项目概念（Project / Sender / Role）
3. 读取 skill/ 下的 skill.md → 获得 slash command 能力
4. 连接中心服务器 → 注册（project + sender + role）
5. 开始工作
```

---

## 包发布策略

两个包各自独立版本号，各自走 CI/CD 流水线：

```
push → test → build → tag vX.Y.Z → npm publish
```

- 版本号各自独立（server v0.1.0 + client v0.2.0 可以不同步）
- CHANGELOG 各自维护
- 每个包自带 README + skill（client 的 skill 是核心交付物）

---

## 部署架构

```
硬件: Linux 服务器（家中）
网络: 实名域名 → Cloudflare → 服务器
运行: 裸跑（无容器化）

服务器上运行:
├── OpenClaw           ← AI agent 框架
└── mcp-agentlink      ← 本项目的中心服务器
    -server
```

---

## 当前状态

- [x] 整体架构对齐
- [ ] 数据协议定义（中心存什么、格式是什么）
- [ ] MCP Tool 清单（暴露哪些能力）
- [ ] 鉴权模型（谁可以读写什么）
- [ ] Skill.md 编写
- [ ] Server 代码实现
- [ ] Client 代码实现
- [ ] CI/CD 搭建
- [ ] 首版发布
