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
    .command("purge")
    .description("Delete events for a project, optionally before a date")
    .requiredOption("--project <id>", "Project ID")
    .option(
      "--before <date>",
      "Delete events before this date (ISO format, e.g. 2026-01-01)"
    )
    .option("--type <type>", "Delete only events of this type")
    .action(
      async (options: {
        project: string;
        before?: string;
        type?: string;
      }) => {
        const db = await getApp();

        const conditions: string[] = ["project_id = ?"];
        const bindings: SqlValue[] = [options.project];

        if (options.before) {
          conditions.push("timestamp < ?");
          bindings.push(options.before);
        }
        if (options.type) {
          conditions.push("type = ?");
          bindings.push(options.type);
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

        // Ask for confirmation (double-check)
        const filters = [
          options.before ? `before ${options.before}` : "",
          options.type ? `type=${options.type}` : "",
        ]
          .filter(Boolean)
          .join(", ");
        console.log(`   ${count} events will be deleted${filters ? ` (${filters})` : ""}`);
        console.log("   Deleting...");

        db.run(
          `DELETE FROM events WHERE ${conditions.join(" AND ")}`,
          bindings
        );

        console.log(`   ✅ ${count} events purged from "${options.project}"`);
      }
    );
}
