/**
 * 001_initial.sql — embedded as a TypeScript string so tsc includes it in dist.
 */
export const migrationName = "001_initial.sql";

export const migrationSql = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  sender TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT,
  workpath TEXT NOT NULL DEFAULT '',
  giturl TEXT NOT NULL DEFAULT '',
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'online' CHECK(status IN ('online', 'offline')),
  UNIQUE(project_id, sender)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL CHECK(type IN ('start', 'finish', 'milestone', 'error', 'assignment')),
  sender TEXT NOT NULL,
  summary TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '*',
  doc_path TEXT DEFAULT NULL,
  doc_script TEXT DEFAULT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registrations_project ON registrations(project_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_scope ON events(scope);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_tokens_project ON tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
`;
