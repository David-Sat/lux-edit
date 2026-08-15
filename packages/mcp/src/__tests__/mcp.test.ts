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

  it('claims session via lux_claim_session tool', async () => {
    const res = await client.callTool({
      name: 'lux_claim_session',
      arguments: { sessionId: 'mcp_test_batch_1', agentId: 'test-agent' },
    });

    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('Successfully claimed session');

    const session = eventStore.getSession('mcp_test_batch_1');
    expect(session?.status).toBe('in_progress');
    expect(session?.claim?.agentId).toBe('test-agent');
  });

  it('blocks and wakes up on user submission via lux_wait_for_review tool', async () => {
    const waitPromise = client.callTool({
      name: 'lux_wait_for_review',
      arguments: { timeoutSeconds: 5, agentId: 'test-agent' },
    });

    // Simulate user in browser clicking "Send to Agent" after 50ms
    setTimeout(() => {
      eventStore.saveBatch({
        id: 'user_submitted_batch_2',
        timestamp: Date.now(),
        route: '/',
        status: 'submitted',
        userPrompt: 'Make the hero headline larger and blue',
        mutations: [
          {
            id: 'mut_2',
            type: 'TEXT_EDIT',
            targetSelector: '#arch-headline',
            before: 'Old Title',
            after: 'New Hero Title',
          },
        ],
      });
    }, 50);

    const res = await waitPromise;
    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('Visual Review Received');
    expect(textContent).toContain('user_submitted_batch_2');
    expect(textContent).toContain('Make the hero headline larger and blue');

    const session = eventStore.getSession('user_submitted_batch_2');
    expect(session?.status).toBe('in_progress');
    expect(session?.claim?.agentId).toBe('test-agent');
  });

  it('updates session status and adds message via lux_update_status', async () => {
    const res = await client.callTool({
      name: 'lux_update_status',
      arguments: {
        sessionId: 'mcp_test_batch_1',
        status: 'implemented',
        agentMessage: 'Updated background color in PricingCard.tsx to bg-indigo-500',
        agentId: 'test-agent',
      },
    });

    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('Updated session');

    const session = eventStore.getSession('mcp_test_batch_1');
    expect(session?.status).toBe('implemented');
    expect(session?.replies?.[0].message).toContain('Updated background color');
  });

  it('provides the apply_visual_edits prompt template', async () => {
    const res = await client.getPrompt({
      name: 'apply_visual_edits',
      arguments: { sessionId: 'mcp_test_batch_1' },
    });

    expect(res.messages).toBeDefined();
    expect(res.messages[0].content.type).toBe('text');
    const msgText = (res.messages[0].content as any).text;
    expect(msgText).toContain('Please implement the following visual modifications');
    expect(msgText).toContain('Idiomatic Styling');
  });
});
