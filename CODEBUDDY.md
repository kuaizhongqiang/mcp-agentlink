# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Project Overview

mcp-agentlink is an MCP (Model Context Protocol) server for cross-project, cross-agent communication. It acts as a centralized storage + registration hub enabling multiple AI coding agents with independent contexts to share events, file references, and work status across repositories.

**Current Status:** Phase 1 (MVP) complete.

**License:** Apache 2.0

## Commands

This project is a monorepo (npm workspaces) with two packages. Once initialized:

```bash
# Root level
npm run build        # Build all packages
npm run test         # Test all packages
npm run lint         # Lint all packages

# Server package (packages/server)
cd packages/server
npm run dev          # Watch mode with tsx
npm run build        # TypeScript compile
npm run test         # Run tests
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit

# Client package (packages/client)
cd packages/client
npm run build        # TypeScript compile
npm run test         # Run tests
npm run lint         # ESLint
```

Runtime dependencies: `@modelcontextprotocol/sdk`, `sql.js`, `commander` (CLI), `express` (SSE server). Dev dependencies: `typescript` (strict), `eslint`, `vitest`, `tsx`.

## Architecture

### Two-Package Monorepo

```
mcp-agentlink/
├── packages/
│   ├── server/          # mcp-agentlink-server
│   │   ├── src/
│   │   │   ├── cli/     # CLI commands (commander)
│   │   │   └── storage/ # SQLite via sql.js
│   │   └── ...
│   └── client/          # mcp-agentlink-client
│       ├── src/
│       ├── skill/       # skill.md + agent behavior rules
│       └── README.md    # Agent-readable package docs
├── docs/                # Design documents
├── CLAUDE.md            # Claude Code guidance
└── CODEBUDDY.md
```

**mcp-agentlink-server**: TypeScript/Node.js npm package. Provides an MCP server over SSE transport (stdio for local dev), SQLite storage, role-based token auth, and a CLI for management. Deployed on a Linux server behind Cloudflare, managed via OpenClaw CLI.

**mcp-agentlink-client**: TypeScript/Node.js npm package. Agents install it via `npm install mcp-agentlink-client`. Delivers skill rules + README for agent self-deployment. Client provides `init` (local Q&A setup) and proxies `register`, `postEvent`, `queryEvents` to the server via MCP protocol. Agents interact with all 4 through a unified interface.

Two packages have independent versioning and separate CHANGELOGs.

### Domain Model

Four core entities:

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **Project** | Isolated work domain, data cannot cross boundaries | id, name, description, status (active/archived), timestamps |
| **Sender** | Who initiated an operation | repo identifier + agent instance identifier |
| **Role** | Functional identifier for auth and routing | kebab-case: `api-owner`, `frontend-consumer`, `schema-owner`, `tester` |
| **Event** | Core data unit — all communication is event-based | id, project, type, sender, summary, scope, docRef?, timestamp |

Event types: `start`, `finish`, `milestone`, `error`, `assignment`. Events carry a `scope` field (role name or `"*"`) that determines which agents should see them. Detailed content lives in local documents referenced via `docRef`; the event itself carries only a short `summary` to conserve tokens.

### Key Design Principles

- **Center stores facts, does not judge logic** — dependency decisions are left to agents
- **Each agent has independent context** — no context mixing across agents
- **Agents communicate via events, not shared context**
- **Semi-automated** — agents post events and prompt users to relay notifications to downstream agents when needed
- **Toggle on/off** — each agent can disable the connection via `enabled: true/false` in workspace config to avoid unnecessary context overhead

### SQLite Schema (4 tables)

- `projects` — id, name, description, status, created_at, updated_at
- `registrations` — id, project_id, sender, role, token_hash, workpath, giturl, last_seen, status (online/offline)
- `events` — id, project_id, type, sender, summary, scope, doc_path, doc_script, timestamp
- `tokens` — id, project_id, role, token_hash, status (active/revoked), created_at

Token hashes are stored (never raw tokens). Project archiving auto-revokes associated tokens.

### Communication Flow

```text
Agent A ←→ mcp-agentlink ←→ Agent B
  1. register  — register identity (sender + role + project + workpath + giturl)
  2. postEvent — send events on task completion
  3. queryEvents — pull events by project/role/scope/time range
  4. (semi-automated) — agent tells user to notify downstream agents
```

`init` is a client-local setup step (Q&A → write config), not part of the server communication flow.

### Agent Init Flow (6 steps)

