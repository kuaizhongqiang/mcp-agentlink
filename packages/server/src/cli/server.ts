/**
 * mcp-agentlink server start | stop | status | logs | cleanup-registrations
 */

import type { Command } from "commander";
import { getApp } from "../app/index.js";
import { startServer, stopServer, getStatus } from "../mcp/index.js";
import { RegistrationStore } from "../storage/registrations.js";

export function registerServerCommands(program: Command): void {
  const server = program
    .command("server")
    .description("Manage the MCP server process");

  server
    .command("start")
    .description("Start the MCP over SSE server")
    .option("-p, --port <number>", "Port to listen on", "3000")
    .action(async (options: { port: string }) => {
      const port = parseInt(options.port, 10);
      try {
        await startServer(port);
      } catch (err) {
        console.error(`❌ Failed to start server: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  server
    .command("stop")
    .description("Stop the server")
    .action(async () => {
      await stopServer();
    });

  server
    .command("status")
    .description("Show server runtime status")
    .action(() => {
      const s = getStatus();
      console.log(`  Status:    ${s.running ? "🟢 Running" : "🔴 Stopped"}`);
      console.log(`  Sessions:  ${s.sessions}`);
    });

  server
    .command("logs")
    .description("Show server logs (placeholder — use journalctl or stdout)")
    .action(() => {
      console.log(
        "Server logs are written to stdout. When deployed via systemd, use: journalctl -u mcp-agentlink"
      );
    });

  server
    .command("cleanup-registrations")
    .description("Mark stale registrations as offline")
    .option(
      "--timeout <seconds>",
      "Seconds since last_seen to consider stale",
      "3600"
    )
    .action(async (options: { timeout: string }) => {
      const db = await getApp();
      const store = new RegistrationStore(db);
      const timeout = parseInt(options.timeout, 10);
      const count = store.markOffline(timeout);
      console.log(`   ${count} stale registrations marked offline (timeout: ${timeout}s)`);
    });
}
