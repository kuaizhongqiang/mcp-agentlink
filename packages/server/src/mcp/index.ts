/**
 * MCP over SSE server.
 *
 * Serves:
 *   GET  /sse       — SSE stream (client connects here)
 *   POST /message   — Client sends messages (session ID in query)
 *
 * Start with: mcp-agentlink server start
 * Or programmatically via startServer() / stopServer()
 */

import express from "express";
import { type Server as HttpServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getApp, closeApp } from "../app/index.js";
import { withRetry } from "../app/retry.js";
import { verifyToken } from "../auth/index.js";
import { RegistrationStore } from "../storage/registrations.js";
import { EventStore } from "../storage/events.js";
import { ProjectStore } from "../storage/projects.js";
import { CharterStore } from "../storage/charters.js";
import { getServerStatus, setVersion } from "./handlers.js";
import {
  toolDefinitions,
  handleRegister,
  handlePostEvent,
  handleQueryEvents,
  handleStatus,
  handleLinkFile,
  handleQueryLinks,
  handleUnlinkFile,
  handlePublishCharter,
  handleSyncCharter,
} from "./tools.js";

interface McpServerState {
  httpServer: HttpServer;
  transports: Map<string, SSEServerTransport>;
}

let state: McpServerState | null = null;

/**
 * Start the MCP over SSE server.
 */
