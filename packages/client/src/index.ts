/**
 * mcp-agentlink-client
 *
 * Client library for AI agents connecting to mcp-agentlink-server.
 *
 * Usage (by AI agents, not humans):
 *   1. Call `init()` with Q&A responses to write config
 *   2. Use MCP tools (register, postEvent, queryEvents) via the MCP protocol
 *   3. Read skill/skill.md for agent behavior rules
 *
 * This package is a thin bridge: `init` is local, MCP tools proxy to server.
 */

export { init, readToken, readConfig } from "./init.js";
export type { InitParams, InitResult } from "./init.js";
