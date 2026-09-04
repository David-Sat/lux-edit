import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createVisualEditMcpServer } from '../server.js';
import { EventStore } from '@visual-edit/server';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import path from 'node:path';
import fs from 'node:fs';

describe('MCP Server Tools & Prompts', () => {
  const testDir = path.resolve(process.cwd(), '.test-mcp-store');
  let client: Client;
  let eventStore: EventStore;

  beforeAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    eventStore = EventStore.getInstance(testDir);
    eventStore.saveBatch({
      id: 'mcp_test_batch_1',
      timestamp: Date.now(),
      route: '/pricing',
      status: 'submitted',
      userPrompt: 'Make the Pro tier card highlighted in violet',
      primarySource: {
        fileName: 'src/components/PricingCard.tsx',
        lineNumber: 22,
        componentName: 'PricingCard',
        selector: '#pricing-card-pro',
        tag: 'div',
      },
      mutations: [
        {
          id: 'mut_1',
          type: 'STYLE_CHANGE',
          targetSelector: '#pricing-card-pro',
          property: 'background-color',
          before: '#1e293b',
          after: '#6366f1',
          tailwindSuggestion: 'bg-indigo-500',
        },
      ],
    });

    const mcpServer = createVisualEditMcpServer(testDir);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-agent', version: '1.0.0' });

    await Promise.all([
      client.connect(clientTransport),
      mcpServer.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('retrieves active pending review instantly via lux_get_pending_review', async () => {
    const res = await client.callTool({
      name: 'lux_get_pending_review',
      arguments: {},
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('Visual Review & Comments');
    expect(textContent).toContain('mcp_test_batch_1');
    expect(textContent).toContain('src/components/PricingCard.tsx:22');
    expect(textContent).toContain('bg-indigo-500');
  });

  it('retrieves active comments via alias lux_get_comments', async () => {
    const res = await client.callTool({
      name: 'lux_get_comments',
      arguments: {},
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('Visual Review & Comments');
    expect(textContent).toContain('mcp_test_batch_1');
  });

  it('lists visual edit sessions via lux_list_sessions tool', async () => {
    const res = await client.callTool({
      name: 'lux_list_sessions',
      arguments: {},
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    const parsed = JSON.parse(textContent);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed[0].id).toBe('mcp_test_batch_1');
    expect(parsed[0].userPrompt).toBe('Make the Pro tier card highlighted in violet');
  });

  it('retrieves detailed batch via lux_get_session tool', async () => {
    const res = await client.callTool({
      name: 'lux_get_session',
      arguments: { sessionId: 'mcp_test_batch_1' },
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('Visual Edit Batch: mcp_test_batch_1');
    expect(textContent).toContain('src/components/PricingCard.tsx:22');
    expect(textContent).toContain('bg-indigo-500');
  });

  it('reads pending review as an MCP resource (lux://pending-review)', async () => {
    const res = await client.readResource({
      uri: 'lux://pending-review',
    });

    expect(res.contents).toBeDefined();
    expect(res.contents.length).toBe(1);
    const content = res.contents[0] as any;
    expect(content.uri).toBe('lux://pending-review');
    expect(content.mimeType).toBe('text/markdown');
    expect(content.text).toContain('Visual Review & Comments');
    expect(content.text).toContain('mcp_test_batch_1');
  });

  it('retrieves prompt template via lux_apply_review', async () => {
    const res = await client.getPrompt({
      name: 'lux_apply_review',
    });

    expect(res.messages).toBeDefined();
    expect(res.messages.length).toBe(1);
    const message = res.messages[0];
    expect(message.role).toBe('user');
    expect((message.content as any).text).toContain('mcp_test_batch_1');
    expect((message.content as any).text).toContain('src/components/PricingCard.tsx:22');
  });
});

