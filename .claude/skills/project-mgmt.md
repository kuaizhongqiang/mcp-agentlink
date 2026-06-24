---
name: project-mgmt
description: Project management workflow — issues, PRs, milestones, CI/CD, and package publishing.
---

# Project Management Skill

This skill codifies the conventions from [docs/pipeline-and-rules.md](docs/pipeline-and-rules.md) and [docs/design.md](docs/design.md). Invoke it when managing the development workflow.

## Branch Convention

```text
feat/<description>   — New feature
fix/<description>    — Bug fix
docs/<description>   — Documentation only
chore/<description>  — Maintenance, config, deps
```

Branch from `main`. Rebase before merging.

## Commit Convention

```text
<type>: <short description>

<body> (optional, wrap at 72 chars)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`.

Always end with `Co-Authored-By: Claude <noreply@anthropic.com>` (for CLAUDE.md; CODEBUDDY.md uses `CodeBuddy <noreply@agent.local>`).

## Issue Workflow

### Template

```yaml
project:   <project name>
sender:    <repo>/<agent-id>
role:      <role>
type:      bug | feature | improvement | question
scene:     <what was happening when the issue occurred>
priority:  high | medium | low
```

### Rules

- **Phase 1** (pre-`/agentlink` skill): submit via GitHub Web UI
- **Phase 2+**: submit via `/agentlink` skill for structured metadata
- Labels auto-assigned from `type` field
- Assign maintainer by `project` routing
- Link related issues by similarity search in center

## PR Workflow

### Template

```yaml
closes:    <issue #>
type:      fix | feat | refactor | docs | chore
changelog: <one-line change description>
breaking:  true | false
affected:  [server, client]  # packages affected
```

### Merge Conditions

- [ ] CI passes (lint + typecheck + test + build)
- [ ] Linked to at least one issue
- [ ] CHANGELOG updated
- [ ] Version bumped (if releasing)

### Auto Operations

- Merge to `main` → auto tag + trigger publish
- Auto-generate/append CHANGELOG entry
- Auto-close linked issue

## Milestone Convention

```text
v<major>.<minor>.<patch>   — e.g. v0.1.0, v0.2.0
```

- Track issues/PRs per milestone
- Each milestone = one npm publish cycle
- Two packages version independently: e.g. server v0.1.0 + client v0.2.0

## CI/CD Pipeline

```text
push → lint/typecheck → test → build → [tag vX.Y.Z → npm publish]
                                        ↑ main or tag push only
```

### Quality Gates

| Stage | Tool | Fail on |
|-------|------|---------|
| lint | ESLint | any error or warning |
| typecheck | `tsc --noEmit` | type error |
| test | vitest | failing test |
| build | `npm run build` | compile error |

### Package Publish Requirements

Each package must include:
- `README.md` — agent-readable: purpose, concepts (Project/Sender/Role), quick start, tool list
- `CHANGELOG.md` — per-version entries with `Added`/`Changed`/`Fixed` sections
- `skill/` directory — client package only: skill.md + related resources
- Compiled JavaScript output

## Versioning

Semantic versioning (semver), independently per package:

```text
patch — bugfix, docs update
minor — new feature, backward-compatible
major — breaking API change
```

Tag format: `v<major>.<minor>.<patch>` (e.g. `v0.1.0`). Tags apply project-wide; the tag
triggers publish for all packages, but each package independently checks its own version.

## CHANGELOG Format

```markdown
## [<version>] - <YYYY-MM-DD>

### Added
- New feature description

### Changed
- Backward-compatible changes

### Fixed
- Bug fixes
```

## Release Workflow

1. Ensure all PRs for this release are merged to `main`
2. Update `CHANGELOG.md` for each affected package
3. Bump `version` in `package.json` for each affected package
4. Push tag `vX.Y.Z` → CI auto-publishes to npm
5. Verify: `npm view <package> versions` confirms the new version

## Verification Loop

After any deploy/publish:
1. Confirm the npm registry shows the new version
2. Run `npm install <package>@latest` in a test project
3. Smoke-test the installed binary/tools
4. Report pass/fail back

## Project Structure Reference

```text
mcp-agentlink/
├── packages/
│   ├── server/          # mcp-agentlink-server
│   │   ├── src/
│   │   ├── CHANGELOG.md
│   │   └── package.json
│   └── client/          # mcp-agentlink-client
│       ├── src/
│       ├── skill/
│       │   └── skill.md
│       ├── README.md
│       ├── CHANGELOG.md
│       └── package.json
├── docs/
├── CLAUDE.md
└── CODEBUDDY.md
```
