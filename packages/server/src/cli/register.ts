/**
 * mcp-agentlink register list
 */

import type { Command } from "commander";
import { getApp } from "../app/index.js";
import { RegistrationStore } from "../storage/registrations.js";

export function registerRegisterCommands(program: Command): void {
  const reg = program
    .command("register")
    .description("Manage agent registrations");

  reg
    .command("list")
    .description("List registered agents")
    .option("--project <id>", "Filter by project")
    .action(async (options: { project?: string }) => {
      const db = await getApp();
      const store = new RegistrationStore(db);
      const registrations = store.list(options.project);
      if (registrations.length === 0) {
        console.log("No registrations found.");
        return;
      }
      for (const r of registrations) {
        const icon = r.status === "online" ? "🟢" : "🔴";
        console.log(
          `  ${icon} ${r.sender.padEnd(25)} ${r.role.padEnd(20)} ${r.status.padEnd(8)} last: ${r.last_seen}`
        );
      }
    });
}
