/**
 * CRUD operations for the charters table.
 */

import type { Database } from "./database.js";

export interface Charter {
  project_id: string;
  content: string;
  guid: string;
  published_by: string;
  published_at: string;
  updated_at: string;
}

export interface PublishCharterParams {
  project: string;
  content: string;
  published_by: string;
}

export class CharterStore {
  constructor(private db: Database) {}

  /**
   * Publish or update a charter for a project (UPSERT).
   * Each publish generates a new GUID for change tracking.
   */
  publish(params: PublishCharterParams): Charter {
    const guid = crypto.randomUUID();
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const rows = this.db.exec<Charter>(
      `INSERT INTO charters (project_id, content, guid, published_by, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         content = excluded.content,
         guid = excluded.guid,
         published_by = excluded.published_by,
         updated_at = excluded.updated_at
       RETURNING *`,
      [params.project, params.content, guid, params.published_by, now, now]
    );
    return rows[0];
  }

  /**
   * Get charter by project ID.
   */
  getByProject(projectId: string): Charter | undefined {
    const rows = this.db.exec<Charter>(
      "SELECT * FROM charters WHERE project_id = ?",
      [projectId]
    );
    return rows[0];
  }
}
