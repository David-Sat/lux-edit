#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createVisualEditMcpServer } from './server.js';

async function main() {
  const server = createVisualEditMcpServer(process.cwd());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[visual-edit-mcp] MCP Server connected via stdio');
}

main().catch((err) => {
  console.error('[visual-edit-mcp] Fatal error:', err);
  process.exit(1);
});