1. User tells agent "connect to mcp-agentlink"
2. Agent checks workspace for existing config (enabled flag)
3. If no config → Q&A: project, role, sender, workpath, giturl, server_url, token
4. Agent writes non-sensitive config to workspace file (CLAUDE.md / AGENTS.md / CODEBUDDY.md); token goes to `.mcp-agentlink.token` (in `.gitignore`)
5. Agent calls `register` tool → center confirms
6. Agent ready to work

### Config Format

Written to workspace file during init (token stored separately in `.mcp-agentlink.token`):

````markdown
## mcp-agentlink Config
enabled: true
project: payment-rebuild
role: api-owner
sender: repo-A/coder
workpath: /home/user/repo-A
giturl: https://github.com/user/repo-A
server_url: https://mcp-agentlink.example.com
````

### Agent Skill Rules

Three automatic behaviors defined in `skill.md`:
1. **On startup**: if `enabled=true`, auto-register + queryEvents for own scope
2. **On long task completion**: write local doc, postEvent, alert user for cross-role notifications
3. **During work**: periodically queryEvents, decide whether to read summary or docRef based on relevance

### Auth Model

- **Project isolation**: data cannot cross project boundaries
- **Role-level tokens**: one token per (project, role) pair, shared by all agents with same role
- **CLI generation**: `mcp-agentlink token generate --project <id> --role <role>`
- Archive a project → its tokens auto-revoke

### CLI Commands (Server)

```
mcp-agentlink help                           # Help info
mcp-agentlink server start                   # Start server
mcp-agentlink server stop                    # Stop server
mcp-agentlink server status                  # Server status
mcp-agentlink server logs                    # Server logs
mcp-agentlink project create <name>          # Create project
mcp-agentlink project archive <id>           # Archive project
mcp-agentlink project list                   # List projects
mcp-agentlink project show <id>              # Project details
mcp-agentlink token generate --project <id> --role <role>
mcp-agentlink token revoke <token>
mcp-agentlink token list --project <id>
mcp-agentlink register list                  # Registered agents
mcp-agentlink event list --project <id>      # Event list
```

### Implementation Roadmap

**Phase 1 — MVP ✅ (completed 2026-06-24):**

1. ✅ Monorepo scaffold — npm workspaces, TypeScript strict
2. ✅ Server: CLI framework — 14 commands via commander
3. ✅ Server: SQLite storage (sql.js) — 4 tables, migrations, CRUD stores
4. ✅ Server: MCP over SSE — Express + SSE transport, 3 tools registered
5. ✅ Server: Auth middleware — SHA-256 token verification on every tool call
6. ✅ Server: MCP tools — register (idempotent), postEvent, queryEvents
7. ✅ Client: npm package — init (local setup) + skill/skill.md + README
8. ✅ DevOps — CI/CD pipeline, CHANGELOG both packages

**Phase 2:** `/agentlink` slash command, file linking, full project archive, error handling & retry

**Phase 3:** Event history/statistics, finer-grained auth, performance & monitoring

### CI/CD Pipeline

```
push → lint/typecheck → test → build → [tag vX.Y.Z → npm publish]
                                        ↑ main branch or tag push only
```

Each package publishes with: README.md (agent-readable), CHANGELOG.md, skill/ directory (client only), compiled code.

### Key Conventions

- **Language**: TypeScript (strict mode)
- **SDK**: `@modelcontextprotocol/sdk`
- **Transport**: MCP over SSE (production), stdio (local dev)
- **Database**: SQLite via `sql.js` (pure JS/WASM)
- **CLI**: run as `mcp-agentlink <command>` (globally installed, no npx)
- **Role naming**: kebab-case (e.g., `api-owner`, `frontend-consumer`)
- **Event types**: lowercase (`start`, `finish`, `milestone`, `error`, `assignment`)
- **Config**: YAML-ish key:value pairs in workspace file (CLAUDE.md / AGENTS.md / CODEBUDDY.md)
- **Branch naming**: `feat/*`, `fix/*`, `docs/*` (conventional commits)
- **Git commits**: End with `Co-Authored-By: CodeBuddy <noreply@agent.local>`
- **Versioning**: semver with independent per-package tags (`vX.Y.Z`)

### Design Document Index

| Document | Content |
|----------|---------|
| `docs/architecture-overview.md` | Core positioning, domain model concepts, communication flow, tech stack |
| `docs/design.md` | **Full spec**: event model, MCP tools, auth, SQLite DDL, init flow, skill rules, CLI, deployment, roadmap |
| `docs/pipeline-and-rules.md` | CI/CD stages, semantic versioning, Issue/PR templates, release rules |
| `docs/project-structure.md` | Two-package structure diagram, deployment architecture, independent versioning |
