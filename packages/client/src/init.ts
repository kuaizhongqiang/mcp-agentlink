/**
 * Client-side init — two-layer storage: global (~/.mcp-agentlink/) + project-level (.mcp-agentlink/).
 *
 * Global layer (shared across all projects):
 *   ~/.mcp-agentlink/client-config.json   — { defaultServerUrl, projects: [...] }
 *   ~/.mcp-agentlink/cache/{project-id}/
 *       charter.yaml                       — Cached charter content
 *       sync-meta.json                     — { guid, publishedAt, syncedAt }
 *
 * Project layer (one per repo root):
 *   {root}/.mcp-agentlink/
 *       identity.json                      — { project, role, sender, workpath, giturl, server_url, enabled }
 *       token                              — Raw token string (in .gitignore)
 *       .gitignore                         — Auto-created to ignore token
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

// ── Overridable global directory (for testing) ─────────────

let _globalDirOverride: string | null = null;

/**
 * Override the global config directory (used for testing).
 * Pass null to reset to default.
 */
export function setGlobalDir(dir: string | null): void {
  _globalDirOverride = dir;
}

function getGlobalDir(): string {
  return _globalDirOverride ?? join(homedir(), ".mcp-agentlink");
}
const CACHE_DIR = (projectId: string) => join(getGlobalDir(), "cache", projectId);
const PROJECT_DIR = (root?: string) => join(root ?? process.cwd(), ".mcp-agentlink");

// ── Types ──────────────────────────────────────────────────

export interface InitParams {
  project: string;
  role: string;
  sender: string;
  workpath: string;
  giturl: string;
  server_url: string;
  token: string;
}

export interface InitResult {
  identityWritten: boolean;
  tokenWritten: boolean;
  gitignoreWritten: boolean;
  globalConfigUpdated: boolean;
  identityPath: string;
  tokenPath: string;
}

export interface ProjectIdentity {
  project: string;
  role: string;
  sender: string;
  workpath: string;
  giturl: string;
  server_url: string;
  enabled: boolean;
}

export interface GlobalConfig {
  defaultServerUrl?: string;
  projects: string[];
}

export interface SyncMeta {
  guid: string;
  publishedAt: string;
  syncedAt: string;
}

export interface SyncResult {
  charter: { content: string; guid: string; published_at: string } | null;
  project: { id: string; status: string } | null;
  syncedAt: string;
}

// ── Global config (read/write) ─────────────────────────────

export function readGlobalConfig(): GlobalConfig | null {
  const configPath = join(getGlobalDir(), "client-config.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeGlobalConfig(config: GlobalConfig): void {
  const dir = getGlobalDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "client-config.json"), JSON.stringify(config, null, 2), "utf-8");
}

export function addProjectToGlobal(projectId: string): void {
  const config = readGlobalConfig() ?? { defaultServerUrl: undefined, projects: [] };
  if (!config.projects.includes(projectId)) {
    config.projects.push(projectId);
  }
  writeGlobalConfig(config);
}

// ── Project-level identity (read/write) ────────────────────

export function writeProjectIdentity(root: string | undefined, identity: ProjectIdentity): void {
  const dir = PROJECT_DIR(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "identity.json"), JSON.stringify(identity, null, 2), "utf-8");
}

export function readProjectIdentity(root?: string): ProjectIdentity | null {
  const identityPath = join(PROJECT_DIR(root), "identity.json");
  if (!existsSync(identityPath)) return null;
  try {
    return JSON.parse(readFileSync(identityPath, "utf-8"));
  } catch {
    return null;
  }
}

// ── Token (read/write) ─────────────────────────────────────

export function writeToken(root: string | undefined, token: string): void {
  const dir = PROJECT_DIR(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "token"), token, "utf-8");
}

/**
 * Read the token from the project-level .mcp-agentlink/token file.
 * Falls back to legacy .mcp-agentlink.token if new format not found.
 */
export function readToken(root?: string): string | null {
  // New format: .mcp-agentlink/token
  const newTokenPath = join(PROJECT_DIR(root), "token");
  if (existsSync(newTokenPath)) {
    return readFileSync(newTokenPath, "utf-8").trim();
  }

  // Legacy format: .mcp-agentlink.token in project root
  const legacyTokenPath = join(root ?? process.cwd(), ".mcp-agentlink.token");
  if (existsSync(legacyTokenPath)) {
    return readFileSync(legacyTokenPath, "utf-8").trim();
  }

  return null;
}

