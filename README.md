# mcp-agentlink

**MCP server for cross-project, cross-agent communication.** A centralized storage + registration hub that enables multiple AI coding agents with independent contexts to share events, file references, and work status across repositories.

## Architecture

```text
                    ┌──────────────┐
                    │  Cloudflare   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │ Linux Server │
                    │  (bare metal)│
                    │              │
                    │ mcp-agentlink│
                    │   -server    │
                    └──────┬───────┘
                           │ MCP over SSE
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    Agent A           Agent B            Agent C
   npm install       npm install        npm install
   mcp-agentlink     mcp-agentlink      mcp-agentlink
   -client           -client            -client
```

## Packages

|Package|Version|Description|
|---|---|-------------|
|[mcp-agentlink-server](./packages/server/)|v0.5.0|Center server: CLI, SQLite storage, MCP over SSE, auth, REST API, Charter system|
|[mcp-agentlink-client](./packages/client/)|v0.5.0|Client library: agent init, skill rules, MCP proxy, slash command, local cache|

## Quick Start

### 1. Start the server

```bash
# After installing the package
mcp-agentlink server start --port 3000
```

### 2. Create a project and generate a token

```bash
mcp-agentlink project create my-project
mcp-agentlink token generate --project my-project --role api-owner
```

### 3. Connect an agent

Agents install the client package, run `init` via Q&A to configure, then use the MCP tools:

- `register` — Register agent identity with the center
- `postEvent` — Post completion or status events
- `queryEvents` — Pull events by scope/type, cursor-based
- `status` — Get server + agent connection status
- `linkFile` / `queryLinks` / `unlinkFile` — Cross-repo file linking
- `publishCharter` — Publish project charter (PM only)
- `syncCharter` — Fetch latest charter and project status

See [packages/client/skill/skill.md](./packages/client/skill/skill.md) for agent behavior rules.

## Documentation

|Document|Description|
|---|---|----------|
|[docs/design.md](./docs/design.md)|Full design specification|
|[docs/architecture-overview.md](./docs/architecture-overview.md)|Architecture overview (Chinese)|
|[docs/project-structure.md](./docs/project-structure.md)|Package structure & deployment|
|[docs/pipeline-and-rules.md](./docs/pipeline-and-rules.md)|CI/CD, issue/PR rules|

## Status

**v0.5.0** — All 4 phases complete.

| Phase | Version | Status |
|-------|---------|--------|
| Phase 1 — MVP | v0.1.0 | ✅ |
| Phase 2 — Integration | v0.2.0→v0.3.0 | ✅ |
| Phase 3 — Refinement | v0.4.0 | ✅ |
| Phase 4 — Collaborative Governance | **v0.5.0** | ✅ |

**Phase 4 highlights:**
- ✅ PM role mechanism (`register --role pm`, `project close`)
- ✅ Charter system (5-layer framework, `publishCharter`/`syncCharter`)
- ✅ Two-layer local storage (`~/.mcp-agentlink/` + `.mcp-agentlink/`)
- ✅ Client sync (`/agentlink sync`, `POST /api/agent/sync`)
- ✅ CLI formatting utilities (table, JSON, pagination)
- ✅ Skill formalization (auto-generated `.claude/skills/agentlink.md`)
- ✅ Sender auto-generation (`{repo}/{agent}` format)

## License

Apache 2.0
