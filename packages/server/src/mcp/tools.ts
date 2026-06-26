/**
 * MCP tool handlers for register, postEvent, queryEvents.
 */

import type { Database } from "../storage/database.js";
import { RegistrationStore } from "../storage/registrations.js";
import { EventStore } from "../storage/events.js";
import { FileLinkStore } from "../storage/fileLinks.js";
import { CharterStore } from "../storage/charters.js";
import { ProjectStore } from "../storage/projects.js";
import {
  verifyToken,
  assertProjectAccess,
  assertPermission,
  assertPmRole,
  assertProjectNotClosed,
} from "../auth/index.js";
import type { Permission } from "../storage/tokens.js";
import { getServerStatus } from "./handlers.js";

// ── Tool definitions (JSON Schema for MCP discovery) ───

export const toolDefinitions = [
  {
    name: "register",
    description: "Register an agent's identity with the center",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project ID" },
        sender: { type: "string", description: "Agent identifier (repo/agent-id)" },
        role: { type: "string", description: "Functional role (kebab-case)" },
        workpath: { type: "string", description: "Absolute path to working directory" },
        giturl: { type: "string", description: "Git remote URL" },
        token: { type: "string", description: "Authentication token" },
      },
      required: ["project", "sender", "role", "workpath", "giturl", "token"],
    },
  },
  {
    name: "postEvent",
    description: "Post a completion or status event",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project ID" },
        type: {
          type: "string",
          enum: ["start", "finish", "milestone", "error", "assignment"],
          description: "Event type",
        },
        sender: { type: "string", description: "Who sent the event" },
        summary: { type: "string", description: "One-line summary (token-efficient)" },
        scope: { type: "string", description: "Target role or '*' for all" },
        docRef: {
          type: "object",
          properties: {
            path: { type: "string", description: "Document path (relative to repo root)" },
            script: { type: "string", description: "Related script/file path" },
          },
        },
        token: { type: "string", description: "Authentication token" },
      },
      required: ["project", "type", "summary", "token"],
    },
  },
  {
    name: "queryEvents",
    description: "Query events from the center",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project ID" },
        scope: { type: "string", description: "Filter by scope (role name or '*')" },
        type: { type: "string", description: "Filter by event type" },
        sinceId: { type: "string", description: "Return only events after this ID" },
        token: { type: "string", description: "Authentication token" },
      },
      required: ["project", "token"],
    },
  },
  {
    name: "status",
    description: "Get server status and agent connection info",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Authentication token" },
      },
      required: ["token"],
    },
  },
  {
    name: "linkFile",
    description: "Create a file link between two repositories",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        sourceRepo: { type: "string", description: "Source repo identifier" },
        sourcePath: { type: "string", description: "Source file path" },
        targetRepo: { type: "string", description: "Target repo identifier" },
        targetPath: { type: "string", description: "Target file path" },
        description: { type: "string" },
        token: { type: "string" },
      },
      required: ["project", "sourceRepo", "sourcePath", "targetRepo", "targetPath", "token"],
    },
  },
  {
    name: "queryLinks",
    description: "Query file links by source or target path",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        repo: { type: "string", description: "Repository identifier to search" },
        path: { type: "string", description: "File path to search" },
        token: { type: "string" },
      },
      required: ["project", "repo", "path", "token"],
    },
  },
  {
    name: "unlinkFile",
    description: "Delete a file link",
    inputSchema: {
      type: "object",
      properties: {
        linkId: { type: "string", description: "Link ID to delete" },
        token: { type: "string" },
      },
      required: ["linkId", "token"],
    },
  },
  {
    name: "publishCharter",
    description: "Publish project charter (PM only)",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project ID" },
        content: { type: "string", description: "Charter content (YAML/text format)" },
        token: { type: "string", description: "PM authentication token" },
      },
      required: ["project", "content", "token"],
    },
  },
  {
    name: "syncCharter",
    description: "Fetch latest charter for a project",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project ID" },
        token: { type: "string", description: "Authentication token" },
      },
      required: ["project", "token"],
    },
  },
];

// ── Tool handlers ──────────────────────────────────────

interface ToolContext {
  db: Database;
}

function getRequired(params: Record<string, unknown>, key: string): string {
  const val = params[key];
  if (typeof val !== "string" || !val) {
    throw new Error(`Missing required parameter: ${key}`);
  }
  return val;
}

function getOptional(params: Record<string, unknown>, key: string): string | undefined {
  const val = params[key];
  return typeof val === "string" && val.length > 0 ? val : undefined;
}

