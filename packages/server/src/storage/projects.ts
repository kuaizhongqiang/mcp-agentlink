/**
 * CRUD operations for the projects table.
 */

import type { Database } from "./database.js";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived" | "closed";
  created_at: string;
  updated_at: string;
}

export interface CreateProjectParams {
  id: string;
  name: string;
  description?: string;
}

export class ProjectStore {
  constructor(private db: Database) {}

  create(params: CreateProjectParams): Project {
    const projects = this.db.exec<Project>(
      `INSERT INTO projects (id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`,
      [params.id, params.name, params.description ?? ""]
    );
    return projects[0];
  }

  findById(id: string): Project | undefined {
    const projects = this.db.exec<Project>(
      "SELECT * FROM projects WHERE id = ?",
      [id]
    );
    return projects[0];
  }

  list(): Project[] {
    return this.db.exec<Project>(
      "SELECT * FROM projects ORDER BY created_at DESC"
    );
  }

  archive(id: string): Project | undefined {
    const projects = this.db.exec<Project>(
      `UPDATE projects SET status = 'archived', updated_at = datetime('now')
       WHERE id = ? RETURNING *`,
      [id]
    );
    return projects[0];
  }

  unarchive(id: string): Project | undefined {
    const projects = this.db.exec<Project>(
      `UPDATE projects SET status = 'active', updated_at = datetime('now')
       WHERE id = ? AND status = 'archived' RETURNING *`,
      [id]
    );
    return projects[0];
  }

  close(id: string): Project | undefined {
    const projects = this.db.exec<Project>(
      `UPDATE projects SET status = 'closed', updated_at = datetime('now')
       WHERE id = ? AND status = 'active' RETURNING *`,
      [id]
    );
    return projects[0];
  }

  isClosed(id: string): boolean {
    const rows = this.db.exec<{ status: string }>(
      "SELECT status FROM projects WHERE id = ?",
      [id]
    );
    return rows.length > 0 && rows[0].status === "closed";
  }
}
