/**
 * Storage layer index — re-exports the Database class and migration runner.
 */

export { Database, createDatabase } from "./database.js";
export { migrate } from "./migrations.js";
