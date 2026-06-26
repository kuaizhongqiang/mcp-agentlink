import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  init,
  readToken,
  readConfig,
  readGlobalConfig,
  writeGlobalConfig,
  readProjectIdentity,
  readCharterCache,
  writeCharterCache,
  readSyncMeta,
  writeSyncMeta,
  detectLegacyConfig,
  migrateLegacyConfig,
  getSyncStatus,
  writeSkillFile,
  detectAgentName,
  generateSender,
  setGlobalDir,
} from "./init.js";
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const testRoot = join(tmpdir(), "mcp-agentlink-test-" + randomBytes(4).toString("hex"));

function testDir(name: string): string {
  const dir = join(testRoot, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may hold locks */ }
}

function setupWithGlobal(globalDir: string) {
  mkdirSync(globalDir, { recursive: true });
  setGlobalDir(globalDir);
}

const testParams = {
  project: "payment-rebuild",
  role: "api-owner",
  sender: "repo-a/coder",
  workpath: "/home/user/repo-a",
  giturl: "https://github.com/user/repo-a",
  server_url: "https://mcp-agentlink.example.com",
  token: "test-token-123",
};

// ── Init ───────────────────────────────────────────────────

describe("init", () => {
  let dir: string;

  beforeEach(() => {
    dir = testDir("init-" + randomBytes(2).toString("hex"));
  });

  afterEach(() => {
    setGlobalDir(null);
    cleanup(dir);
  });

  it("writes identity.json to .mcp-agentlink/", () => {
    setupWithGlobal(join(dir, "global"));
    init(testParams, dir);

    const identity = readProjectIdentity(dir);
    expect(identity).toBeTruthy();
    expect(identity!.project).toBe("payment-rebuild");
    expect(identity!.role).toBe("api-owner");
    expect(identity!.server_url).toBe("https://mcp-agentlink.example.com");
    expect(identity!.enabled).toBe(true);
  });

  it("writes token to .mcp-agentlink/token", () => {
    setupWithGlobal(join(dir, "global2"));
    init(testParams, dir);

    expect(readToken(dir)).toBe("test-token-123");
  });

  it("creates .gitignore in .mcp-agentlink/", () => {
    setupWithGlobal(join(dir, "global3"));
    init(testParams, dir);

    expect(
      readFileSync(join(dir, ".mcp-agentlink", ".gitignore"), "utf-8")
    ).toContain("token");
  });

  it("updates global config", () => {
    const globalDir = join(dir, "global4");
    setupWithGlobal(globalDir);
    init(testParams, dir);

    const globalConfig = readGlobalConfig();
    expect(globalConfig).toBeTruthy();
    expect(globalConfig!.projects).toContain("payment-rebuild");
  });
});

// ── readToken ──────────────────────────────────────────────

describe("readToken", () => {
  let dir: string;

  beforeEach(() => {
    dir = testDir("readToken-" + randomBytes(2).toString("hex"));
  });

  afterEach(() => {
    setGlobalDir(null);
    cleanup(dir);
  });

  it("returns null when no token file exists", () => {
    expect(readToken(dir)).toBeNull();
  });

  it("reads token from .mcp-agentlink/token (new format)", () => {
    mkdirSync(join(dir, ".mcp-agentlink"), { recursive: true });
    writeFileSync(join(dir, ".mcp-agentlink", "token"), "my-secret-token", "utf-8");
    expect(readToken(dir)).toBe("my-secret-token");
  });

  it("falls back to legacy .mcp-agentlink.token", () => {
    writeFileSync(join(dir, ".mcp-agentlink.token"), "legacy-token", "utf-8");
    expect(readToken(dir)).toBe("legacy-token");
  });
});

// ── readConfig (legacy workspace file format) ──────────────

describe("readConfig (legacy)", () => {
  let dir: string;

  beforeEach(() => {
    dir = testDir("readConfig-" + randomBytes(2).toString("hex"));
  });

  afterEach(() => {
    setGlobalDir(null);
    cleanup(dir);
  });

  it("returns null when no workspace file exists", () => {
    expect(readConfig(join(dir, "CLAUDE.md"))).toBeNull();
  });

  it("reads config from workspace file with legacy token fallback", () => {
    const workspaceFile = join(dir, "CLAUDE.md");
    const configBlock = `## mcp-agentlink Config
enabled: true
project: payment-rebuild
role: api-owner
sender: repo-a/coder
workpath: /home/user/repo-a
giturl: https://github.com/user/repo-a
server_url: https://mcp-agentlink.example.com
<!-- mcp-agentlink-end -->
`;
    writeFileSync(workspaceFile, configBlock, "utf-8");
    writeFileSync(join(dir, ".mcp-agentlink.token"), "legacy-token", "utf-8");

    const config = readConfig(workspaceFile);
    expect(config).toBeTruthy();
    expect(config!.project).toBe("payment-rebuild");
    expect(config!.role).toBe("api-owner");
    expect(config!.server_url).toBe("https://mcp-agentlink.example.com");
    expect(config!.token).toBe("legacy-token");
  });
});

