import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VisualEditServer } from '../server.js';
import { EventStore } from '../event-store.js';
import path from 'node:path';
import fs from 'node:fs';

describe('Server & EventStore Integration', () => {
  const testDir = path.resolve(process.cwd(), '.test-visual-edit');
  let server: VisualEditServer;
  let reviewUrl: string;

  beforeAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    server = new VisualEditServer({
      target: './fixtures/static-html/index.html',
      port: 0, // OS assigns free port
      host: '127.0.0.1',
      rootDir: testDir,
    });
    reviewUrl = await server.listen();
  });

  afterAll(async () => {
    await server.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('serves HTML with overlay script injected', async () => {
    const res = await fetch(reviewUrl);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<script type="module" src="/__visual_edit__/overlay.js"></script>');
    expect(html).toContain('Build Web Interfaces Visually with AI');
  });

  it('serves the overlay JS bundle at /__visual_edit__/overlay.js', async () => {
    const res = await fetch(`${reviewUrl}/__visual_edit__/overlay.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    const js = await res.text();
    expect(js).toContain('visual-edit-overlay');
  });

  it('handles edit batch submission via REST API and persists session', async () => {
    const batch = {
      id: 'test_session_123',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      userPrompt: 'Increase hero headline size',
      mutations: [
        {
          id: 'm1',
          type: 'STYLE_CHANGE',
          targetSelector: '#main-headline',
          property: 'font-size',
          before: '48px',
          after: '60px',
          tailwindSuggestion: 'text-6xl',
        },
      ],
    };

    const submitRes = await fetch(`${reviewUrl}/__visual_edit__/api/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    expect(submitRes.status).toBe(200);
    const submitJson = (await submitRes.json()) as { success: boolean; id: string };
    expect(submitJson.success).toBe(true);

    // Verify session retrieval via API
    const listRes = await fetch(`${reviewUrl}/__visual_edit__/api/sessions`);
    const sessions = (await listRes.json()) as any[];
    const created = sessions.find((s) => s.id === 'test_session_123');
    expect(created).toBeDefined();
    expect(created.mutationCount).toBe(1);
    expect(created.userPrompt).toBe('Increase hero headline size');
  });

  it('supports atomic agent claiming and status updates', () => {
    const store = server.getEventStore();
    const claimRes = store.claimSession('test_session_123', 'agent-alpha');
    expect(claimRes.success).toBe(true);

    // Another agent trying to claim should fail
    const conflictRes = store.claimSession('test_session_123', 'agent-beta');
    expect(conflictRes.success).toBe(false);
    expect(conflictRes.error).toContain('already claimed');

    // Updating status with message
    const updateRes = store.updateStatus('test_session_123', 'implemented', {
      agentId: 'agent-alpha',
      message: 'Applied text-6xl to main-headline in styles.css',
    });
    expect(updateRes).toBe(true);

    const updatedSession = store.getSession('test_session_123');
    expect(updatedSession?.status).toBe('implemented');
    expect(updatedSession?.replies?.[0].message).toContain('Applied text-6xl');
  });
});
