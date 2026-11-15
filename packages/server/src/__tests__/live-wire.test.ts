import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { API_ROUTES } from '@visual-edit/core';
import { EventStore } from '../event-store.js';
import { VisualEditServer } from '../server.js';

interface WsEventMessage {
  type: string;
  sessionId?: string;
  requestId?: string;
  payload?: Record<string, unknown>;
}

async function connectWsClient(wsUrl: string): Promise<{
  ws: WebSocket;
  messages: WsEventMessage[];
  waitForMessage: (predicate: (msg: WsEventMessage) => boolean, timeoutMs?: number) => Promise<WsEventMessage>;
}> {
  const ws = new WebSocket(wsUrl);
  const messages: WsEventMessage[] = [];
  const waiters: Array<{
    predicate: (msg: WsEventMessage) => boolean;
    resolve: (msg: WsEventMessage) => void;
  }> = [];

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString()) as WsEventMessage;
      messages.push(parsed);
      for (let i = waiters.length - 1; i >= 0; i -= 1) {
        if (waiters[i].predicate(parsed)) {
          const waiter = waiters[i];
          waiters.splice(i, 1);
          waiter.resolve(parsed);
        }
      }
    } catch {
      // Ignore non-JSON frames in tests
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });

  const waitForMessage = (
    predicate: (msg: WsEventMessage) => boolean,
    timeoutMs: number = 2500
  ): Promise<WsEventMessage> => {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for WS message')), timeoutMs);
      waiters.push({
        predicate,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
    });
  };

  return { ws, messages, waitForMessage };
}

