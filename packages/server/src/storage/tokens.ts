/**
 * CRUD operations for the tokens table.
 */

import { createHash, randomBytes } from "node:crypto";
import type { Database } from "./database.js";

export interface Token {
  id: string;
  project_id: string;
  role: string;
  token_hash: string;
  status: "active" | "revoked";
  permissions: "read" | "write" | "admin";
  created_at: string;
}

export interface TokenGenerationResult {
  token: string;        // The raw token (shown once to the admin)
  tokenData: Token;     // The stored record
}

export type Permission = "read" | "write" | "admin";

/**
 * Check if a permission level has access to a required level.
 * Hierarchy: read < write < admin
 */
export function hasPermission(
  tokenPerm: Permission,
  required: Permission
): boolean {
  const hierarchy: Record<Permission, number> = {
    read: 1,
    write: 2,
    admin: 3,
  };
  return hierarchy[tokenPerm] >= hierarchy[required];
}

export class TokenStore {
  constructor(private db: Database) {}

  /**
   * Generate a new token: 64-char hex string, stored as SHA-256 hash.
   */
  generate(
    projectId: string,
    role: string,
    permissions: Permission = "write",
    tokenId?: string
  ): TokenGenerationResult {
    const raw = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(raw).digest("hex");

    const tokens = this.db.exec<Token>(
      `INSERT INTO tokens (id, project_id, role, token_hash, permissions)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
      [tokenId ?? crypto.randomUUID(), projectId, role, hash, permissions]
    );

    return { token: raw, tokenData: tokens[0] };
  }

  /**
   * Verify a raw token against the stored hash.
   * Returns the token record if valid, null otherwise.
   */
  verify(rawToken: string): Token | undefined {
    const hash = createHash("sha256").update(rawToken).digest("hex");
    const tokens = this.db.exec<Token>(
      "SELECT * FROM tokens WHERE token_hash = ? AND status = 'active'",
      [hash]
    );
    return tokens[0];
  }

  revoke(tokenOrHash: string): Token | undefined {
    // Accept both raw token or hash — try hash first, then sha256(raw)
    let tokens = this.db.exec<Token>(
      "UPDATE tokens SET status = 'revoked' WHERE token_hash = ? RETURNING *",
      [tokenOrHash]
    );
    if (tokens.length === 0) {
      const hash = createHash("sha256").update(tokenOrHash).digest("hex");
      tokens = this.db.exec<Token>(
        "UPDATE tokens SET status = 'revoked' WHERE token_hash = ? RETURNING *",
        [hash]
      );
    }
    return tokens[0];
  }

  list(projectId: string): Token[] {
    return this.db.exec<Token>(
      "SELECT * FROM tokens WHERE project_id = ? ORDER BY created_at DESC",
      [projectId]
    );
  }

  revokeByProject(projectId: string): number {
    const result = this.db.exec<{ count: number }>(
      `UPDATE tokens SET status = 'revoked'
       WHERE project_id = ? AND status = 'active'
       RETURNING COUNT(*) as count`,
      [projectId]
    );
    return result[0]?.count ?? 0;
  }

  restoreByProject(projectId: string): number {
    const result = this.db.exec<{ count: number }>(
      `UPDATE tokens SET status = 'active'
       WHERE project_id = ? AND status = 'revoked'
       RETURNING COUNT(*) as count`,
      [projectId]
    );
    return result[0]?.count ?? 0;
  }
}
