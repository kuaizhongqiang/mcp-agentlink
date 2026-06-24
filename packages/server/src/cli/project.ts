/**
 * mcp-agentlink project create | archive | list | show
 */

import type { Command } from "commander";
import { getApp } from "../app/index.js";
import { ProjectStore } from "../storage/projects.js";
import { TokenStore } from "../storage/tokens.js";
import { RegistrationStore } from "../storage/registrations.js";

export function registerProjectCommands(program: Command): void {
  const project = program.command("project").description("Manage projects");

  project
    .command("create <name>")
    .description("Create a new project")
    .option("-d, --description <desc>", "Project description")
    .action(async (name: string, options: { description?: string }) => {
      const db = await getApp();
      const store = new ProjectStore(db);
      const id = name.toLowerCase().replace(/\s+/g, "-");
      const p = store.create({ id, name, description: options.description });
      console.log(`✅ Project created: ${p.id} (${p.name})`);
    });

  project
    .command("archive <id>")
    .description("Archive a project, revoke tokens, and mark registrations offline")
    .option(
      "--hard",
      "Also delete all events and registrations (irreversible)"
    )
    .action(async (id: string, options: { hard?: boolean }) => {
      const db = await getApp();
      const projectStore = new ProjectStore(db);

      // 1. Archive the project
      const p = projectStore.archive(id);
      if (!p) {
        console.error(`❌ Project "${id}" not found`);
        process.exit(1);
      }

      // 2. Revoke all tokens
      const tokenStore = new TokenStore(db);
      const revokedTokens = tokenStore.revokeByProject(id);

      // 3. Mark registrations offline
      const regStore = new RegistrationStore(db);
      const takenOffline = regStore.markOfflineByProject(id);

      console.log(`✅ Project "${id}" archived`);
      console.log(`   🔑 Tokens revoked:      ${revokedTokens}`);
      console.log(`   📡 Registrations offline: ${takenOffline}`);

      // 4. Hard mode: delete events and registrations
      if (options.hard) {
        db.run("DELETE FROM events WHERE project_id = ?", [id]);
        db.run("DELETE FROM registrations WHERE project_id = ?", [id]);
        console.log(`   🗑️  Events deleted for project "${id}"`);
        console.log(`   ⚠️  This is irreversible.`);
      }
    });

  project
    .command("list")
    .description("List all projects")
    .action(async () => {
      const db = await getApp();
      const store = new ProjectStore(db);
      const projects = store.list();
      if (projects.length === 0) {
        console.log("No projects found.");
        return;
      }
      for (const p of projects) {
        const status = p.status === "active" ? "🟢" : "🔴";
        console.log(`  ${status} ${p.id.padEnd(20)} ${p.name}`);
      }
    });

  project
    .command("show <id>")
    .description("Show project details with stats")
    .action(async (id: string) => {
      const db = await getApp();
      const projectStore = new ProjectStore(db);
      const p = projectStore.findById(id);
      if (!p) {
        console.error(`❌ Project "${id}" not found`);
        process.exit(1);
      }

      const eventCount = db.exec<{ c: number }>(
        "SELECT COUNT(*) as c FROM events WHERE project_id = ?",
        [id]
      );
      const regCount = db.exec<{ c: number }>(
        "SELECT COUNT(*) as c FROM registrations WHERE project_id = ?",
        [id]
      );
      const tokenCount = db.exec<{ c: number }>(
        "SELECT COUNT(*) as c FROM tokens WHERE project_id = ? AND status = 'active'",
        [id]
      );

      console.log(`  ID:          ${p.id}`);
      console.log(`  Name:        ${p.name}`);
      console.log(`  Description: ${p.description}`);
      console.log(`  Status:      ${p.status}`);
      console.log(`  Registrations: ${regCount[0]?.c ?? 0}`);
      console.log(`  Events:      ${eventCount[0]?.c ?? 0}`);
      console.log(`  Active tokens: ${tokenCount[0]?.c ?? 0}`);
      console.log(`  Created:     ${p.created_at}`);
      console.log(`  Updated:     ${p.updated_at}`);
    });
}
