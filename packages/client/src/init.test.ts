import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { init, readToken, readConfig } from "./init.js";
import { existsSync, unlinkSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const testDir = join(tmpdir(), "mcp-agentlink-test-" + randomBytes(4).toString("hex"));
const workspaceFile = join(testDir, "CLAUDE.md");
const tokenFile = join(testDir, ".mcp-agentlink.token");

const testParams = {
  project: "payment-rebuild",
  role: "api-owner",
  sender: "repo-a/coder",
  workpath: "/home/user/repo-a",
  giturl: "https://github.com/user/repo-a",
  server_url: "https://mcp-agentlink.example.com",
  token: "test-token-123",
};

describe("init", () => {
  beforeEach(() => {
    // Create test directory and cd into it
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up test files
    try { unlinkSync(workspaceFile); } catch {}
    try { unlinkSync(tokenFile); } catch {}
  });

  it("writes config to workspace file", () => {
    const result = init(testParams, workspaceFile);
    expect(result.configWritten).toBe(true);
    expect(result.configPath).toBe(workspaceFile);

    const content = readFileSync(workspaceFile, "utf-8");
    expect(content).toContain("## mcp-agentlink Config");
    expect(content).toContain("project: payment-rebuild");
    expect(content).toContain("role: api-owner");
    expect(content).toContain("server_url: https://mcp-agentlink.example.com");
    expect(content).not.toContain("token"); // token NOT in workspace file
  });

  it("writes token to separate .mcp-agentlink.token file", () => {
    const result = init(testParams, workspaceFile);
    expect(result.tokenFileWritten).toBe(true);
    expect(result.tokenPath).toContain(".mcp-agentlink.token");

    const tokenContent = readFileSync(tokenFile, "utf-8");
    expect(tokenContent).toBe("test-token-123");
  });

  it("is idempotent — re-running updates in place", () => {
    init(testParams, workspaceFile);
    const result2 = init(
      { ...testParams, project: "new-project" },
      workspaceFile
    );

    const content = readFileSync(workspaceFile, "utf-8");
    // Should only have ONE config block (updated in place)
    const matches = content.match(/## mcp-agentlink Config/g);
    expect(matches?.length).toBe(1);
    expect(content).toContain("project: new-project");
  });

  it("appends to existing file that doesn't have a config block", () => {
    writeFileSync(workspaceFile, "# Existing file content\n", "utf-8");
    init(testParams, workspaceFile);

    const content = readFileSync(workspaceFile, "utf-8");
    expect(content).toContain("# Existing file content");
    expect(content).toContain("## mcp-agentlink Config");
  });
});

describe("readToken", () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });
  afterEach(() => {
    try { unlinkSync(tokenFile); } catch {}
  });

  it("returns null when no token file exists", () => {
    const token = readToken();
    expect(token).toBeNull();
  });

  it("reads token from file", () => {
    writeFileSync(tokenFile, "my-secret-token", "utf-8");
    const token = readToken();
    expect(token).toBe("my-secret-token");
  });
});

describe("readConfig", () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });
  afterEach(() => {
    try { unlinkSync(workspaceFile); } catch {}
    try { unlinkSync(tokenFile); } catch {}
  });

  it("returns null when no workspace file exists", () => {
    const config = readConfig(workspaceFile);
    expect(config).toBeNull();
  });

  it("reads full config from workspace file", () => {
    init(testParams, workspaceFile);
    const config = readConfig(workspaceFile);
    expect(config).toBeTruthy();
    expect(config!.project).toBe("payment-rebuild");
    expect(config!.role).toBe("api-owner");
    expect(config!.sender).toBe("repo-a/coder");
    expect(config!.workpath).toBe("/home/user/repo-a");
    expect(config!.giturl).toBe("https://github.com/user/repo-a");
    expect(config!.server_url).toBe("https://mcp-agentlink.example.com");
    expect(config!.token).toBe("test-token-123");
  });
});
