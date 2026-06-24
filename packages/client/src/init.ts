/**
 * Client-side init — Q&A setup for an agent's first connection.
 *
 * This is a LOCAL operation. It does NOT call the server.
 * It writes config to the workspace file and token to a separate file.
 */

import { writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

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
  configWritten: boolean;
  tokenFileWritten: boolean;
  configPath: string;
  tokenPath: string;
}

const MARKER_START = "## mcp-agentlink Config";
const MARKER_END = "<!-- mcp-agentlink-end -->";

/**
 * Run the init process: write config to workspace file + token to separate file.
 *
 * @param params - Configuration parameters collected via Q&A
 * @param workspaceFile - Path to workspace file (e.g., CLAUDE.md, AGENTS.md, CODEBUDDY.md)
 * @returns Result with paths and success flags
 */
export function init(params: InitParams, workspaceFile: string): InitResult {
  // 1. Write config to workspace file
  const configBlock = [
    "",
    MARKER_START,
    `enabled: true`,
    `project: ${params.project}`,
    `role: ${params.role}`,
    `sender: ${params.sender}`,
    `workpath: ${params.workpath}`,
    `giturl: ${params.giturl}`,
    `server_url: ${params.server_url}`,
    MARKER_END,
    "",
  ].join("\n");

  // Check if config already exists (idempotent)
  if (existsSync(workspaceFile)) {
    const content = readFileSync(workspaceFile, "utf-8");
    if (content.includes(MARKER_START)) {
      // Replace existing config block
      const regex = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, "g");
      const updated = content.replace(regex, configBlock.trim());
      writeFileSync(workspaceFile, updated, "utf-8");
    } else {
      // Append to end
      appendFileSync(workspaceFile, configBlock, "utf-8");
    }
  } else {
    writeFileSync(workspaceFile, configBlock, "utf-8");
  }

  // 2. Write token to separate file (never in workspace file)
  const tokenFilePath = join(process.cwd(), ".mcp-agentlink.token");
  writeFileSync(tokenFilePath, params.token, "utf-8");

  return {
    configWritten: true,
    tokenFileWritten: true,
    configPath: workspaceFile,
    tokenPath: tokenFilePath,
  };
}

/**
 * Read the token from the local token file.
 * Returns null if the file doesn't exist.
 */
export function readToken(): string | null {
  const tokenFilePath = join(process.cwd(), ".mcp-agentlink.token");
  if (!existsSync(tokenFilePath)) return null;
  return readFileSync(tokenFilePath, "utf-8").trim();
}

/**
 * Read the full config from a workspace file.
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
    token: readToken() ?? undefined,
  } as Partial<InitParams>;
}