function errorResponse(code: string, message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: { code, message } }) }],
  };
}

function successResponse(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

export async function handleRegister(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const project = getRequired(params, "project");
    const sender = getRequired(params, "sender");
    const role = getRequired(params, "role");
    const workpath = getRequired(params, "workpath");
    const giturl = getRequired(params, "giturl");
    const token = getRequired(params, "token");

    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPermission(user, "write");
    assertProjectAccess(user, project);
    assertProjectNotClosed(ctx.db, project);

    const store = new RegistrationStore(ctx.db);

    // PM registration logic
    if (role === "pm") {
      const existingPm = store.findPm(project);
      if (existingPm && existingPm.sender !== sender) {
        return errorResponse("PM_EXISTS", "Project already has a PM");
      }
    } else {
      // Non-PM roles: project must have a PM first
      if (!store.hasPm(project)) {
        return errorResponse("NO_PM", "Project has no PM — register a PM first");
      }
    }

    const reg = store.register({ project, sender, role, workpath, giturl });

    if (!reg)
      return errorResponse("SENDER_CONFLICT", "Sender already registered by a different agent");

    return successResponse({ registrationId: reg.id, status: reg.status });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "INVALID_TOKEN" || msg === "UNAUTHORIZED_SCOPE" || msg === "PERMISSION_DENIED" || msg === "PROJECT_CLOSED") {
      const map: Record<string, string> = {
        INVALID_TOKEN: "Invalid or revoked token",
        UNAUTHORIZED_SCOPE: "Token not authorized for this project",
        PERMISSION_DENIED: "Token lacks required permission",
        PROJECT_CLOSED: "Project is closed — no new registrations allowed",
      };
      return errorResponse(msg, map[msg]);
    }
    return errorResponse("VALIDATION_ERROR", msg);
  }
}

export async function handlePostEvent(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const project = getRequired(params, "project");
    const type = getRequired(params, "type");
    const summary = getRequired(params, "summary");
    const token = getRequired(params, "token");

    if (!["start", "finish", "milestone", "error", "assignment"].includes(type))
      return errorResponse("VALIDATION_ERROR", `Invalid event type: ${type}`);

    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPermission(user, "write");
    assertProjectNotClosed(ctx.db, project);

    const sender = getOptional(params, "sender") ?? user.role;
    const scope = getOptional(params, "scope") ?? "*";
    const docRef = params.docRef as { path?: string; script?: string } | undefined;

    const store = new EventStore(ctx.db);
    const ev = store.create({ project, type: type as any, sender, summary, scope, docRef });

    return successResponse({ eventId: ev.id });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "INVALID_TOKEN" || msg === "UNAUTHORIZED_SCOPE" || msg === "PERMISSION_DENIED" || msg === "PROJECT_CLOSED") {
      const map: Record<string, string> = {
        INVALID_TOKEN: "Invalid or revoked token",
        UNAUTHORIZED_SCOPE: "Token not authorized for this project",
        PERMISSION_DENIED: "Token lacks required permission",
        PROJECT_CLOSED: "Project is closed — no new events allowed",
      };
      return errorResponse(msg, map[msg]);
    }
    return errorResponse("VALIDATION_ERROR", msg);
  }
}

export async function handleQueryEvents(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const project = getRequired(params, "project");
    const token = getRequired(params, "token");

    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPermission(user, "read");

    const store = new EventStore(ctx.db);
    const events = store.query({
      project,
      scope: getOptional(params, "scope"),
      type: getOptional(params, "type"),
      sinceId: getOptional(params, "sinceId"),
    });

    return successResponse({ events });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "INVALID_TOKEN" || msg === "UNAUTHORIZED_SCOPE" || msg === "PERMISSION_DENIED") {
      const map: Record<string, string> = {
        INVALID_TOKEN: "Invalid or revoked token",
        UNAUTHORIZED_SCOPE: "Token not authorized for this project",
        PERMISSION_DENIED: "Token lacks required permission",
      };
      return errorResponse(msg, map[msg]);
    }
    return errorResponse("VALIDATION_ERROR", msg);
  }
}

export async function handleStatus(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const token = getRequired(params, "token");
    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPermission(user, "read");

    const status = getServerStatus(ctx.db);
    return successResponse({
      server: `mcp-agentlink v${status.version}`,
      projects: status.projects,
      registrations: `${status.registrationsOnline}/${status.registrations} online`,
      events: status.events,
      tokensActive: status.tokensActive,
      agent: { projectId: user.projectId, role: user.role },
    });
  } catch (err) {
    return errorResponse("VALIDATION_ERROR", (err as Error).message);
  }
}

