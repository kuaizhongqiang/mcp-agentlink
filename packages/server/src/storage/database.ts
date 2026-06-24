/**
 * Database abstraction over sql.js.
 *
 * Provides a simple synchronous-like API by wrapping sql.js async init.
 * Supports loading from and saving to a file path for persistence.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import initSqlJs, {
  type SqlJsStatic,
  type Database as SqlJsDatabase,
  type SqlValue,
} from "sql.js";

let SQL: SqlJsStatic | null = null;

type Params = SqlValue[];

/**
 * Thin wrapper around sql.js Database that adds parameter binding
 * convenience and typed result helpers.
 */
export class Database {
  private db: SqlJsDatabase;
  private filePath?: string;

  constructor(db: SqlJsDatabase, filePath?: string) {
    this.db = db;
    this.filePath = filePath;
  }

  /**
   * Execute a SQL statement with optional positional params (`?`).
   * For SELECT / RETURNING queries, returns the result rows as objects.
   * For other statements, returns an empty array.
   */
  exec<T = Record<string, SqlValue>>(sql: string, params?: Params): T[] {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    }

    const resultSets = this.db.exec(sql);
    if (resultSets.length === 0) return [];
    return resultSets.flatMap((rs) =>
      rs.values.map((row) => {
        const obj: Record<string, SqlValue> = {};
        rs.columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj as T;
      })
    );
  }

  /**
   * Run a statement (INSERT/UPDATE/DELETE/CREATE) with optional params.
   */
  run(sql: string, params?: Params): void {
    this.exec(sql, params);
  }

  /**
   * Export the database as a Uint8Array (for saving to disk).
   */
  export(): Uint8Array {
    return this.db.export();
  }

  /**
   * Persist the database to its file path (if one was provided).
   */
  save(): void {
    if (!this.filePath) return;
    writeFileSync(this.filePath, this.export());
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Initialize the storage engine.
 * Loads sql.js WASM — call once at startup.
 *
 * @param filePath Optional path to persist the database file.
 *   If the file exists, it's loaded. If not, an empty DB is created.
 */
export async function createDatabase(filePath?: string): Promise<Database> {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  let raw: SqlJsDatabase;
  if (filePath && existsSync(filePath)) {
    const buffer = readFileSync(filePath);
    raw = new SQL.Database(buffer);
  } else {
    raw = new SQL.Database();
  }

  return new Database(raw, filePath);
}
