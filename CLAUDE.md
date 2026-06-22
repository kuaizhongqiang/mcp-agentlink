# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mcp-agentlink — an MCP (Model Context Protocol) server for cross-project, cross-agent communication. A centralized storage + registration hub that enables multiple AI coding agents with independent contexts to share events, file references, and work status across repositories.

**Key design principles:**

- Center stores facts only, does not judge logic
- Each agent has independent context (no context mixing)
- Agents communicate via events, not shared context
- Semi-automated: agent notifies user to relay to other agents when needed
- Can be toggled on/off per agent via workspace config

## Current Status

Greenfield project — design complete, implementation pending.

## Design Documents

All design documents are in the [docs/](docs/) directory:

- [docs/architecture-overview.md](docs/architecture-overview.md) — High-level architecture, domain model (Project/Sender/Role), communication flow
- [docs/design.md](docs/design.md) — Complete design specification: event model, MCP tools, auth, storage, pipeline rules, roadmap
- [docs/pipeline-and-rules.md](docs/pipeline-and-rules.md) — CI/CD pipeline, packaging standards, Issue/PR rules
- [docs/project-structure.md](docs/project-structure.md) — Two-package structure (server + client), deployment architecture

## Two-Package Architecture

### mcp-agentlink-server

- TypeScript / Node.js, published as npm package
- MCP over SSE transport
- SQLite storage
- Role-based token auth
- CLI for management: `mcp-agentlink project / token / server` commands
- Deployed on Linux server, managed via OpenClaw CLI

### mcp-agentlink-client

- TypeScript / Node.js, published as npm package
- Agent installs via `npm install mcp-agentlink-client`
- Contains skill.md + README for agent self-deployment
- Provides MCP tools: `init`, `register`, `postEvent`, `queryEvents`

## Domain Model

- **Project** — isolated work domain, can be archived
- **Sender** — who initiated the operation (repo + agent identity)
- **Role** — functional identifier (api-owner, tester, frontend, etc.), used for auth
- **Event** — core data unit: `{ type, sender, summary, scope, docRef, timestamp }`

## MVP MCP Tools

1. `init` — Q&A guided setup, writes config to workspace
2. `register` — Register agent identity + paths with center
3. `postEvent` — Post a completion/status event
4. `queryEvents` — Query events by project/role/type/scope

## Key Conventions

- **License**: Apache 2.0
- **Language**: TypeScript (strict)
- **Transport**: MCP over SSE (remote), stdio (local dev)
- **SDK**: `@modelcontextprotocol/sdk`
- **Packaging**: npm publish, semver tagging, CHANGELOG required
- **Agent init**: Q&A flow writes to CLAUDE.md / AGENTS.md
