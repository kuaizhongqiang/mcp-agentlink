/**
 * Auth middleware — token verification and role/permission resolution.
 *
 * Used by MCP tool handlers and CLI commands to authenticate requests.
 */

import { createHash } from "node:crypto";
import type { Database } from "../storage/database.js";
import type { Permission } from "../storage/tokens.js";
import { hasPermission } from "../storage/tokens.js";

export interface AuthUser {
  projectId: string;
  role: string;
  permissions: Permission;
}

/**
 * Verify a raw token against the stored SHA-256 hash.
 * Returns the token's user context (projectId, role, permissions) or null if invalid.
 */
export function verifyToken(db: Database, rawToken: string): AuthUser | null {
  const hash = createHash("sha256").update(rawToken).digest("hex");
  const tokens = db.exec<{
    project_id: string;
    role: string;
    status: string;
    permissions: string;
  }>("SELECT * FROM tokens WHERE token_hash = ? AND status = 'active'", [
    hash,
  ]);
  if (tokens.length === 0) return null;
  const t = tokens[0];
  return {
    projectId: t.project_id,
    role: t.role,
    permissions: (t.permissions as Permission) ?? "write",
  };
}

/**
 * Assert that a user's token is authorized for a given project.
 * Throws with an error code string on failure (for MCP error responses).
 */
export function assertProjectAccess(
  user: AuthUser | null,
  projectId: string
): void {
  if (!user) throw new Error("INVALID_TOKEN");
  if (user.projectId !== projectId) throw new Error("UNAUTHORIZED_SCOPE");
}

/**
 * Assert that a user has the required permission level.
 * Throws with PERMISSION_DENIED on failure.
 */
export function assertPermission(
  user: AuthUser | null,
  required: Permission
): void {
  if (!user) throw new Error("INVALID_TOKEN");
  if (!hasPermission(user.permissions, required)) {
    throw new Error("PERMISSION_DENIED");
  }
}
