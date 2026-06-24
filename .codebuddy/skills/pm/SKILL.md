---
name: pm
description: "Project management skill for mcp-agentlink. Handles issue/PR creation and review, milestone tracking, CI/CD pipeline management, npm package releases, and design document auditing. Use when user mentions issue, PR, milestone, release, publish, package, CI/CD, audit document, or review doc."
---

# PM �� mcp-agentlink Project Management

## Overview

This skill encodes all project management conventions for the mcp-agentlink monorepo �� a two-package TypeScript project
(server + client) implementing an MCP-based cross-agent communication hub. Use this skill to create structured issues,
review PRs against merge criteria, manage milestones, audit design documents, and enforce package release standards.

## Core Capabilities

### 1. Issue Management

To create an issue, load `references/issue-template.md` for the full template and submission rules.

**Quick template:**

```yaml
project:   # mcp-agentlink project name
sender:    # repo/agent-id
role:      # kebab-case role
type:      # bug | feature | improvement | question
scene:     # description of context
priority:  # high | medium | low
```

Key rules:
- Every issue must be linked to a milestone (MVP/v0.1.0, v0.2.0, v0.3.0, or Backlog)
- Phase 1 allows GitHub Web UI issues directly; post-Phase 1 requires `/agentlink` skill
- Auto-label based on type: bug��bug, feature��enhancement, improvement��improvement, question��question

### 2. Milestone Tracking

Load `references/milestones.md` for full milestone definitions.

The project has three phases:
- **MVP (v0.1.0)**: 8 modules �� monorepo scaffold, CLI, SQLite storage, MCP/SSE, auth, server tools, client package, DevOps
- **v0.2.0**: `/agentlink` command, file linking, project archive, error handling, event purge
- **v0.3.0**: event history, finer auth, performance, monitoring

When assigning issues to milestones, match the issue scope to the appropriate phase. Items not fitting any phase go to Backlog.

### 3. PR Review

Load `references/pr-template.md` for full template and merge criteria.

**Quick template:**

```yaml
closes:        # issue number (required)
type:          # fix | feat | refactor | docs | chore
changelog:     # one-line change description
breaking:      # true | false
affected:      # [server | client | docs | ci]
```

Merge checklist �� ALL must pass:
1. CI green (lint + typecheck + test + build)
2. Linked to at least one issue
3. CHANGELOG entry written to the affected package's CHANGELOG.md
4. Version bumped per semver
5. Branch name follows conventional commit pattern (`feat/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*`)

### 4. CI/CD Pipeline

Load `references/ci-pipeline.md` for full pipeline specification.

Pipeline: `push �� lint/typecheck �� test �� build �� [tag vX.Y.Z �� npm publish]` (tag/publish only on main or tag push).

Two packages (server/client) have independent versioning and separate CI pipelines. Version format: semver `v<major>.<minor>.<patch>`.

Test requirements: unit tests for storage + auth (>80% coverage), integration tests for MCP tools end-to-end, no E2E.

### 5. Package Release

Load `references/package-standards.md` for full release standards.

Each published package must contain:
- `README.md` �� agent-readable (purpose, concepts, quick start, tool/command list)
- `CHANGELOG.md` �� per-version Added/Changed/Fixed
- `skill/` directory �� client-only, the core deliverable
- `dist/` �� compiled output

Commit conventions: branch name per type, commit ends with `Co-Authored-By` line. CLAUDE.md commits use Claude co-author; CODEBUDDY.md commits use CodeBuddy co-author.

### 6. Document Audit

When auditing design documents for the mcp-agentlink repo, use `references/audit-checklist.md` as the review checklist.

Key things to check across `docs/*.md`:
- No contradictions between files (storage choice, communication model, CI/CD stages)
- `architecture-overview.md` clearly separates MVP scope from future phases
- `project-structure.md` CI/CD matches `pipeline-and-rules.md`
- Status checklists are current (not stale from earlier drafts)
- CLAUDE.md and CODEBUDDY.md maintain independent co-author identifiers

## Workflow: Creating an Issue

1. Determine if this is a Phase 1 issue (GitHub Web UI OK) or Phase 2+ (requires skill)
2. Load `references/issue-template.md`
3. Populate all required fields in the YAML template
4. Assign to correct milestone (`references/milestones.md`)
5. Add appropriate label
6. Submit and verify milestone/label linkage

## Workflow: Reviewing a PR

1. Load `references/pr-template.md` and `references/audit-checklist.md`
2. Verify all 5 merge checklist items
3. Check affected packages align with changes
4. Confirm CHANGELOG entry is meaningful and properly formatted
5. Reject if any required condition is not met

## References

- `references/issue-template.md` �� Issue template, labels, submission rules
- `references/pr-template.md` �� PR template, merge criteria, branch naming
- `references/ci-pipeline.md` �� CI/CD stages, test requirements, versioning
- `references/package-standards.md` �� Package contents, README/CHANGELOG format, commit conventions
- `references/milestones.md` �� Phase 1/2/3 milestone definitions and deliverable list
- `references/audit-checklist.md` �� PM audit checklist for docs, issues, PRs, packages, milestones
