/**
 * CRUD operations for the registrations table.
 */

import type { Database } from "./database.js";

export interface Registration {
  id: string;
  project_id: string;
  sender: string;
  role: string;
  token_hash: string | null;
  workpath: string;
  giturl: string;
  last_seen: string;
  status: "online" | "offline";
}

export interface RegisterParams {
  project: string;
  sender: string;
  role: string;
  workpath: string;
  giturl: string;
  token_hash?: string;
}

export class RegistrationStore {
  constructor(private db: Database) {}

  /**
   * Register or re-register an agent.
   * Idempotent: same (project_id, sender) updates last_seen + workpath + giturl.
   * Different agent with same sender → returns null (caller should throw SENDER_CONFLICT).
   */
  register(params: RegisterParams): Registration | null {
    // Check if sender is occupied by a DIFFERENT registration_id
    const existing = this.db.exec<Registration>(
      "SELECT * FROM registrations WHERE project_id = ? AND sender = ?",
      [params.project, params.sender]
    );

    if (existing.length > 0) {
      // Same sender exists — this is a re-registration by the same agent
      const rows = this.db.exec<Registration>(
        `UPDATE registrations
         SET last_seen = datetime('now'), workpath = ?, giturl = ?, status = 'online'
         WHERE project_id = ? AND sender = ?
         RETURNING *`,
        [params.workpath, params.giturl, params.project, params.sender]
      );
      return rows[0] ?? null;
    }

    // New registration
    const rows = this.db.exec<Registration>(
      `INSERT INTO registrations (id, project_id, sender, role, token_hash, workpath, giturl)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        crypto.randomUUID(),
        params.project,
        params.sender,
        params.role,
        params.token_hash ?? null,
        params.workpath,
        params.giturl,
      ]
    );
    return rows[0] ?? null;
  }

  list(projectId?: string): Registration[] {
    if (projectId) {
      return this.db.exec<Registration>(
        "SELECT * FROM registrations WHERE project_id = ? ORDER BY last_seen DESC",
        [projectId]
      );
    }
    return this.db.exec<Registration>(
      "SELECT * FROM registrations ORDER BY last_seen DESC"
    );
  }

  markOfflineByProject(projectId: string): number {
    const result = this.db.exec<{ count: number }>(
      `UPDATE registrations SET status = 'offline'
       WHERE project_id = ? AND status = 'online'
       RETURNING COUNT(*) as count`,
      [projectId]
    );
    return result[0]?.count ?? 0;
  }

  markOnlineByProject(projectId: string): number {
    const result = this.db.exec<{ count: number }>(
      `UPDATE registrations SET status = 'online', last_seen = datetime('now')
       WHERE project_id = ? AND status = 'offline'
       RETURNING COUNT(*) as count`,
      [projectId]
    );
    return result[0]?.count ?? 0;
  }

  markOffline(timeoutSeconds: number = 3600): number {
    const result = this.db.exec<{ count: number }>(
      `UPDATE registrations SET status = 'offline'
       WHERE status = 'online' AND
             datetime(last_seen) < datetime('now', '-' || ? || ' seconds')
       RETURNING COUNT(*) as count`,
      [timeoutSeconds]
    );
    return result[0]?.count ?? 0;
  }
}
