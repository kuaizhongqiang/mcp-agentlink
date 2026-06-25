#!/usr/bin/env node

/**
 * mcp-agentlink CLI — Server management commands.
 *
 * Usage: mcp-agentlink <command> [options]
 */

import { Command } from "commander";
import { closeApp, getApp } from "../app/index.js";
import { getServerStatus } from "../mcp/handlers.js";
import { registerServerCommands } from "./server.js";
import { registerProjectCommands } from "./project.js";
import { registerTokenCommands } from "./token.js";
import { registerRegisterCommands } from "./register.js";
import { registerEventCommands } from "./event.js";
import { registerLinkCommands } from "./link.js";

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
  .version("0.3.0");

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

program.parse(process.argv);
