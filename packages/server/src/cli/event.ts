/**
 * mcp-agentlink event list | count | purge
 */

import type { Command } from "commander";
import type { SqlValue } from "sql.js";
import { getApp } from "../app/index.js";
import { EventStore } from "../storage/events.js";

export function registerEventCommands(program: Command): void {
  const event = program.command("event").description("Manage events");

  event
    .command("list")
    .description("List events")
    .requiredOption("--project <id>", "Project ID")
    .option("--scope <scope>", "Filter by scope (role name or '*')")
    .option("--type <type>", "Filter by event type")
    .option("--limit <count>", "Limit results", "50")
    .action(
      async (options: {
        project: string;
        scope?: string;
        type?: string;
        limit?: string;
      }) => {
        const db = await getApp();
        const store = new EventStore(db);
        const events = store.query({
          project: options.project,
          scope: options.scope,
          type: options.type,
          limit: parseInt(options.limit ?? "50", 10),
        });
        if (events.length === 0) {
          console.log("No events found.");
          return;
        }
        for (const e of events) {
          console.log(
            `  [${e.type.padEnd(10)}] ${e.summary.padEnd(50)} ${e.sender} @ ${e.timestamp}`
          );
        }
      }
    );

  event
    .command("count")
    .description("Count events per project")
    .option("--project <id>", "Filter by project")
    .action(async (options: { project?: string }) => {
      const db = await getApp();
      if (options.project) {
        const row = db.exec<{ c: number }>(
          "SELECT COUNT(*) as c FROM events WHERE project_id = ?",
          [options.project]
        );
        console.log(`  Events for "${options.project}": ${row[0]?.c ?? 0}`);
      } else {
        const rows = db.exec<{ project_id: string; c: number }>(
          "SELECT project_id, COUNT(*) as c FROM events GROUP BY project_id ORDER BY c DESC"
        );
        if (rows.length === 0) {
          console.log("No events found.");
          return;
        }
        for (const r of rows) {
          console.log(`  ${r.project_id.padEnd(20)} ${r.c} events`);
        }
      }
    });

  event
    .command("stats")
    .description("Show event statistics for a project")
    .requiredOption("--project <id>", "Project ID")
    .action(async (options: { project: string }) => {
      const db = await getApp();
      const store = new EventStore(db);
      const stats = store.getStats(options.project);

      console.log(`📊 Event Statistics for "${options.project}"`);
      console.log(`   Total events:  ${stats.total}`);
      console.log("");
      console.log(`   By type:`);
      for (const [type, count] of Object.entries(stats.byType)) {
        console.log(`     ${type.padEnd(12)} ${count}`);
      }
      console.log("");
      console.log(`   By scope:`);
      for (const [scope, count] of Object.entries(stats.byScope)) {
        console.log(`     ${scope.padEnd(12)} ${count}`);
      }
      console.log("");
      console.log(`   Monthly (last 12):`);
      for (const m of stats.monthly) {
        console.log(`     ${m.month.padEnd(10)} ${m.count}`);
      }
    });

  event
    .command("purge")
    .description("Delete events for a project")
    .requiredOption("--project <id>", "Project ID")
    .option(
      "--before <date>",
      "Delete events before this date (ISO format, e.g. 2026-01-01)"
    )
    .option("--type <type>", "Delete only events of this type")
    .option("--all", "Purge ALL events for the project (ignores --before and --type)")
    .option("--dry-run", "Show what would be deleted without executing")
    .option("--force", "Skip confirmation prompt")
    .action(
      async (options: {
        project: string;
        before?: string;
        type?: string;
        all?: boolean;
        dryRun?: boolean;
        force?: boolean;
      }) => {
        const db = await getApp();

        const conditions: string[] = ["project_id = ?"];
        const bindings: SqlValue[] = [options.project];

        if (options.all) {
          // Purge all — no additional filters
        } else {
          if (options.before) {
            conditions.push("timestamp < ?");
            bindings.push(options.before);
          }
          if (options.type) {
            conditions.push("type = ?");
            bindings.push(options.type);
          }
        }

        // Count first
        const countRow = db.exec<{ c: number }>(
          `SELECT COUNT(*) as c FROM events WHERE ${conditions.join(" AND ")}`,
          bindings
        );
        const count = countRow[0]?.c ?? 0;

        if (count === 0) {
          console.log("No matching events to purge.");
          return;
        }

        const filters = options.all
          ? "ALL events"
          : [
              options.before ? `before ${options.before}` : "",
              options.type ? `type=${options.type}` : "",
            ]
              .filter(Boolean)
              .join(", ");

        // Dry-run: show count and exit
        if (options.dryRun) {
          console.log(`📋 Dry-run: ${count} events would be deleted from "${options.project}"${filters ? ` (${filters})` : ""}`);
          console.log(`   Add --force to execute.`);
          return;
        }

        // Confirmation prompt (skip with --force)
        if (!options.force) {
          console.log(`⚠️  About to delete ${count} events from "${options.project}"${filters ? ` (${filters})` : ""}`);
          console.log(`   Use --force to confirm.`);
          return;
        }

        db.run(
          `DELETE FROM events WHERE ${conditions.join(" AND ")}`,
          bindings
        );

        console.log(`   ✅ ${count} events purged from "${options.project}"`);
      }
    );
}