// ── Charter cache (read/write) ─────────────────────────────

export function writeCharterCache(projectId: string, content: string): void {
  const dir = CACHE_DIR(projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "charter.yaml"), content, "utf-8");
}

export function readCharterCache(projectId: string): string | null {
  const path = join(CACHE_DIR(projectId), "charter.yaml");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

export function writeSyncMeta(projectId: string, meta: SyncMeta): void {
  const dir = CACHE_DIR(projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "sync-meta.json"), JSON.stringify(meta, null, 2), "utf-8");
}

export function readSyncMeta(projectId: string): SyncMeta | null {
  const path = join(CACHE_DIR(projectId), "sync-meta.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// ── Config block (legacy workspace-file format) ────────────

const MARKER_START = "## mcp-agentlink Config";
const MARKER_END = "<!-- mcp-agentlink-end -->";

/**
 * Read config from a legacy workspace file (CLAUDE.md / AGENTS.md).
 * Returns null if no config is found.
 */
export function readConfig(workspaceFile: string): Partial<InitParams> | null {
  if (!existsSync(workspaceFile)) return null;
  const content = readFileSync(workspaceFile, "utf-8");
  const match = content.match(
    new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`)
  );
  if (!match) return null;

  const block = match[0];
  const config: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes(":") || trimmed.startsWith("#") || trimmed.startsWith("<!--")) continue;
    const sep = trimmed.indexOf(":");
    const key = trimmed.slice(0, sep).trim();
    const val = trimmed.slice(sep + 1).trim();
    config[key] = val;
  }

  return {
    project: config["project"],
    role: config["role"],
    sender: config["sender"],
    workpath: config["workpath"],
    giturl: config["giturl"],
    server_url: config["server_url"],
    token: readToken(dirname(workspaceFile)) ?? undefined,
  } as Partial<InitParams>;
}

// ── Legacy migration ───────────────────────────────────────

/**
 * Detect if legacy config exists (config block in workspace file + .mcp-agentlink.token).
 */
export function detectLegacyConfig(root?: string): boolean {
  const legacyTokenPath = join(root ?? process.cwd(), ".mcp-agentlink.token");
  if (existsSync(legacyTokenPath)) return true;

  // Check for config block in common workspace files
  for (const f of ["CLAUDE.md", "AGENTS.md", "CODEBUDDY.md"]) {
    const p = join(root ?? process.cwd(), f);
    if (existsSync(p) && readFileSync(p, "utf-8").includes(MARKER_START)) return true;
  }

  return false;
}

/**
 * Migrate from legacy format to new two-layer structure.
 * Reads .mcp-agentlink.token + workspace config block, writes identity.json + token.
 */
export function migrateLegacyConfig(root?: string): boolean {
  const projectRoot = root ?? process.cwd();

  // Read legacy token
  const legacyTokenPath = join(projectRoot, ".mcp-agentlink.token");
  const token = existsSync(legacyTokenPath) ? readFileSync(legacyTokenPath, "utf-8").trim() : null;

  // Read legacy config from workspace files
  let config: Partial<InitParams> | null = null;
  for (const f of ["CLAUDE.md", "AGENTS.md", "CODEBUDDY.md"]) {
    config = readConfig(join(projectRoot, f));
    if (config) break;
  }

  if (!config && !token) return false;

  // Write new format
  const identity: ProjectIdentity = {
    project: config?.project ?? "unknown",
    role: config?.role ?? "unknown",
    sender: config?.sender ?? "unknown",
    workpath: config?.workpath ?? projectRoot,
    giturl: config?.giturl ?? "",
    server_url: config?.server_url ?? "",
    enabled: true,
  };

  writeProjectIdentity(projectRoot, identity);
  if (token) writeToken(projectRoot, token);
  writeGitignore(projectRoot);

  return true;
}

// ── .gitignore management ─────────────────────────────────

function writeGitignore(root: string): void {
  const gitignorePath = join(PROJECT_DIR(root), ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, "token\n", "utf-8");
  }
}

// ── Init ───────────────────────────────────────────────────

/**
 * Run the init process: write identity + token to .mcp-agentlink/,
 * update global config, and create .gitignore.
 *
 * @param params - Configuration parameters collected via Q&A
 * @param root - Project root directory (default: process.cwd())
 * @returns Result with paths and success flags
 */
export function init(params: InitParams, root?: string): InitResult {
  const projectRoot = root ?? process.cwd();
  const identityPath = join(PROJECT_DIR(projectRoot), "identity.json");
  const tokenPath = join(PROJECT_DIR(projectRoot), "token");

  // 1. Write project identity
  writeProjectIdentity(projectRoot, {
    project: params.project,
    role: params.role,
    sender: params.sender,
    workpath: params.workpath,
    giturl: params.giturl,
    server_url: params.server_url,
    enabled: true,
  });

  // 2. Write token
  writeToken(projectRoot, params.token);

  // 3. Create .gitignore
  writeGitignore(projectRoot);

  // 4. Update global config
  addProjectToGlobal(params.project);

  return {
    identityWritten: true,
    tokenWritten: true,
    gitignoreWritten: true,
    globalConfigUpdated: true,
    identityPath,
    tokenPath,
  };
}

// ── Sync ───────────────────────────────────────────────────

/**
 * Sync charter from server to local cache.
 * Calls the server's sync endpoint and writes results to local cache.
 */
export async function sync(
  serverUrl: string,
  projectId: string,
  token: string
): Promise<SyncResult> {
  const url = serverUrl.replace(/\/+$/, "") + "/api/agent/sync";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project: projectId, token }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Sync failed: ${err.error ?? response.statusText}`);
  }

  const data = await response.json();

  if (data.charter?.content) {
    writeCharterCache(projectId, data.charter.content);
  }

  writeSyncMeta(projectId, {
    guid: data.charter?.guid ?? "",
    publishedAt: data.charter?.published_at ?? "",
    syncedAt: new Date().toISOString(),
  });

  return {
    charter: data.charter ?? null,
    project: data.project ?? null,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Read the sync status for a project without making a network call.
 */
export function getSyncStatus(projectId: string): {
  hasCachedCharter: boolean;
  lastSynced: string | null;
  guid: string | null;
} {
  const meta = readSyncMeta(projectId);
  const charter = readCharterCache(projectId);

  return {
    hasCachedCharter: charter !== null,
    lastSynced: meta?.syncedAt ?? null,
    guid: meta?.guid ?? null,
  };
}

/**
 * Write the agentlink skill file to .claude/skills/agentlink.md.
 */
export function writeSkillFile(root?: string): void {
  const projectRoot = root ?? process.cwd();
  const claudeDir = join(projectRoot, ".claude", "skills");
  mkdirSync(claudeDir, { recursive: true });

  const skillContent = `# agentlink — Cross-Project Agent Communication

## Auto-trigger Rules

1. On startup: if .mcp-agentlink/identity.json exists and enabled=true:
   - Read identity from identity.json
   - Read token from .mcp-agentlink/token
   - Call register MCP tool → center confirms identity
   - Call queryEvents with scope=own role → pull pending events
   - Suggest executing \`/agentlink sync\` to fetch latest charter

2. After long task completion:
   - Write local doc with summary
   - Call postEvent with type=finish | milestone, scope=target role

3. Periodically:
   - Call queryEvents with scope=own role

## Slash Commands
- /agentlink init — Initialize connection (Q&A setup)
- /agentlink sync — Fetch latest charter from server (overwrites local cache)
- /agentlink status — Show connection status
- /agentlink on — Enable connection
- /agentlink off — Disable connection

## MCP Tools Available
- register — Register agent identity
- postEvent — Post completion/status event
- queryEvents — Pull events by scope/type
- publishCharter — Publish project charter (PM only)
- syncCharter — Fetch latest charter
- status — Server status
- linkFile, queryLinks, unlinkFile — File linking
`;
  writeFileSync(join(claudeDir, "agentlink.md"), skillContent, "utf-8");
}

// ── Sender auto-generation ─────────────────────────────────

import { execSync } from "node:child_process";

/**
 * Detect the repository identifier from git remote.
 * Returns "org/repo" or "unknown" if detection fails.
 */
export function detectRepo(): string {
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const match = remote.match(/([^/:]+\/[^/.]+?)(?:\.git)?$/);
    return match ? match[1] : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Detect the agent name from system environment.
 * Uses USER or USERNAME env var, falls back to hostname.
 */
export function detectAgentName(): string {
  const user = process.env.USER ?? process.env.USERNAME;
  return user ?? "coder";
}

/**
 * Generate a sender identifier in {repo}/{agent} format.
 */
export function generateSender(repo?: string, agent?: string): string {
  const r = repo ?? detectRepo();
  const a = agent ?? detectAgentName();
  return `${r}/${a}`;
}
