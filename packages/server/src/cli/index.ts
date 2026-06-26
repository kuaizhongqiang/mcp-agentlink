#!/usr/bin/env node

/**
 * mcp-agentlink CLI — Server management commands.
 *
 * Usage: mcp-agentlink <command> [options]
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { closeApp, getApp } from "../app/index.js";
import { getServerStatus, setVersion } from "../mcp/handlers.js";
import { registerServerCommands } from "./server.js";
import { registerProjectCommands } from "./project.js";
import { registerTokenCommands } from "./token.js";
import { registerRegisterCommands } from "./register.js";
import { registerEventCommands } from "./event.js";
import { registerLinkCommands } from "./link.js";
import { registerCharterCommands } from "./charter.js";

// Read version from package.json to keep a single source of truth
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8")
);
const VERSION = pkg.version;
setVersion(VERSION);

// Persist database on normal exit and signals
process.on("exit", () => closeApp());
process.on("SIGINT", () => {
  closeApp();
  process.exit(0);
});
process.on("SIGTERM", () => {
  closeApp();
  process.exit(0);
});

const program = new Command();

program
  .name("mcp-agentlink")
  .description("MCP server for cross-project, cross-agent communication")
  .version(VERSION);

// Top-level status command — overview of server data
program
  .command("status")
  .description("Show server status overview")
  .action(async () => {
    const db = await getApp();
    const s = getServerStatus(db);
    console.log(`  mcp-agentlink v${s.version}`);
    console.log(`  Projects:      ${s.projects}`);
    console.log(`  Registrations: ${s.registrationsOnline}/${s.registrations} online`);
    console.log(`  Events:        ${s.events}`);
    console.log(`  Active tokens: ${s.tokensActive}`);
  });

registerServerCommands(program);
registerProjectCommands(program);
registerTokenCommands(program);
registerRegisterCommands(program);
registerEventCommands(program);
registerLinkCommands(program);
registerCharterCommands(program);

program.parse(process.argv);
