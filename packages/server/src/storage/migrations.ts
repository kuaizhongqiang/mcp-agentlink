/**
 * Migration runner — applies migration files in order.
 *
 * Migrations are embedded TypeScript modules to avoid needing a
 * separate build step for .sql files.
 */

import type { Database } from "./database.js";

interface MigrationModule {
  migrationName: string;
  migrationSql: string;
}

/**
 * Returns the list of already-applied migration names.
 */
function getApplied(db: Database): Set<string> {
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const rows = db.exec<{ name: string }>(
    "SELECT name FROM _migrations ORDER BY name"
  );
  return new Set(rows.map((r) => r.name));
}

/**
 * Run all pending migrations.
 */
export async function migrate(db: Database): Promise<string[]> {
  const applied = getApplied(db);

  // Import migrations in dependency order
  const modules: MigrationModule[] = [
    await import("./migrations/001_initial.js"),
    await import("./migrations/002_file_links.js"),
    await import("./migrations/003_token_permissions.js"),
    await import("./migrations/004_performance_indexes.js"),
    await import("./migrations/005_closed_and_charters.js"),
  ];

  const executed: string[] = [];

  for (const mod of modules) {
    if (applied.has(mod.migrationName)) continue;
    db.run(mod.migrationSql);
    db.run("INSERT INTO _migrations (name) VALUES (?)", [mod.migrationName]);
    executed.push(mod.migrationName);
  }

  return executed;
}
