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
import {
  toolDefinitions,
  handleRegister,
  handlePostEvent,
  handleQueryEvents,
  handleStatus,
  handleLinkFile,
  handleQueryLinks,
  handleUnlinkFile,
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
        version: "0.2.0",
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

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", sessionCount: state?.transports.size ?? 0 });
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
