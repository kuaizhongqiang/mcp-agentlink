/**
 * Database abstraction over sql.js.
 *
 * Provides a simple synchronous-like API by wrapping sql.js async init.
 * Supports loading from and saving to a file path for persistence.
 * All SQL operations include SQLITE_BUSY retry with exponential backoff.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import initSqlJs, {
  type SqlJsStatic,
  type Database as SqlJsDatabase,
  type SqlValue,
} from "sql.js";

let SQL: SqlJsStatic | null = null;

type Params = SqlValue[];

const BUSY_RETRY_MAX = 3;
const BUSY_RETRY_DELAY_MS = 100;

/**
 * Synchronous retry for SQLITE_BUSY errors.
 * sql.js is synchronous (single-threaded WASM), so we need to busy-wait
 * with exponential backoff when the database file is locked by another process.
 */
function runWithBusyRetry<T>(fn: () => T): T {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= BUSY_RETRY_MAX; attempt++) {
    try {
      return fn();
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      // SQLITE_BUSY error codes: "SQLITE_BUSY" or code 5
      if (!msg.includes("BUSY") && !msg.includes("locked") && !msg.includes("code 5")) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < BUSY_RETRY_MAX) {
        const delay = BUSY_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
      }
    }
  }
  throw lastError!;
}

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
   * Auto-retries up to 3 times on SQLITE_BUSY.
   */
  exec<T = Record<string, SqlValue>>(sql: string, params?: Params): T[] {
    return runWithBusyRetry(() => {
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
    });
  }

  /**
   * Run a statement (INSERT/UPDATE/DELETE/CREATE) with optional params.
   * Auto-retries up to 3 times on SQLITE_BUSY.
   */
  run(sql: string, params?: Params): void {
    runWithBusyRetry(() => {
      if (params && params.length > 0) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
      } else {
        this.db.run(sql);
      }
    });
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