describe('Live & Batch Wire Integration (WebSocket + HTTP + EventStore)', () => {
  let rootDir: string;
  let server: VisualEditServer;
  let baseUrl: string;
  let wsUrl: string;

  beforeEach(async () => {
    rootDir = path.join(os.tmpdir(), `lux-wire-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'index.html'), '<html><body><button id="hero-cta">Start</button></body></html>');
    // Allow OS file-creation FSEvents (macOS) to settle before starting watcher
    await new Promise((r) => setTimeout(r, 180));

    const port = 4500 + Math.floor(Math.random() * 400);
    server = new VisualEditServer({
      target: rootDir,
      port,
      host: '127.0.0.1',
      rootDir,
    });
    baseUrl = await server.listen();
    wsUrl = baseUrl.replace(/^http/, 'ws') + API_ROUTES.WS;
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('keeps live-mode cursor idempotent across repeated WS SYNC_SESSION echoes, preserves in_progress, detects stale conflicts, and wakes hook waiters', async () => {
    await fetch(`${baseUrl}${API_ROUTES.STATUS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setReviewMode', reviewMode: 'live' }),
    });

    const { ws, messages, waitForMessage } = await connectWsClient(wsUrl);
    try {
      await waitForMessage((m) => m.type === 'AGENT_STATUS');
      await waitForMessage((m) => m.type === 'SYNC_VARIANTS');

      const sessionPayload = {
        id: 'ws_live_1',
        timestamp: Date.now(),
        route: '/',
        status: 'draft',
        reviewMode: 'live',
        mutations: [],
        annotations: [
          {
            id: 'ann_ws_1',
            timestamp: 1000,
            type: 'element',
            targetSelector: '#hero-cta',
            comment: 'Make button primary violet',
          },
        ],
      };

      const submittedMsgPromise = waitForMessage(
        (m) => m.type === 'STATUS_CHANGE' && m.sessionId === 'ws_live_1' && m.payload?.status === 'submitted'
      );
      ws.send(JSON.stringify({ type: 'SYNC_SESSION', payload: sessionPayload }));
      await submittedMsgPromise;

      const statusAfterFirst = (await (await fetch(`${baseUrl}${API_ROUTES.STATUS}`)).json()) as {
        latestCursor: number;
        reviewMode: string;
        hasPendingReview: boolean;
      };
      expect(statusAfterFirst.reviewMode).toBe('live');
      expect(statusAfterFirst.hasPendingReview).toBe(true);
      const cursor1 = statusAfterFirst.latestCursor;
      expect(cursor1).toBeGreaterThan(0);

      // Count STATUS_CHANGE emissions so we also assert no ping-pong echo storms happen
      const statusCountBeforeEchoes = messages.filter(
        (m) => m.type === 'STATUS_CHANGE' && m.sessionId === 'ws_live_1'
      ).length;

      for (let i = 0; i < 3; i += 1) {
        ws.send(JSON.stringify({ type: 'SYNC_SESSION', payload: sessionPayload }));
      }
      await new Promise((r) => setTimeout(r, 120));

      const statusAfterEchoes = (await (await fetch(`${baseUrl}${API_ROUTES.STATUS}`)).json()) as {
        latestCursor: number;
      };
      expect(statusAfterEchoes.latestCursor).toBe(cursor1);
      expect(
        messages.filter((m) => m.type === 'STATUS_CHANGE' && m.sessionId === 'ws_live_1').length
      ).toBe(statusCountBeforeEchoes);

      // Claim session via GET /pending?claim=true -> transitions to in_progress
      const claimed = (await (await fetch(`${baseUrl}${API_ROUTES.PENDING}?claim=true`)).json()) as {
        id: string;
        status: string;
        revisionHash: string;
      };
      expect(claimed.id).toBe('ws_live_1');

      // Passive unchanged SYNC_SESSION must NOT overwrite in_progress or bump cursor
      ws.send(JSON.stringify({ type: 'SYNC_SESSION', payload: sessionPayload }));
      await new Promise((r) => setTimeout(r, 80));

      const store = EventStore.getInstance(rootDir);
      expect(store.getSession('ws_live_1')?.status).toBe('in_progress');
      expect(store.getLatestCursor()).toBe(cursor1);

      // Concurrent background hook Wait (seenCursor = cursor1) wakes when a NEW annotation streams in
      const hookWaitPromise = fetch(`${baseUrl}${API_ROUTES.HOOKS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          harness: 'claude-code',
          sessionId: 'wire_agent',
          event: 'Wait',
          seenCursor: cursor1,
          waitMs: 3000,
        }),
      }).then((r) => r.json() as Promise<{ feedbackAvailable: boolean; cursor: number; revisionHash?: string }>);

      await new Promise((r) => setTimeout(r, 40));
      ws.send(
        JSON.stringify({
          type: 'SYNC_SESSION',
          payload: {
            ...sessionPayload,
            annotations: [
              ...sessionPayload.annotations,
              {
                id: 'ann_ws_2',
                timestamp: 2000,
                type: 'element',
                targetSelector: '#hero-cta',
                comment: 'Also add subtle border radius',
              },
            ],
          },
        })
      );

      const wokeHook = await hookWaitPromise;
      expect(wokeHook.feedbackAvailable).toBe(true);
      expect(wokeHook.cursor).toBeGreaterThan(cursor1);
      expect(wokeHook.revisionHash).not.toBe(claimed.revisionHash);

      // Old expectedHash fails with 409 staleConflict
      const staleRes = await fetch(`${baseUrl}${API_ROUTES.STATUS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          sessionId: 'ws_live_1',
          expectedHash: claimed.revisionHash,
          modifiedSelectors: ['#hero-cta'],
        }),
      });
      expect(staleRes.status).toBe(409);

      // Resolving with newest hash pushes verificationTargets to browser over WS
      const haloPromise = waitForMessage(
        (m) => m.type === 'STATUS_CHANGE' && m.sessionId === 'ws_live_1' && m.payload?.status === 'implemented'
      );
      const resolveRes = await fetch(`${baseUrl}${API_ROUTES.STATUS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          sessionId: 'ws_live_1',
          expectedHash: wokeHook.revisionHash,
          modifiedSelectors: ['#hero-cta'],
          reply: 'Applied violet style and border radius',
        }),
      });
      expect(resolveRes.status).toBe(200);

      const haloMsg = await haloPromise;
      expect(Array.isArray(haloMsg.payload?.verificationTargets)).toBe(true);
    } finally {
      ws.close();
    }
  });

  it('holds drafts in batch mode until explicit SUBMIT_BATCH and bridges visual capture over WebSocket', async () => {
    const { ws, waitForMessage } = await connectWsClient(wsUrl);
    try {
      await waitForMessage((m) => m.type === 'AGENT_STATUS');
      await waitForMessage((m) => m.type === 'SYNC_VARIANTS');

      // 1. Batch draft via WS stays non-submitted in /status and invisible to hook PreInvocation
      ws.send(
        JSON.stringify({
          type: 'SYNC_SESSION',
          payload: {
            id: 'ws_batch_1',
            timestamp: Date.now(),
            route: '/',
            status: 'draft',
            reviewMode: 'batch',
            mutations: [{ id: 'm1', type: 'TEXT_EDIT', targetSelector: '#hero-cta', before: 'Start', after: 'Go' }],
          },
        })
      );
      await new Promise((r) => setTimeout(r, 80));

      const draftStatus = (await (await fetch(`${baseUrl}${API_ROUTES.STATUS}`)).json()) as {
        hasPendingReview: boolean;
        latestCursor: number;
      };
      expect(draftStatus.hasPendingReview).toBe(false);

      const hookPre = (await (
        await fetch(`${baseUrl}${API_ROUTES.HOOKS}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            harness: 'claude-code',
            sessionId: 'wire_batch_agent',
            event: 'PreInvocation',
            seenCursor: 0,
          }),
        })
      ).json()) as { feedbackAvailable: boolean };
      expect(hookPre.feedbackAvailable).toBe(false);

      // 2. Explicit SUBMIT_BATCH wakes long-poll GET /pending?waitMs=3000&afterCursor=<draftCursor>
      const pendingWaitPromise = fetch(
        `${baseUrl}${API_ROUTES.PENDING}?waitMs=3000&afterCursor=${draftStatus.latestCursor}`
      ).then((r) => r.json() as Promise<{ id: string; status: string } | null>);
      await new Promise((r) => setTimeout(r, 40));

      ws.send(
        JSON.stringify({
          type: 'SUBMIT_BATCH',
          payload: {
            id: 'ws_batch_1',
            timestamp: Date.now(),
            route: '/',
            status: 'submitted',
            reviewMode: 'batch',
            mutations: [{ id: 'm1', type: 'TEXT_EDIT', targetSelector: '#hero-cta', before: 'Start', after: 'Go' }],
          },
        })
      );

      const submittedBatch = await pendingWaitPromise;
      expect(submittedBatch?.id).toBe('ws_batch_1');
      expect(submittedBatch?.status).toBe('submitted');

      // 3. Visual Capture request over HTTP bridges through WS to browser and returns screenshot
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as WsEventMessage;
        const reqPayload = msg.payload as { requestId?: string } | undefined;
        if (msg.type === 'CAPTURE_REQUEST' && reqPayload?.requestId) {
          ws.send(
            JSON.stringify({
              type: 'CAPTURE_RESPONSE',
              payload: {
                requestId: reqPayload.requestId,
                success: true,
                imageBase64: 'data:image/png;base64,iVBORw0KGgo=',
                width: 320,
                height: 120,
                selector: '#hero-cta',
                capturedAt: Date.now(),
              },
            })
          );
        }
      });

      const captureRes = await fetch(`${baseUrl}${API_ROUTES.CAPTURE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector: '#hero-cta', resolution: 'draft', timeoutMs: 2500 }),
      });
      expect(captureRes.status).toBe(200);
      const captureJson = (await captureRes.json()) as { success: boolean; imageBase64: string; width: number };
      expect(captureJson.success).toBe(true);
      expect(captureJson.imageBase64).toBe('data:image/png;base64,iVBORw0KGgo=');
      expect(captureJson.width).toBe(320);
    } finally {
      ws.close();
    }
  });
});
