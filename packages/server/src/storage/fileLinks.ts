/**
 * CRUD operations for the file_links table.
 */

import type { Database } from "./database.js";

export interface FileLink {
  id: string;
  project_id: string;
  source_repo: string;
  source_path: string;
  target_repo: string;
  target_path: string;
  description: string;
  created_at: string;
}

export interface CreateFileLinkParams {
  project: string;
  sourceRepo: string;
  sourcePath: string;
  targetRepo: string;
  targetPath: string;
  description?: string;
}

export class FileLinkStore {
  constructor(private db: Database) {}

  create(params: CreateFileLinkParams): FileLink {
    const rows = this.db.exec<FileLink>(
      `INSERT INTO file_links (id, project_id, source_repo, source_path, target_repo, target_path, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        crypto.randomUUID(),
        params.project,
        params.sourceRepo,
        params.sourcePath,
        params.targetRepo,
        params.targetPath,
        params.description ?? "",
      ]
    );
    return rows[0];
  }

  findBySource(projectId: string, repo: string, path: string): FileLink[] {
    return this.db.exec<FileLink>(
      `SELECT * FROM file_links
       WHERE project_id = ? AND source_repo = ? AND source_path = ?
       ORDER BY created_at DESC`,
      [projectId, repo, path]
    );
  }

  findByTarget(projectId: string, repo: string, path: string): FileLink[] {
    return this.db.exec<FileLink>(
      `SELECT * FROM file_links
       WHERE project_id = ? AND target_repo = ? AND target_path = ?
       ORDER BY created_at DESC`,
      [projectId, repo, path]
    );
  }

  list(projectId: string): FileLink[] {
    return this.db.exec<FileLink>(
      "SELECT * FROM file_links WHERE project_id = ? ORDER BY created_at DESC",
      [projectId]
    );
  }

  delete(id: string): boolean {
    const rows = this.db.exec<FileLink>(
      "DELETE FROM file_links WHERE id = ? RETURNING id",
      [id]
    );
    return rows.length > 0;
  }
}
