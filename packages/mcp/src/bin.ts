#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createVisualEditMcpServer } from './server.js';

async function main() {
  const server = createVisualEditMcpServer(process.cwd());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[lux-mcp] MCP Server connected via stdio');
}

main().catch((err) => {
  console.error('[lux-mcp] Fatal error:', err);
  process.exit(1);
});