export async function startServer(port: number = 3000): Promise<void> {
  if (state) {
    console.log("[mcp-agentlink] Server already running");
    return;
  }

  const db = await getApp();
  const app = express();

  // Read version from package.json (single source of truth)
  const { readFileSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "../../package.json"), "utf-8")
  );
  setVersion(pkg.version);

  // Parse JSON bodies for POST /message
  app.use(express.json());

  // SSE endpoint — agents connect here
  app.get("/sse", async (req, res) => {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Create MCP Server
    const server = new Server(
      {
        name: "mcp-agentlink-server",
        version: pkg.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register list-tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: toolDefinitions };
    });

    // Register call-tool handler with retry
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const ctx = { db };

      return withRetry(async () => {
        switch (name) {
        case "register":
          return handleRegister(args, ctx);
        case "postEvent":
          return handlePostEvent(args, ctx);
        case "queryEvents":
          return handleQueryEvents(args, ctx);
        case "status":
          return handleStatus(args, ctx);
        case "linkFile":
          return handleLinkFile(args, ctx);
        case "queryLinks":
          return handleQueryLinks(args, ctx);
        case "unlinkFile":
          return handleUnlinkFile(args, ctx);
        case "publishCharter":
          return handlePublishCharter(args, ctx);
        case "syncCharter":
          return handleSyncCharter(args, ctx);
        default:
          return {
            content: [{ type: "text", text: JSON.stringify({ error: { code: "UNKNOWN_TOOL", message: `Unknown tool: ${name}` } }) }],
          };
      }
      });
    });

    // Create SSE transport
    const transport = new SSEServerTransport("/message", res);
    state!.transports.set(transport.sessionId, transport);

    // Cleanup on disconnect
    req.on("close", () => {
      state!.transports.delete(transport.sessionId);
    });

    // Connect the MCP server to the transport
    await server.connect(transport);
  });

  // POST endpoint — agents send messages here (called by SSE transport)
  app.post("/message", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = state?.transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // Health check with metrics
  app.get("/health", (_req, res) => {
    const health = getServerStatus(db);
    res.json({
      status: "ok",
      version: health.version,
      uptime: health.uptime,
      sessionCount: state?.transports.size ?? 0,
      projects: health.projects,
      registrations: `${health.registrationsOnline}/${health.registrations} online`,
      events: health.events,
      tokensActive: health.tokensActive,
    });
  });

  // ── REST API for agent self-service ─────────────────────────

  /**
   * GET /api/agent/status?token=xxx
   *
   * Returns the agent's connection status: project info, registration,
   * event counts, and server health. Used by the /agentlink skill.
   */
  app.get("/api/agent/status", (req, res) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Missing token" });
      return;
    }
    const user = verifyToken(db, token);
    if (!user) {
      res.status(401).json({ error: "Invalid or revoked token" });
      return;
    }

    const projectStore = new ProjectStore(db);
    const project = projectStore.findById(user.projectId);

    const eventStore = new EventStore(db);
    const allEvents = eventStore.query({ project: user.projectId });
    const scopedEvents = eventStore.query({ project: user.projectId, scope: user.role });

    const regStore = new RegistrationStore(db);
    const myRegs = regStore
      .list(user.projectId)
      .filter((r) => r.role === user.role);

    res.json({
      agent: { projectId: user.projectId, role: user.role },
      project: project
        ? { id: project.id, name: project.name, status: project.status }
        : null,
      events: {
        total: allEvents.length,
        scoped: scopedEvents.length,
      },
      registrations: myRegs.map((r) => ({
        sender: r.sender,
        status: r.status,
        lastSeen: r.last_seen,
      })),
      server: {
        sessionCount: state?.transports.size ?? 0,
      },
    });
  });

  /**
   * POST /api/agent/register
   *
   * Register or re-register an agent via REST. Alternative to the MCP
   * register tool for agents that don't have a full MCP connection.
   */
  app.post("/api/agent/register", (req, res) => {
    const { project, sender, role, workpath, giturl, token } = req.body ?? {};
    if (!project || !sender || !role || !workpath || !giturl || !token) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const user = verifyToken(db, token);
    if (!user) {
      res.status(401).json({ error: "Invalid or revoked token" });
      return;
    }
    if (user.projectId !== project) {
      res.status(403).json({ error: "Token not authorized for this project" });
      return;
    }

    // Check project is not closed
    const projectStatus = db.exec<{ status: string }>(
      "SELECT status FROM projects WHERE id = ?", [project]
    );
    if (projectStatus.length > 0 && projectStatus[0].status === "closed") {
      res.status(403).json({ error: "Project is closed" });
      return;
    }

    const store = new RegistrationStore(db);

    // PM registration logic (same as MCP handleRegister)
    if (role === "pm") {
      const existingPm = store.findPm(project);
      if (existingPm && existingPm.sender !== sender) {
        res.status(409).json({ error: "Project already has a PM" });
        return;
      }
    } else {
      if (!store.hasPm(project)) {
        res.status(403).json({ error: "Project has no PM — register a PM first" });
        return;
      }
    }

    const reg = store.register({ project, sender, role, workpath, giturl });

    if (!reg) {
      res.status(409).json({ error: "Sender already registered by a different agent" });
      return;
    }

    res.json({
      registrationId: reg.id,
      status: reg.status,
    });
  });

  /**
   * POST /api/agent/sync
   *
   * Sync project charter and status to local cache. Returns the latest
   * charter content and project status for the caller's project.
   */
  app.post("/api/agent/sync", (req, res) => {
    const { project, token } = req.body ?? {};
    if (!project || !token) {
      res.status(400).json({ error: "Missing project or token" });
      return;
    }

    const user = verifyToken(db, token);
    if (!user) {
      res.status(401).json({ error: "Invalid or revoked token" });
      return;
    }
    if (user.projectId !== project) {
      res.status(403).json({ error: "Token not authorized for this project" });
      return;
    }

    const charterStore = new CharterStore(db);
    const charter = charterStore.getByProject(project);

    const projectStore = new ProjectStore(db);
    const proj = projectStore.findById(project);

    res.json({
      charter: charter
        ? {
            content: charter.content,
            guid: charter.guid,
            published_at: charter.published_at,
          }
        : null,
      project: proj
        ? { id: proj.id, name: proj.name, status: proj.status }
        : null,
    });
  });

  return new Promise<void>((resolve) => {
    const httpServer = app.listen(port, () => {
      state = { httpServer, transports: new Map() };
      console.log(`[mcp-agentlink] MCP server listening on http://localhost:${port}/sse`);
      resolve();
    });
  });
}

/**
 * Stop the MCP over SSE server.
 */
export async function stopServer(): Promise<void> {
  if (!state) {
    console.log("[mcp-agentlink] Server not running");
    return;
  }

  // Close all transports
  for (const [id, transport] of state.transports) {
    transport.close();
  }
  state.transports.clear();

  return new Promise<void>((resolve) => {
    state!.httpServer.close(() => {
      state = null;
      console.log("[mcp-agentlink] Server stopped");
      resolve();
    });
  });
}

/**
 * Get current server status.
 */
export function getStatus(): {
  running: boolean;
  sessions: number;
} {
  return {
    running: state !== null,
    sessions: state?.transports.size ?? 0,
  };
}
