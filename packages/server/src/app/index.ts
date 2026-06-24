/**
 * Application bootstrap.
 * Initializes a file-backed database and provides it to CLI/MCP handlers.
 */

import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createDatabase, migrate, type Database } from "../storage/index.js";

let _db: Database | null = null;

/** Default database path: ~/.mcp-agentlink/data.db */
function defaultDbPath(): string {
  const dir = join(homedir(), ".mcp-agentlink");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, "data.db");
}

/**
 * Get or initialize the application database.
 * Uses a file-backed sql.js database at ~/.mcp-agentlink/data.db.
 * Override with MCP_AGENTLINK_DB_PATH env var.
 */
export async function getApp(): Promise<Database> {
  if (_db) return _db;
  const dbPath = process.env.MCP_AGENTLINK_DB_PATH ?? defaultDbPath();
  _db = await createDatabase(dbPath);
  const executed = await migrate(_db);
  if (executed.length > 0) {
    console.error(`[mcp-agentlink] Applied migrations: ${executed.join(", ")}`);
  }
  return _db;
}

/**
 * Close and save the database connection.
 */
export function closeApp(): void {
  if (_db) {
    _db.save();
    _db.close();
  }
  _db = null;
}