export async function handleLinkFile(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const project = getRequired(params, "project");
    const token = getRequired(params, "token");
    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPermission(user, "write");
    assertProjectAccess(user, project);

    const store = new FileLinkStore(ctx.db);
    const link = store.create({
      project,
      sourceRepo: getRequired(params, "sourceRepo"),
      sourcePath: getRequired(params, "sourcePath"),
      targetRepo: getRequired(params, "targetRepo"),
      targetPath: getRequired(params, "targetPath"),
      description: getOptional(params, "description"),
    });
    return successResponse({ linkId: link.id });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "INVALID_TOKEN" || msg === "UNAUTHORIZED_SCOPE" || msg === "PERMISSION_DENIED") {
      const map: Record<string, string> = {
        INVALID_TOKEN: "Invalid or revoked token",
        UNAUTHORIZED_SCOPE: "Token not authorized for this project",
        PERMISSION_DENIED: "Token lacks required permission",
      };
      return errorResponse(msg, map[msg]);
    }
    return errorResponse("VALIDATION_ERROR", msg);
  }
}

export async function handleQueryLinks(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const project = getRequired(params, "project");
    const repo = getRequired(params, "repo");
    const path = getRequired(params, "path");
    const token = getRequired(params, "token");
    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPermission(user, "read");

    const store = new FileLinkStore(ctx.db);
    const sourceMatches = store.findBySource(project, repo, path);
    const targetMatches = store.findByTarget(project, repo, path);
    return successResponse({ links: [...sourceMatches, ...targetMatches] });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "INVALID_TOKEN" || msg === "PERMISSION_DENIED") {
      const map: Record<string, string> = {
        INVALID_TOKEN: "Invalid or revoked token",
        PERMISSION_DENIED: "Token lacks required permission",
      };
      return errorResponse(msg, map[msg]);
    }
    return errorResponse("VALIDATION_ERROR", msg);
  }
}

export async function handleUnlinkFile(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const linkId = getRequired(params, "linkId");
    const token = getRequired(params, "token");
    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPermission(user, "write");

    const store = new FileLinkStore(ctx.db);
    const deleted = store.delete(linkId);
    if (!deleted) return errorResponse("VALIDATION_ERROR", "Link not found");
    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse("VALIDATION_ERROR", (err as Error).message);
  }
}

// ── publishCharter handler ─────────────────────────────────

export async function handlePublishCharter(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const project = getRequired(params, "project");
    const content = getRequired(params, "content");
    const token = getRequired(params, "token");

    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertPmRole(user);
    assertProjectAccess(user, project);

    const store = new CharterStore(ctx.db);
    const charter = store.publish({ project, content, published_by: user.role });

    return successResponse({ guid: charter.guid, timestamp: charter.published_at });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "INVALID_TOKEN" || msg === "PERMISSION_DENIED") {
      const map: Record<string, string> = {
        INVALID_TOKEN: "Invalid or revoked token",
        PERMISSION_DENIED: "Only PM can publish charter",
      };
      return errorResponse(msg, map[msg]);
    }
    return errorResponse("VALIDATION_ERROR", msg);
  }
}

// ── syncCharter handler ────────────────────────────────────

export async function handleSyncCharter(
  args: unknown,
  ctx: ToolContext
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args as Record<string, unknown>;
  try {
    const project = getRequired(params, "project");
    const token = getRequired(params, "token");

    const user = verifyToken(ctx.db, token);
    if (!user) return errorResponse("INVALID_TOKEN", "Invalid or revoked token");
    assertProjectAccess(user, project);
    assertProjectNotClosed(ctx.db, project);

    const charterStore = new CharterStore(ctx.db);
    const charter = charterStore.getByProject(project);

    const projectStore = new ProjectStore(ctx.db);
    const proj = projectStore.findById(project);

    return successResponse({
      charter: charter
        ? {
            content: charter.content,
            guid: charter.guid,
            published_at: charter.published_at,
            updated_at: charter.updated_at,
          }
        : null,
      project: proj
        ? { id: proj.id, name: proj.name, status: proj.status }
        : null,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "INVALID_TOKEN" || msg === "UNAUTHORIZED_SCOPE") {
      const map: Record<string, string> = {
        INVALID_TOKEN: "Invalid or revoked token",
        UNAUTHORIZED_SCOPE: "Token not authorized for this project",
      };
      return errorResponse(msg, map[msg]);
    }
    return errorResponse("VALIDATION_ERROR", msg);
  }
}
