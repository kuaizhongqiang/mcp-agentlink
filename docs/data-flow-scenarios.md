# 数据流场景设计

> ✅ **v0.5.0 已实现** — 本文档描述的数据流已在 Phase 4 中全部实现：PM 角色机制、Charter 系统、`/agentlink sync` 命令、`project close` 命令。参见 [design.md](design.md) 了解完整设计。
>
> 多项目接入 mcp-agentlink 后的完整数据流设计。
>
> 场景：项目 A（纯后台）、项目 B（前端 CLI）、项目 C（前端 Web），三个已有项目接入 mcp-agentlink。

## 阶段划分

```
Phase 1 — 初始化接入
    ↓
Phase 2 — PM 介入，开始工作
    ↓
Phase 3 — PM 完成，Agent 干活
    ↓
Phase 4 — PM 调整目标，继续干活
    ↓
Phase 5 — PM 结项
```

---

### Phase 1 — 初始化

三个项目各自接入 mcp-agentlink。此时服务器上项目尚未完整建立，PM 未出现。

**流程**：

1. 任一项目通过 CLI 命令在服务端创建一个 agentlink 项目
2. 服务端创建的项目初始只有 `id`，无其他内容
3. 创建完成后，服务端有了这个项目 ID
4. 任一 Agent 可凭此项目 ID 注册自己为 PM

**数据流**：

```text
任一 Agent → 服务端：create project（生成项目 ID）
服务端     → 所有人：（项目 ID 已存在，暂无其他）
某一 Agent → 服务端：register --role pm（凭项目 ID 自注册为 PM）
```

---

### Phase 2 — PM 介入，开始工作

PM 角色出现。他在服务端配置全局信息，制定协作规则。

**流程**：

1. **全局配置**
   - 配置参与的项目：名称、GitHub 地址
   - 配置参与的 Agent：sender + token（PM 可生成 token 分发给各 Agent）
2. **制定宪法文档**
   - 创建 Charter（五层框架：方向 → 角色 → 职责 → 规则 → 顺序）
   - 角色分配写在 Charter 里，不在配置中
   - 发布 Charter 到服务端
3. **启动信号**
   - PM 发一个 `start` 事件，告知所有 Agent 配置完成，可以开始工作

**数据流**：

```text
PM → 服务端：配置项目清单 + Agent 清单 + token
PM → 服务端：publish Charter
PM → 服务端：postEvent(type=start, scope=*)  // 通知所有人可以开工了
服务端存储以上所有数据，等待各 Agent 拉取
```

---

### Phase 3 — PM 完成，Agent 干活

PM 退居二线，三个 Agent 各自在本地初始化，进入日常协作。

**流程**：

1. **本地初始化**：Agent 执行 `/agentlink init`
   - 填写项目 id、sender、token
   - 生成项目级目录 `./mcp-agentlink/`（存身份 + token）
2. **拉取远端**：Agent 执行 `/agentlink sync`
   - 从服务端拉取初始化信息
   - MCP 告诉 Agent init 完成，获取了哪些文件及路径
   - Agent 读不读是它自己的事，关键是让它知道**文件在哪**
3. 之后可以执行其他 `/agentlink` 命令

> Todo 和任务管理由 PM 通过 GitHub Issues 在各仓库中统一管理，mcp-agentlink 不重复实现。

**数据流**：

```text
某 Agent → 本地：/agentlink init（填 project id + sender + token → 写 .mcp-agentlink/）
某 Agent → 服务端：/agentlink sync（拉取 Charter 到本地缓存）
服务端   → 该 Agent：返回 charter.yaml
该 Agent 本地缓存：写入 cache/{project-id}/charter.yaml
```

---

### Phase 4 — PM 调整目标，继续干活

PM 需要修改项目方向、增加项目或 Agent。

**流程**：

1. PM 修改 Charter（增减项目、调整角色、更新愿景）
2. PM 重新发布 Charter 到服务端
3. PM 发一个 `milestone` 事件通知所有 Agent："有更新"
4. 各 Agent 收到通知后执行 `/agentlink sync`，**直接覆盖本地缓存**

> 不区分增量更新，sync 即全量覆盖，保证本地与服务端一致。

**数据流**：

```text
PM → 服务端：更新 Charter
PM → 服务端：postEvent(type=milestone, summary="Charter updated")
    → 各 Agent queryEvents 时发现新事件
    → 各 Agent 执行 /agentlink sync（全量覆盖本地缓存）
```

---

### Phase 5 — PM 结项

项目结束。PM 关闭项目，数据进入归档状态。

**流程**：

1. PM 执行 `/agentlink project close`
2. 服务端将项目状态标记为 `status: "closed"`
3. 项目关闭后，不再允许 post 新事件

> PM 结项后，各 Agent 本地缓存仍然保留，但 sync 时会收到项目 `status: "closed"`，Agent 自行决定是否清理本地目录。
