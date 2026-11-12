import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'node:path';
import fs from 'node:fs';
import { createLuxServerBridge } from './server-bridge.js';
import { registerReviewResourcesAndPrompts, registerReviewTools } from './review-tools.js';
import { registerVisualTools } from './visual-tools.js';

let mcpPkgVersion = '0.13.0';
try {
  mcpPkgVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
} catch {}

/** Creates and configures the `lux-edit` MCP server with review, visual capture, and variant tools. */
export function createVisualEditMcpServer(rootDir: string = process.cwd()) {
  const resolvedRoot = path.resolve(rootDir);
  const bridge = createLuxServerBridge(resolvedRoot);
  console.error(`[lux-mcp] Initialized MCP server (root: ${resolvedRoot})`);

  const server = new McpServer({
    name: 'lux-edit',
    version: mcpPkgVersion,
  });

  registerReviewResourcesAndPrompts(server, bridge);
  registerReviewTools(server, bridge, mcpPkgVersion);
  registerVisualTools(server, bridge);

  return server;
}
