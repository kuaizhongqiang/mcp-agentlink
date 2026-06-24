/**
 * Auth middleware — token verification and project/role resolution.
 *
 * Used by MCP tool handlers and CLI commands to authenticate requests.
 */

import { createHash } from "node:crypto";
import type { Database } from "../storage/database.js";

export interface AuthUser {
  projectId: string;
  role: string;
}

/**
 * Verify a raw token against the stored SHA-256 hash.
 * Returns the token's user context (projectId, role) or null if invalid.
 */
export function verifyToken(db: Database, rawToken: string): AuthUser | null {
  const hash = createHash("sha256").update(rawToken).digest("hex");
  const tokens = db.exec<{
    project_id: string;
    role: string;
    status: string;
  }>("SELECT * FROM tokens WHERE token_hash = ? AND status = 'active'", [
    hash,
  ]);
  if (tokens.length === 0) return null;
  return { projectId: tokens[0].project_id, role: tokens[0].role };
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
