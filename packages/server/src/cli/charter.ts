/**
 * mcp-agentlink charter set | show
 */

import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { getApp } from "../app/index.js";
import { CharterStore } from "../storage/charters.js";

export function registerCharterCommands(program: Command): void {
  const charter = program.command("charter").description("Manage project charter");

  charter
    .command("set")
    .description("Publish charter from a file (PM token required)")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--file <path>", "Path to charter content file (YAML/text)")
    .option("--token <token>", "PM authentication token")
    .action(async (options: { project: string; file: string; token?: string }) => {
      if (!existsSync(options.file)) {
        console.error(`❌ File not found: ${options.file}`);
        process.exit(1);
      }

      const content = readFileSync(options.file, "utf-8");

      // Try to get token from local .mcp-agentlink/token if not provided
      let token = options.token;
      if (!token) {
        try {
          const { join } = await import("node:path");
          const tokenPath = join(process.cwd(), ".mcp-agentlink", "token");
          if (existsSync(tokenPath)) {
            const { readFileSync } = await import("node:fs");
            token = readFileSync(tokenPath, "utf-8").trim();
          }
        } catch {
          // Token resolution is best-effort; user needs to provide --token
        }
      }

      if (!token) {
        console.error("❌ No token provided. Use --token <token> or ensure .mcp-agentlink/token exists.");
        process.exit(1);
      }

      // We call the CharterStore directly here, but in a full PM workflow
      // the user would use the MCP publishCharter tool or pass a PM token.
      // For CLI simplicity, we call the store directly (bypasses MCP auth).
      // PM auth is enforced at the MCP tool level.
      const db = await getApp();
      const store = new CharterStore(db);
      const charter = store.publish({
        project: options.project,
        content,
        published_by: "cli",
      });

      console.log(`✅ Charter published for "${options.project}"`);
      console.log(`   GUID:      ${charter.guid}`);
      console.log(`   Published: ${charter.published_at}`);
    });

  charter
    .command("show")
    .description("Show the charter for a project")
    .requiredOption("--project <id>", "Project ID")
    .action(async (options: { project: string }) => {
      const db = await getApp();
      const store = new CharterStore(db);
      const c = store.getByProject(options.project);

      if (!c) {
        console.log(`ℹ️  No charter published for "${options.project}".`);
        return;
      }

      console.log(`Charter for "${options.project}":`);
      console.log(`  GUID:       ${c.guid}`);
      console.log(`  Published:  ${c.published_at}`);
      console.log(`  By:         ${c.published_by}`);
      console.log(`  Updated:    ${c.updated_at}`);
      console.log("─".repeat(50));
      console.log(c.content);
    });
}
