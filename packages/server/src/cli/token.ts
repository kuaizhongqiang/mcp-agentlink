/**
 * mcp-agentlink token generate | revoke | list
 */

import type { Command } from "commander";
import { getApp } from "../app/index.js";
import { TokenStore, type Permission } from "../storage/tokens.js";

export function registerTokenCommands(program: Command): void {
  const token = program.command("token").description("Manage access tokens");

  token
    .command("generate")
    .description("Generate a new token for a project and role")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--role <role>", "Role name (kebab-case)")
    .option(
      "--perms <level>",
      "Permission level: read, write (default), or admin",
      "write"
    )
    .action(
      async (options: {
        project: string;
        role: string;
        perms: string;
      }) => {
        const permission = options.perms as Permission;
        if (!["read", "write", "admin"].includes(permission)) {
          console.error("❌ Invalid permission level. Use: read, write, admin");
          process.exit(1);
        }

        const db = await getApp();
        const store = new TokenStore(db);
        const { token: raw, tokenData } = store.generate(
          options.project,
          options.role,
          permission
        );
        console.log(`✅ Token generated:`);
        console.log(`  Token:       ${raw}`);
        console.log(`  ID:          ${tokenData.id}`);
        console.log(`  Role:        ${tokenData.role}`);
        console.log(`  Permissions: ${tokenData.permissions}`);
        console.log(`  Status:      ${tokenData.status}`);
        console.log(`  ⚠️  This is the only time the raw token is shown.`);
      }
    );

  token
    .command("revoke <token>")
    .description("Revoke a token")
    .action(async (tokenArg: string) => {
      const db = await getApp();
      const store = new TokenStore(db);
      const revoked = store.revoke(tokenArg);
      if (!revoked) {
        console.error("❌ Token not found or already revoked");
        process.exit(1);
      }
      console.log(`✅ Token revoked: ${revoked.id}`);
    });

  token
    .command("list")
    .description("List all tokens for a project")
    .requiredOption("--project <id>", "Project ID")
    .action(async (options: { project: string }) => {
      const db = await getApp();
      const store = new TokenStore(db);
      const tokens = store.list(options.project);
      if (tokens.length === 0) {
        console.log("No tokens found for this project.");
        return;
      }
      for (const t of tokens) {
        const icon = t.status === "active" ? "🟢" : "🔴";
        console.log(
          `  ${icon} ${t.id.substring(0, 8).padEnd(10)} ${t.role.padEnd(20)} ${(t.permissions ?? "write").padEnd(8)} ${t.status}`
        );
      }
    });
}
