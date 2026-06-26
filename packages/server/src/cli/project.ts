/**
 * mcp-agentlink project create | archive | unarchive | list | show
 */

import type { Command } from "commander";
import { getApp } from "../app/index.js";
import { ProjectStore } from "../storage/projects.js";
import { TokenStore } from "../storage/tokens.js";
import { RegistrationStore } from "../storage/registrations.js";
import { FileLinkStore } from "../storage/fileLinks.js";

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
    .option("--dry-run", "Show what would be archived without executing")
    .option("--force", "Skip confirmation prompt")
    .option(
      "--hard",
      "Also delete all events, registrations, and file links (irreversible)"
    )
    .action(
      async (
        id: string,
        options: { dryRun?: boolean; force?: boolean; hard?: boolean }
      ) => {
        const db = await getApp();
        const projectStore = new ProjectStore(db);

        const p = projectStore.findById(id);
        if (!p) {
          console.error(`❌ Project "${id}" not found`);
          process.exit(1);
        }

        const tokenStore = new TokenStore(db);
        const regStore = new RegistrationStore(db);
        const linkStore = new FileLinkStore(db);

        const activeTokens = db.exec<{ c: number }>(
          "SELECT COUNT(*) as c FROM tokens WHERE project_id = ? AND status = 'active'",
          [id]
        )[0]?.c ?? 0;
        const onlineRegs = db.exec<{ c: number }>(
          "SELECT COUNT(*) as c FROM registrations WHERE project_id = ? AND status = 'online'",
          [id]
        )[0]?.c ?? 0;
        const eventCount = db.exec<{ c: number }>(
          "SELECT COUNT(*) as c FROM events WHERE project_id = ?",
          [id]
        )[0]?.c ?? 0;
        const linkCount = db.exec<{ c: number }>(
          "SELECT COUNT(*) as c FROM file_links WHERE project_id = ?",
          [id]
        )[0]?.c ?? 0;

        // Dry-run: show what would happen
        if (options.dryRun) {
          console.log(`📋 Dry-run: archive "${id}" (${p.name})`);
          console.log(`   🔑 Active tokens:    ${activeTokens} → revoked`);
          console.log(`   📡 Online registrations: ${onlineRegs} → offline`);
          if (options.hard) {
            console.log(`   🗑️  Events:           ${eventCount} → deleted`);
            console.log(`   🔗 File links:       ${linkCount} → deleted`);
          }
          console.log(`\n   Add --force to execute.`);
          return;
        }

        // Confirmation prompt (skip with --force)
        if (!options.force) {
          console.log(`⚠️  About to archive project "${id}" (${p.name}):`);
          console.log(`   Tokens: ${activeTokens} will be revoked`);
          if (options.hard) {
            console.log(`   This will PERMANENTLY delete ${eventCount} events and ${linkCount} file links.`);
          }
          console.log(`   Use --force to skip this prompt.`);
          return;
        }

        // 1. Archive the project
        const archived = projectStore.archive(id);
        if (!archived) {
          console.error(`❌ Project "${id}" not found`);
          process.exit(1);
        }

        // 2. Revoke all tokens
        const revokedTokens = tokenStore.revokeByProject(id);

        // 3. Mark registrations offline
        const takenOffline = regStore.markOfflineByProject(id);

        console.log(`✅ Project "${id}" archived`);
        console.log(`   🔑 Tokens revoked:      ${revokedTokens}`);
        console.log(`   📡 Registrations offline: ${takenOffline}`);

        // 4. Hard mode: delete events, registrations, and file links
        if (options.hard) {
          db.run("DELETE FROM events WHERE project_id = ?", [id]);
          db.run("DELETE FROM registrations WHERE project_id = ?", [id]);
          const deletedLinks = linkStore.deleteByProject(id);
          console.log(`   🗑️  Events deleted:      ${eventCount}`);
          console.log(`   🔗 File links deleted:  ${deletedLinks}`);
          console.log(`   ⚠️  This is irreversible.`);
        }
      }
    );

  project
    .command("unarchive <id>")
    .description("Restore an archived project to active status")
    .option("--force", "Skip confirmation prompt")
    .action(async (id: string, options: { force?: boolean }) => {
      const db = await getApp();
      const projectStore = new ProjectStore(db);

      const p = projectStore.findById(id);
      if (!p) {
        console.error(`❌ Project "${id}" not found`);
        process.exit(1);
      }
      if (p.status === "active") {
        console.log(`ℹ️  Project "${id}" is already active.`);
        return;
      }

      if (!options.force) {
        console.log(`⚠️  About to unarchive project "${id}" (${p.name}):`);
        console.log(`   Tokens will be restored, registrations marked online.`);
        console.log(`   Use --force to skip this prompt.`);
        return;
      }

      // 1. Unarchive the project
      const restored = projectStore.unarchive(id);
      if (!restored) {
        console.error(`❌ Failed to unarchive "${id}"`);
        process.exit(1);
      }

      // 2. Restore tokens
      const tokenStore = new TokenStore(db);
      const restoredTokens = tokenStore.restoreByProject(id);

      // 3. Mark registrations online
      const regStore = new RegistrationStore(db);
      const onlineRegs = regStore.markOnlineByProject(id);

      console.log(`✅ Project "${id}" unarchived and restored`);
      console.log(`   🔑 Tokens restored:     ${restoredTokens}`);
      console.log(`   📡 Registrations online:  ${onlineRegs}`);
    });

  project
    .command("close <id>")
    .description("Close a project — prevents new events and registrations")
    .option("--force", "Skip confirmation prompt")
    .action(async (id: string, options: { force?: boolean }) => {
      const db = await getApp();
      const projectStore = new ProjectStore(db);

      const p = projectStore.findById(id);
      if (!p) {
        console.error(`❌ Project "${id}" not found`);
        process.exit(1);
      }
      if (p.status === "closed") {
        console.log(`ℹ️  Project "${id}" is already closed.`);
        return;
      }
      if (p.status !== "active") {
        console.error(`❌ Project "${id}" is ${p.status}. Only active projects can be closed.`);
        process.exit(1);
      }

      if (!options.force) {
        console.log(`⚠️  About to close project "${id}" (${p.name}):`);
        console.log(`   This will prevent new events and registrations.`);
        console.log(`   Use --force to skip this prompt.`);
        return;
      }

      const closed = projectStore.close(id);
      if (!closed) {
        console.error(`❌ Failed to close project "${id}"`);
        process.exit(1);
      }

      console.log(`✅ Project "${id}" closed. No new events will be accepted.`);
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
        const statusIcon = p.status === "active" ? "🟢" : p.status === "closed" ? "⏹" : "🔴";
        console.log(`  ${statusIcon} ${p.id.padEnd(20)} ${p.name.padEnd(30)} ${p.status}`);
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
      const linkCount = db.exec<{ c: number }>(
        "SELECT COUNT(*) as c FROM file_links WHERE project_id = ?",
        [id]
      );

      console.log(`  ID:          ${p.id}`);
      console.log(`  Name:        ${p.name}`);
      console.log(`  Description: ${p.description}`);
      console.log(`  Status:      ${p.status}`);
      console.log(`  Registrations: ${regCount[0]?.c ?? 0}`);
      console.log(`  Events:      ${eventCount[0]?.c ?? 0}`);
      console.log(`  Active tokens: ${tokenCount[0]?.c ?? 0}`);
      console.log(`  File links:  ${linkCount[0]?.c ?? 0}`);
      console.log(`  Created:     ${p.created_at}`);
      console.log(`  Updated:     ${p.updated_at}`);
    });
}
