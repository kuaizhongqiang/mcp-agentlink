/**
 * 005_closed_and_charters.sql — adds 'closed' to project status + charters table
 *
 * This migration:
 * 1. Rebuilds the projects table to include 'closed' in the status CHECK constraint
 * 2. Creates the charters table for the Charter system
 */
export const migrationName = "005_closed_and_charters.sql";

export const migrationSql = `
-- Step 1: Rebuild projects table with 'closed' in status CHECK
CREATE TABLE IF NOT EXISTS projects_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO projects_v2 (id, name, description, status, created_at, updated_at)
  SELECT id, name, description, status, created_at, updated_at FROM projects;

DROP TABLE projects;
ALTER TABLE projects_v2 RENAME TO projects;

-- Step 2: Create charters table
CREATE TABLE IF NOT EXISTS charters (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  content TEXT NOT NULL,
  guid TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
