/**
 * Aggregated server status — project stats, registration count, event count.
 * Version is set dynamically from package.json by the CLI on startup.
 */

import type { Database } from "../storage/database.js";

export interface ServerStatus {
  version: string;
  uptime: string;
  projects: number;
  registrations: number;
  registrationsOnline: number;
  events: number;
  tokensActive: number;
}

let _version = "0.0.0"; // Fallback until setVersion() is called

/**
 * Set the version string (called by CLI on startup from package.json).
 */
export function setVersion(v: string): void {
  _version = v;
}

export function getServerStatus(db: Database): ServerStatus {
  const projectCount = db.exec<{ c: number }>("SELECT COUNT(*) as c FROM projects");
  const regCount = db.exec<{ c: number }>("SELECT COUNT(*) as c FROM registrations");
  const onlineCount = db.exec<{ c: number }>(
    "SELECT COUNT(*) as c FROM registrations WHERE status = 'online'"
  );
  const eventCount = db.exec<{ c: number }>("SELECT COUNT(*) as c FROM events");
  const tokenCount = db.exec<{ c: number }>(
    "SELECT COUNT(*) as c FROM tokens WHERE status = 'active'"
  );

  return {
    version: _version,
    uptime: new Date().toISOString(),
    projects: projectCount[0]?.c ?? 0,
    registrations: regCount[0]?.c ?? 0,
    registrationsOnline: onlineCount[0]?.c ?? 0,
    events: eventCount[0]?.c ?? 0,
    tokensActive: tokenCount[0]?.c ?? 0,
  };
}
