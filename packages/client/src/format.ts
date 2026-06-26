/**
 * CLI formatting utilities — table output, JSON mode, pagination.
 *
 * Used by /agentlink slash commands for human-readable output.
 */

// ── Table formatting ───────────────────────────────────────

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

/**
 * Render a formatted table with aligned columns.
 * Each row must have the same number of cells as columns.
 */
export function formatTable(columns: TableColumn[], rows: string[][]): string {
  if (rows.length === 0) return "(empty)";

  const colCount = columns.length;

  // Build separator line
  const separator = columns
    .map((c) => "─".repeat(c.width))
    .join(" ─ ");

  // Build header row
  const header = columns
    .map((c) => c.header.padEnd(c.width).slice(0, c.width))
    .join(" │ ");

  // Build data rows
  const dataRows = rows.map((row) => {
    const cells = row.slice(0, colCount);
    return columns
      .map((c, i) => {
        const val = cells[i] ?? "";
        return c.align === "right"
          ? val.padStart(c.width).slice(0, c.width)
          : val.padEnd(c.width).slice(0, c.width);
      })
      .join(" │ ");
  });

  return ["┌─ " + separator + " ─┐", "│ " + header + " │", "├─ " + separator + " ─┤", ...dataRows.map((r) => "│ " + r + " │"), "└─ " + separator + " ─┘"].join("\n");
}

// ── JSON output ────────────────────────────────────────────

/**
 * Format data as pretty-printed JSON.
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ── Pagination ─────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  pageSize: number;
}

/**
 * Paginate an array of items, returning a page with optional cursor.
 * Uses string-based cursor pagination based on array index.
 */
export function paginate<T>(
  items: T[],
  pageSize: number = 10,
  cursor?: string
): PaginatedResult<T> {
  const startIndex = cursor ? parseInt(cursor, 10) || 0 : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < items.length;

  return {
    items: page,
    total: items.length,
    hasMore,
    nextCursor: hasMore ? String(startIndex + pageSize) : undefined,
    pageSize,
  };
}

// ── Status display helpers ─────────────────────────────────

/**
 * Format a connection status display for the /agentlink status command.
 */
export function formatConnectionStatus(status: {
  connected: boolean;
  serverUrl?: string;
  project?: string;
  role?: string;
  sender?: string;
  events?: { total: number; scoped: number };
  sessions?: number;
  lastSeen?: string;
}): string {
  const lines: string[] = [
    "mcp-agentlink Connection",
    "─".repeat(30),
    `Status:     ${status.connected ? "🟢 Connected" : "🔴 Disconnected"}`,
  ];

  if (status.serverUrl) lines.push(`Server:     ${status.serverUrl}`);
  if (status.project) lines.push(`Project:    ${status.project}`);
  if (status.role) lines.push(`Role:       ${status.role}`);
  if (status.sender) lines.push(`Sender:     ${status.sender}`);
  if (status.events) {
    lines.push(`Events:     ${status.events.total} total · ${status.events.scoped} scoped to your role`);
  }
  if (status.sessions !== undefined) {
    lines.push(`Sessions:   ${status.sessions} active connections`);
  }
  if (status.lastSeen) {
    lines.push(`Registration: ${status.lastSeen}`);
  }

  return lines.join("\n");
}
