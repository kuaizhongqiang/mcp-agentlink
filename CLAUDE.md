# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mcp-agentlink — an MCP (Model Context Protocol) server for cross-project, cross-agent communication. A centralized storage + registration hub that enables multiple AI coding agents with independent contexts to share events, file references, and work status across repositories.

**Key design principles:**

- Center stores facts only, does not judge logic — dependency decisions left to agents
- Each agent has independent context (no context mixing)
- Agents communicate via events, not shared context
- Semi-automated: agent notifies user to relay to other agents when needed
- Can be toggled on/off per agent via workspace config (`enabled: true/false`)

## Current Status

**v0.5.0** — Phases 1-4 all complete. See [Implementation Roadmap](#implementation-roadmap) for details.

## Design Documents

All design documents are in [docs/](docs/). Key specifics are synthesized below — read the source docs for full context.

| Document | Key Content |
|----------|-------------|
| [docs/architecture-overview.md](docs/architecture-overview.md) | Core positioning, domain model concepts, communication flow diagram, tech stack |
| [docs/design.md](docs/design.md) | **Full spec**: event model, MCP tools, auth model, SQLite DDL, agent init flow, skill rules, CLI commands, deployment, roadmap |
| [docs/pipeline-and-rules.md](docs/pipeline-and-rules.md) | CI/CD pipeline stages, semantic versioning, Issue/PR templates, release rules |
| [docs/project-structure.md](docs/project-structure.md) | Two-package structure, deployment architecture diagram, independent versioning |

## Architecture (Synthesized from Design Docs)

### Two-Package Structure

```text
mcp-agentlink/
├── packages/
│   ├── server/          # mcp-agentlink-server — npm package
│   │   ├── src/         # TypeScript (strict)
│   │   ├── src/cli/     # CLI commands (commander or similar)
│   │   └── src/storage/ # SQLite via sql.js
│   └── client/          # mcp-agentlink-client — npm package
│       ├── src/         # TypeScript
│       ├── skill/       # skill.md + agent behavior rules
│       └── README.md    # Agent-readable concept docs
├── docs/                # Design documents
└── CLAUDE.md
```

### mcp-agentlink-server

- TypeScript / Node.js, published as npm package
- MCP over SSE transport (stdio for local dev)
- SQLite storage (sql.js)
- Role-based token auth (one token per role per project)
- CLI for management: `mcp-agentlink {project|token|server|register|event} ...`
- Deployed on Linux server, managed via OpenClaw CLI, behind Cloudflare

### mcp-agentlink-client

- TypeScript / Node.js, published as npm package
- Agent installs via `npm install mcp-agentlink-client`
- Installs README.md + skill/ directory for agent self-deployment
- Provides `init` (local Q&A setup) and proxies `register`/`postEvent`/`queryEvents` to server via MCP

### Domain Model

| Entity | Description | Key Fields |
|--------|-------------|------------|
| **Project** | Isolated work domain | id, name, description, status (active/archived), timestamps |
| **Sender** | Who initiated the operation | repo identifier + agent instance identifier |
| **Role** | Functional identifier, used for auth | e.g. `api-owner`, `frontend-consumer`, `schema-owner`, `tester` |
| **Event** | Core data unit | id, project, type, sender, summary, scope, docRef?, timestamp |

### Event Type (from [docs/design.md](docs/design.md#L46-L60))

```typescript
interface Event {
  id: string;
  project: string;
  type: "start" | "finish" | "milestone" | "error" | "assignment";
  sender: string;           // Who sent it
  summary: string;          // One-line summary (token-efficient)
  scope: string;            // Role name or "*" for all
  docRef?: {
    path?: string;          // Document path (relative to repo root; at least one of path/script required)
    script?: string;        // Related script/file path
  };
  timestamp: string;
}
```

### Communication Flow

```text
Agent A ←→ mcp-agentlink ←→ Agent B
  1. Register (sender + role + project)
  2. Post events on task completion
  3. Query events by project/role/scope
  4. (Semi-automated) Agent tells user to notify downstream agents
```

## Key Specs Spread Across Design Docs

### SQLite Schema (from [docs/design.md](docs/design.md#L240-L265))

Four tables: `projects`, `registrations`, `events`, `tokens`. See the source for full DDL. Note that `tokens` stores `token_hash` (never raw tokens), `registrations` tracks workpath + giturl, and `events` has `doc_path` + `doc_script` from docRef.

### Auth Model (from [docs/design.md](docs/design.md#L220-L233))

- **Project isolation**: data cannot cross project boundaries
- **Role-level tokens**: one token per (project, role) pair
- **CLI commands**: `mcp-agentlink token generate --project <id> --role <role>`
- Archive a project → its tokens auto-revoke

### Agent Init Flow (from [docs/design.md](docs/design.md#L135-L168))

6-step Q&A flow: user says "connect to mcp-agentlink" → check workspace config → Q&A (project, role, sender, workpath, giturl, token, server_url) → write config → register → ready.

### Client Skill Rules (from [docs/design.md](docs/design.md#L200-L216))

Three agent behavior rules in `skill.md`:
1. On startup: if `enabled=true`, auto register + queryEvents for own scope
2. On long task completion: write local doc, postEvent, alert user for cross-role notifications
3. During work: periodically queryEvents, decide to read summary or docRef based on relevance

### Agent Config Format (from [docs/design.md](docs/design.md#L72-L83))

Written to CLAUDE.md / AGENTS.md during init (token stored separately in `.mcp-agentlink.token`, in `.gitignore`):

```markdown
## mcp-agentlink Config
enabled: true
project: payment-rebuild
role: api-owner
sender: repo-A/coder
workpath: /home/user/repo-A
giturl: https://github.com/user/repo-A
server_url: https://mcp-agentlink.example.com
```

## Implementation Roadmap

### Phase 1 — MVP ✅ (completed 2026-06-24)

1. ✅ **Monorepo scaffold** — npm workspaces, TypeScript strict
2. ✅ **Server: CLI framework** — 14 commands via commander
3. ✅ **Server: SQLite storage** — sql.js, 4 tables, migrations, CRUD stores
4. ✅ **Server: MCP over SSE** — Express + SSE transport, 3 tools registered
5. ✅ **Server: Auth middleware** — SHA-256 token verification on every tool call
6. ✅ **Server: MCP tools** — `register` (idempotent), `postEvent`, `queryEvents` (sinceId cursor)
7. ✅ **Client: npm package** — `init` (local setup) + `skill/skill.md` + README
8. ✅ **DevOps** — CI/CD pipeline (.github/workflows/ci.yml), CHANGELOG.md both packages

### Phase 2

- `/agentlink` slash command (toggle, status)
- File linking (repo-to-repo file mapping)
- Full project archive flow
- Error handling & retry

### Phase 3

- Event history & statistics
- Finer-grained auth
- Performance & monitoring

### Phase 4 — Collaborative Governance ✅ (completed 2026-06-26)

- **PM role mechanism**: register --role pm, project close, PM_EXISTS/NO_PM errors
- **Charter system**: charters table, publishCharter/syncCharter MCP tools, GUID versioning
- **Local storage**: ~/.mcp-agentlink/ (global) + .mcp-agentlink/ (project-level) two-layer structure
- **Data flow sync**: /agentlink sync, POST /api/agent/sync REST endpoint
- **Client enhancements**: format utilities, skill formalization, sender auto-generation

## Key Conventions

- **Language**: TypeScript (strict mode)
- **SDK**: `@modelcontextprotocol/sdk`
- **Transport**: MCP over SSE (production), stdio (local dev)
- **Database**: SQLite via `sql.js` (pure JS/WASM); optional `better-sqlite3` for native performance
- **Packaging**: Two independent npm packages, semver tagging, CHANGELOG required per package
- **License**: Apache 2.0
- **CLI**: No `npx` — run as `mcp-agentlink <command>` (installed globally or via OpenClaw)
- **Config format**: YAML-ish key:value pairs in CLAUDE.md / AGENTS.md
- **Role naming**: kebab-case, e.g. `api-owner`, `frontend-consumer`, `schema-owner`, `tester`
- **Event types**: lowercase — `start`, `finish`, `milestone`, `error`, `assignment`
- **Branch naming**: `feat/*`, `fix/*`, `docs/*` (conventional commits)
- **Git commits**: End with `Co-Authored-By: Claude <noreply@anthropic.com>`

## Common Commands (once initialized)

```bash
# Server development
cd packages/server
npm run dev          # Watch mode with ts-node or tsx
npm run build        # TypeScript compile
npm run test         # Run tests
npm run test:watch   # Watch mode tests
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit

# Client development
cd packages/client
npm run build
npm run test
npm run lint

# Root
npm run build        # Build all packages
npm run test         # Test all packages
npm run lint         # Lint all packages
```

Expected dependencies:

- **Runtime**: `@modelcontextprotocol/sdk`, `sql.js`, `commander` (or `yargs` for CLI), `express` (for SSE server)
- **Dev**: `typescript` (strict), `eslint`, `vitest` (or `jest`), `tsx` (for dev server)

## CI/CD Pipeline (from [docs/pipeline-and-rules.md](docs/pipeline-and-rules.md))

```text
push → lint/typecheck → test → build → [tag vX.Y.Z → npm publish]
                                        ↑ main branch or tag push only
```

Package publish requires: README.md, CHANGELOG.md, skill/ directory (client only), compiled code.

## Relevant Files to Read When Starting Implementation

| To understand | Read |
|---------------|------|
| Full design spec | [docs/design.md](docs/design.md) |
| Architecture overview | [docs/architecture-overview.md](docs/architecture-overview.md) |
| Two-package structure | [docs/project-structure.md](docs/project-structure.md) |
| CI/CD & packaging standards | [docs/pipeline-and-rules.md](docs/pipeline-and-rules.md) |
| Agent behavior rules | [docs/design.md](docs/design.md#L200-L216) |
| SQLite DDL | [docs/design.md](docs/design.md#L240-L265) |
| CLI command list | [docs/design.md](docs/design.md#L104-L121) |
| MVP tools spec | [docs/design.md](docs/design.md#L171-L196) |
| Auth model | [docs/design.md](docs/design.md#L220-L233) |
| Agent init flow | [docs/design.md](docs/design.md#L135-L168) |
