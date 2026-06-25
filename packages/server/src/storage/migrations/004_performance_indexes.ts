/**
 * 004_performance_indexes.sql — add composite indexes for common query patterns
 */
export const migrationName = "004_performance_indexes.sql";

export const migrationSql = `
-- Events: most queries filter by project_id + timestamp range
CREATE INDEX IF NOT EXISTS idx_events_project_time ON events(project_id, timestamp DESC);

-- Events: scope + type filters for agent queries
CREATE INDEX IF NOT EXISTS idx_events_scope_type ON events(scope, type);

-- Registrations: project_id + role lookups (for auth)
CREATE INDEX IF NOT EXISTS idx_registrations_role ON registrations(role);

-- Tokens: token_hash lookup (for auth) — already covered by unique constraints
-- but add a covering index for status + permissions
CREATE INDEX IF NOT EXISTS idx_tokens_hash_status ON tokens(token_hash, status);
`;
