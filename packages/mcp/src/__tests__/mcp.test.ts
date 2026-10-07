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
    expect(textContent).toContain('Visual review and comments');
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
    expect(textContent).toContain('Visual review and comments');
    expect(textContent).toContain('mcp_test_batch_1');
  });

  it('retrieves pending review from a specific workspaceDir', async () => {
    const customDir = path.resolve(process.cwd(), '.test-mcp-store-custom');
    if (fs.existsSync(customDir)) {
      fs.rmSync(customDir, { recursive: true, force: true });
    }
    const customStore = EventStore.getInstance(customDir);
    customStore.saveBatch({
      id: 'custom_workspace_batch_99',
      timestamp: Date.now(),
      route: '/custom',
      status: 'submitted',
      userPrompt: 'Custom workspace prompt',
      mutations: [
        {
          id: 'mut_custom',
          type: 'STYLE_CHANGE',
          targetSelector: '#custom-el',
          property: 'color',
          before: '#000',
          after: '#fff',
        },
      ],
    });

    const res = await client.callTool({
      name: 'lux_get_pending_review',
      arguments: {
        workspaceDir: customDir,
      },
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('custom_workspace_batch_99');
    expect(textContent).toContain('#custom-el');

    fs.rmSync(customDir, { recursive: true, force: true });
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

  it('retrieves voice review walkthroughs with inline targets via lux_get_pending_review', async () => {
    const voiceDir = path.resolve(process.cwd(), '.test-mcp-store-voice');
    if (fs.existsSync(voiceDir)) {
      fs.rmSync(voiceDir, { recursive: true, force: true });
    }
    const voiceStore = EventStore.getInstance(voiceDir);
    voiceStore.saveBatch({
      id: 'voice_session_42',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      mutations: [],
      voiceReviews: [
        {
          id: 'v_rec_1',
          timestamp: Date.now(),
          durationMs: 8500,
          transcript: 'Here the font is too big and this button should be red.',
          annotatedTranscript:
            'Here the font is too big [Target 1] and this button [Target 2] should be red.',
          pins: [
            {
              id: 'p1',
              order: 1,
              targetSelector: 'h1.heading',
              sourceLocation: {
                fileName: 'src/Hero.tsx',
                lineNumber: 10,
                componentName: 'Title',
                selector: 'h1.heading',
                tag: 'h1',
              },
              htmlSnippet: '<h1 class="heading">Hello</h1>',
              timestampMs: 1200,
            },
            {
              id: 'p2',
              order: 2,
              targetSelector: 'button.btn',
              sourceLocation: {
                fileName: 'src/Hero.tsx',
                lineNumber: 25,
                componentName: 'Button',
                selector: 'button.btn',
                tag: 'button',
              },
              htmlSnippet: '<button class="btn">Click</button>',
              timestampMs: 4500,
            },
          ],
        },
      ],
    });

    const res = await client.callTool({
      name: 'lux_get_pending_review',
      arguments: { workspaceDir: voiceDir },
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('voice_session_42');
    expect(textContent).toContain('Voice Walkthrough (1 recording)');
    expect(textContent).toContain(
      '> "Here the font is too big [Target 1] and this button [Target 2] should be red."'
    );
    expect(textContent).toContain('- **[Target 1]**: `src/Hero.tsx:10` (`<Title>`)');
    expect(textContent).toContain('- **[Target 2]**: `src/Hero.tsx:25` (`<Button>`)');

    fs.rmSync(voiceDir, { recursive: true, force: true });
  });

  it('retrieves voice review walkthroughs stored as annotations via lux_get_pending_review', async () => {
    const voiceDir = path.resolve(process.cwd(), '.test-mcp-store-voice-anno');
    if (fs.existsSync(voiceDir)) {
      fs.rmSync(voiceDir, { recursive: true, force: true });
    }
    const voiceStore = EventStore.getInstance(voiceDir);
    voiceStore.saveBatch({
      id: 'voice_anno_session_1',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      mutations: [],
      annotations: [
        {
          id: 'v_ann_1',
          timestamp: Date.now(),
          type: 'voice',
          comment: 'Here the font is too big [Target 1] and this button [Target 2] should be red.',
          targets: [
            {
              targetSelector: 'h1.heading',
              sourceLocation: {
                fileName: 'src/Hero.tsx',
                lineNumber: 10,
                componentName: 'Title',
                selector: 'h1.heading',
                tag: 'h1',
              },
              htmlSnippet: '<h1 class="heading">Hello</h1>',
            },
            {
              targetSelector: 'button.btn',
              sourceLocation: {
                fileName: 'src/Hero.tsx',
                lineNumber: 25,
                componentName: 'Button',
                selector: 'button.btn',
                tag: 'button',
              },
              htmlSnippet: '<button class="btn">Click</button>',
            },
          ],
        },
      ],
    });

    const res = await client.callTool({
      name: 'lux_get_pending_review',
      arguments: { workspaceDir: voiceDir },
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('voice_anno_session_1');
    expect(textContent).toContain('Voice Walkthrough on 2 targets');
    expect(textContent).toContain('"Here the font is too big [Target 1] and this button [Target 2] should be red."');
    expect(textContent).toContain('- **[Target 1]**: `src/Hero.tsx:10` (`<Title>`)');
    expect(textContent).toContain('- **[Target 2]**: `src/Hero.tsx:25` (`<Button>`)');

    fs.rmSync(voiceDir, { recursive: true, force: true });
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
    expect(content.text).toContain('Visual review and comments');
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

  it('deterministically discovers active review server via .visual-edit/server.json lockfile', async () => {
    const liveDir = path.resolve(process.cwd(), '.test-mcp-store-lockfile');
    if (fs.existsSync(liveDir)) {
      fs.rmSync(liveDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(liveDir, '.visual-edit'), { recursive: true });

    // Mock an active running server on custom port 9999
    const mockMeta = {
      pid: process.pid,
      port: 9999,
      url: 'http://127.0.0.1:9999',
      target: './index.html',
      appId: 'test_app_9999',
      startTime: Date.now(),
      rootDir: liveDir,
    };
    fs.writeFileSync(
      path.join(liveDir, '.visual-edit', 'server.json'),
      JSON.stringify(mockMeta, null, 2)
    );

    // Save batch to disk as well
    const store = EventStore.getInstance(liveDir);
    store.saveBatch({
      id: 'lockfile_test_batch',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      userPrompt: 'Lockfile discovered',
      mutations: [
        {
          id: 'mut_lf',
          type: 'STYLE_CHANGE',
          targetSelector: 'body',
          property: 'color',
          before: '#000',
          after: '#111',
        },
      ],
    });

    const res = await client.callTool({
      name: 'lux_get_pending_review',
      arguments: { workspaceDir: liveDir },
    });

    expect(res.content).toBeDefined();
    const textContent = (res.content as any)[0].text;
    expect(textContent).toContain('lockfile_test_batch');

    fs.rmSync(liveDir, { recursive: true, force: true });
  });

  it('marks a review session resolved with agent reply via lux_resolve_review', async () => {
    // 1. Resolve mcp_test_batch_1
    const res = await client.callTool({
      name: 'lux_resolve_review',
      arguments: {
        sessionId: 'mcp_test_batch_1',
        status: 'implemented',
        reply: 'Updated Tailwind styles for PricingCard to violet/indigo',
      },
    });

    expect(res.content).toBeDefined();
    const text = (res.content as any)[0].text;
    expect(text).toContain('marked as implemented');
    expect(text).toContain('Updated Tailwind styles');

    // 2. Verify status and reply in session
    const sessionRes = await client.callTool({
      name: 'lux_get_session',
      arguments: { sessionId: 'mcp_test_batch_1' },
    });
    const sessionText = (sessionRes.content as any)[0].text;
    expect(sessionText).toContain('"status": "implemented"');
    expect(sessionText).toContain('Updated Tailwind styles for PricingCard to violet/indigo');
  });

  it('resolves active review via alias lux_mark_resolved', async () => {
    // Save another batch
    eventStore.saveBatch({
      id: 'mcp_test_batch_alias',
      timestamp: Date.now(),
      route: '/home',
      status: 'submitted',
      userPrompt: 'Alias resolve test',
      mutations: [
        {
          id: 'mut_alias',
          type: 'TEXT_EDIT',
          targetSelector: 'h1',
          before: 'Old',
          after: 'New',
        },
      ],
    });

    const res = await client.callTool({
      name: 'lux_mark_resolved',
      arguments: {
        sessionId: 'mcp_test_batch_alias',
        status: 'resolved',
      },
    });

    expect(res.content).toBeDefined();
    const text = (res.content as any)[0].text;
    expect(text).toContain('marked as resolved');
  });
});

