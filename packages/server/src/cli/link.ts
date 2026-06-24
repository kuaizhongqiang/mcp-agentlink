/**
 * mcp-agentlink link create | list | find | delete
 */

import type { Command } from "commander";
import type { SqlValue } from "sql.js";
import { getApp } from "../app/index.js";
import { FileLinkStore } from "../storage/fileLinks.js";

export function registerLinkCommands(program: Command): void {
  const link = program.command("link").description("Manage file links between repos");

  link
    .command("create")
    .description("Create a file link between two repos")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--source-repo <repo>", "Source repository identifier")
    .requiredOption("--source-path <path>", "Source file path")
    .requiredOption("--target-repo <repo>", "Target repository identifier")
    .requiredOption("--target-path <path>", "Target file path")
    .option("-d, --description <text>", "Link description")
    .action(
      async (options: {
        project: string;
        sourceRepo: string;
        sourcePath: string;
        targetRepo: string;
        targetPath: string;
        description?: string;
      }) => {
        const db = await getApp();
        const store = new FileLinkStore(db);
        const fl = store.create({
          project: options.project,
          sourceRepo: options.sourceRepo,
          sourcePath: options.sourcePath,
          targetRepo: options.targetRepo,
          targetPath: options.targetPath,
          description: options.description,
        });
        console.log(`✅ File link created: ${fl.id}`);
        console.log(`   ${fl.source_repo}:${fl.source_path} ↔ ${fl.target_repo}:${fl.target_path}`);
      }
    );

  link
    .command("list")
    .description("List file links for a project")
    .requiredOption("--project <id>", "Project ID")
    .action(async (options: { project: string }) => {
      const db = await getApp();
      const store = new FileLinkStore(db);
      const links = store.list(options.project);
      if (links.length === 0) {
        console.log("No file links found.");
        return;
      }
      for (const l of links) {
        console.log(`  ${l.id.substring(0, 8)}  ${l.source_repo}:${l.source_path}`);
        console.log(`       ↔ ${l.target_repo}:${l.target_path}`);
        if (l.description) console.log(`       "${l.description}"`);
        console.log();
      }
    });

  link
    .command("find")
    .description("Find file links by source or target path")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--repo <repo>", "Repository identifier")
    .requiredOption("--path <path>", "File path to search for")
    .action(
      async (options: { project: string; repo: string; path: string }) => {
        const db = await getApp();
        const store = new FileLinkStore(db);

        const sourceMatches = store.findBySource(
          options.project,
          options.repo,
          options.path
        );
        const targetMatches = store.findByTarget(
          options.project,
          options.repo,
          options.path
        );

        if (sourceMatches.length === 0 && targetMatches.length === 0) {
          console.log("No file links found.");
          return;
        }

        for (const l of sourceMatches) {
          console.log(`  ${l.source_repo}:${l.source_path}`);
          console.log(`    → ${l.target_repo}:${l.target_path}`);
        }
        for (const l of targetMatches) {
          console.log(`  ${l.source_repo}:${l.source_path}`);
          console.log(`    → ${l.target_repo}:${l.target_path} (via reverse match)`);
        }
      }
    );

  link
    .command("delete")
    .description("Delete a file link")
    .requiredOption("--id <id>", "Link ID to delete")
    .action(async (options: { id: string }) => {
      const db = await getApp();
      const store = new FileLinkStore(db);
      if (store.delete(options.id)) {
        console.log(`✅ File link deleted: ${options.id}`);
      } else {
        console.error(`❌ File link not found: ${options.id}`);
        process.exit(1);
      }
    });
}
