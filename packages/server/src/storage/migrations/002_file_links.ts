export const migrationName = "002_file_links.sql";
export const migrationSql = `
CREATE TABLE IF NOT EXISTS file_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  source_repo TEXT NOT NULL,
  source_path TEXT NOT NULL,
  target_repo TEXT NOT NULL,
  target_path TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_file_links_project ON file_links(project_id);
CREATE INDEX IF NOT EXISTS idx_file_links_source ON file_links(source_repo, source_path);
CREATE INDEX IF NOT EXISTS idx_file_links_target ON file_links(target_repo, target_path);
`;
