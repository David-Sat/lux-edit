import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createVisualEditMcpServer } from './server.js';

export * from './server.js';

export async function startMcpStdio(rootDir: string = process.cwd()): Promise<void> {
  const server = createVisualEditMcpServer(rootDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[visual-edit-mcp] Server running via stdio');
}
