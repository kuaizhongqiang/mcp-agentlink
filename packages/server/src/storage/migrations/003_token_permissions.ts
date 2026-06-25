/**
 * 003_token_permissions.sql — add permissions column to tokens table
 */
export const migrationName = "003_token_permissions.sql";

export const migrationSql = `
ALTER TABLE tokens ADD COLUMN permissions TEXT NOT NULL DEFAULT 'write'
  CHECK(permissions IN ('read', 'write', 'admin'));
`;
