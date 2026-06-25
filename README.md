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
|[mcp-agentlink-server](./packages/server/)|v0.3.0|Center server: CLI, SQLite storage, MCP over SSE, auth, REST API|
|[mcp-agentlink-client](./packages/client/)|v0.3.0|Client library: agent init, skill rules, MCP proxy, slash command|

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
- `queryEvents` — Pull events by scope/type

See [packages/client/skill/skill.md](./packages/client/skill/skill.md) for agent behavior rules.

## Documentation

|Document|Description|
|---|---|----------|
|[docs/design.md](./docs/design.md)|Full design specification|
|[docs/architecture-overview.md](./docs/architecture-overview.md)|Architecture overview (Chinese)|
|[docs/project-structure.md](./docs/project-structure.md)|Package structure & deployment|
|[docs/pipeline-and-rules.md](./docs/pipeline-and-rules.md)|CI/CD, issue/PR rules|

## Status

**Phase 1 (MVP):** ✅ done | **Phase 2 (v0.3.0):** ✅ done

Phase 2 additions:
- ✅ `/agentlink` slash command & `status` tool
- ✅ File linking (cross-repo file mapping + MCP tools)
- ✅ Project archive cascade (tokens + registrations + hard cleanup)
- ✅ Error handling (`withRetry()` backoff utility)
- ✅ Event purge CLI (`--project --before --type`)
- ✅ REST API for agent self-service (`GET /api/agent/status`, `POST /api/agent/register`)
- ✅ GitHub issue & PR templates

## License

Apache 2.0