// ── Global config ──────────────────────────────────────────

describe("global config", () => {
  let dir: string;

  beforeEach(() => {
    dir = testDir("globalConfig-" + randomBytes(2).toString("hex"));
  });

  afterEach(() => {
    setGlobalDir(null);
    cleanup(dir);
  });

  it("readGlobalConfig returns null when no config exists", () => {
    setupWithGlobal(join(dir, "empty"));
    expect(readGlobalConfig()).toBeNull();
  });

  it("writeGlobalConfig persists config", () => {
    setupWithGlobal(join(dir, "persist"));
    writeGlobalConfig({ defaultServerUrl: "https://example.com", projects: ["p1"] });
    const config = readGlobalConfig();
    expect(config).toBeTruthy();
    expect(config!.defaultServerUrl).toBe("https://example.com");
    expect(config!.projects).toEqual(["p1"]);
  });
});

// ── Charter cache ──────────────────────────────────────────

describe("charter cache", () => {
  let dir: string;

  beforeEach(() => {
    dir = testDir("charterCache-" + randomBytes(2).toString("hex"));
  });

  afterEach(() => {
    setGlobalDir(null);
    cleanup(dir);
  });

  it("writes and reads charter cache", () => {
    setupWithGlobal(join(dir, "global"));
    writeCharterCache("test-project", "vision: test");
    expect(readCharterCache("test-project")).toBe("vision: test");
  });

  it("writes and reads sync meta", () => {
    setupWithGlobal(join(dir, "global2"));
    writeSyncMeta("test-project", { guid: "abc", publishedAt: "2026-01-01", syncedAt: "2026-01-02" });
    const meta = readSyncMeta("test-project");
    expect(meta).toBeTruthy();
    expect(meta!.guid).toBe("abc");
    expect(meta!.syncedAt).toBe("2026-01-02");
  });

  it("getSyncStatus returns correct state", () => {
    setupWithGlobal(join(dir, "global3"));

    const empty = getSyncStatus("fresh-project");
    expect(empty.hasCachedCharter).toBe(false);
    expect(empty.lastSynced).toBeNull();

    writeCharterCache("cached-project", "content");
    writeSyncMeta("cached-project", { guid: "xyz", publishedAt: "2026-01-01", syncedAt: "2026-01-03" });

    const status = getSyncStatus("cached-project");
    expect(status.hasCachedCharter).toBe(true);
    expect(status.guid).toBe("xyz");
    expect(status.lastSynced).toBe("2026-01-03");
  });
});

// ── Legacy migration ───────────────────────────────────────

describe("legacy migration", () => {
  let dir: string;

  beforeEach(() => {
    dir = testDir("legacy-" + randomBytes(2).toString("hex"));
  });

  afterEach(() => {
    setGlobalDir(null);
    cleanup(dir);
  });

  it("detectLegacyConfig returns true when .mcp-agentlink.token exists", () => {
    writeFileSync(join(dir, ".mcp-agentlink.token"), "token", "utf-8");
    expect(detectLegacyConfig(dir)).toBe(true);
  });

  it("detectLegacyConfig returns false for clean directory", () => {
    expect(detectLegacyConfig(dir)).toBe(false);
  });

  it("migrateLegacyConfig migrates token to new format", () => {
    setupWithGlobal(join(dir, "global"));
    writeFileSync(join(dir, ".mcp-agentlink.token"), "migrated-token", "utf-8");
    const result = migrateLegacyConfig(dir);
    expect(result).toBe(true);
    expect(readToken(dir)).toBe("migrated-token");
  });
});

// ── Skill file ─────────────────────────────────────────────

describe("writeSkillFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = testDir("skill-" + randomBytes(2).toString("hex"));
  });

  afterEach(() => {
    setGlobalDir(null);
    cleanup(dir);
  });

  it("writes skill file to .claude/skills/agentlink.md", () => {
    writeSkillFile(dir);
    const skillPath = join(dir, ".claude", "skills", "agentlink.md");
    expect(existsSync(skillPath)).toBe(true);
    const content = readFileSync(skillPath, "utf-8");
    expect(content).toContain("agentlink");
    expect(content).toContain("Auto-trigger Rules");
    expect(content).toContain("publishCharter");
    expect(content).toContain("syncCharter");
  });
});

// ── Sender generation ──────────────────────────────────────

describe("sender generation", () => {
  it("detectAgentName returns a non-empty string", () => {
    const name = detectAgentName();
    expect(name).toBeTruthy();
    expect(typeof name).toBe("string");
  });

  it("generateSender formats correctly", () => {
    const sender = generateSender("my-org/my-repo", "coder");
    expect(sender).toBe("my-org/my-repo/coder");
  });
});
