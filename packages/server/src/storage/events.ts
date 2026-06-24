/**
 * CRUD operations for the events table.
 */

import type { Database } from "./database.js";
import type { SqlValue } from "sql.js";

export interface Event {
  id: string;
  project_id: string;
  type: "start" | "finish" | "milestone" | "error" | "assignment";
  sender: string;
  summary: string;
  scope: string;
  doc_path: string | null;
  doc_script: string | null;
  timestamp: string;
}

export interface CreateEventParams {
  project: string;
  type: Event["type"];
  sender: string;
  summary: string;
  scope?: string;
  docRef?: {
    path?: string;
    script?: string;
  };
}

export interface QueryEventsParams {
  project: string;
  scope?: string;
  type?: string;
  sinceId?: string;
  limit?: number;
}

export class EventStore {
  constructor(private db: Database) {}

  create(params: CreateEventParams, eventId?: string): Event {
    const events = this.db.exec<Event>(
      `INSERT INTO events (id, project_id, type, sender, summary, scope, doc_path, doc_script)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        eventId ?? crypto.randomUUID(),
        params.project,
        params.type,
        params.sender,
        params.summary,
        params.scope ?? "*",
        params.docRef?.path ?? null,
        params.docRef?.script ?? null,
      ]
    );
    return events[0];
  }

  query(params: QueryEventsParams): Event[] {
    const conditions: string[] = ["project_id = ?"];
    const bindings: SqlValue[] = [params.project];

    if (params.scope) {
      conditions.push("(scope = ? OR scope = '*')");
      bindings.push(params.scope);
    }
    if (params.type) {
      conditions.push("type = ?");
      bindings.push(params.type);
    }
    if (params.sinceId) {
      conditions.push("id > ?");
      bindings.push(params.sinceId);
    }

    const limit = params.limit ?? 50;
    const sql = `SELECT * FROM events WHERE ${conditions.join(" AND ")} ORDER BY timestamp DESC LIMIT ?`;
    bindings.push(limit);

    return this.db.exec<Event>(sql, bindings);
  }

  list(projectId: string): Event[] {
    return this.db.exec<Event>(
      "SELECT * FROM events WHERE project_id = ? ORDER BY timestamp DESC LIMIT 50",
      [projectId]
    );
  }
}
