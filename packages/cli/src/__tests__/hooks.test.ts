import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {
  normalizeHookPayload,
  formatStopContinuationOutput,
  mergeHarnessHooksConfig,
  removeHarnessHooksConfig,
  getAntigravityHooksContent,
  handleHookEvent,
  handleHookWait,
} from '../hooks.js';

describe('Multi-Harness Lifecycle Hooks (Antigravity, Claude Code, Codex)', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `lux-hooks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('normalizes Antigravity camelCase hook payloads', () => {
    const normalized = normalizeHookPayload(
      {
        conversationId: 'agy_conv_1',
        workspacePaths: ['/Users/david/project'],
        toolCall: {
          name: 'mcp:lux:lux_get_pending_review',
          arguments: { workspaceDir: '/Users/david/project' },
        },
        terminationReason: 'USER_CANCELLED',
      },
      'antigravity',
      'Stop'
    );

    expect(normalized).not.toBeNull();
    expect(normalized!.harness).toBe('antigravity');
    expect(normalized!.event).toBe('Stop');
    expect(normalized!.sessionId).toBe('agy_conv_1');
    expect(normalized!.cwd).toBe('/Users/david/project');
    expect(normalized!.toolName).toBe('mcp:lux:lux_get_pending_review');
    expect(normalized!.stopReason).toBe('user');
  });

  it('normalizes Claude Code and Codex snake_case hook payloads', () => {
    const normalized = normalizeHookPayload(
      {
        session_id: 'claude_sess_9',
        cwd: '/Users/david/repo',
        hook_event_name: 'PostToolUse',
        tool_name: 'mcp__lux__lux_resolve_review',
        tool_input: { sessionId: 'b1' },
      },
      undefined,
      undefined
    );

    expect(normalized).not.toBeNull();
    expect(normalized!.harness).toBe('claude');
    expect(normalized!.event).toBe('PostToolUse');
    expect(normalized!.sessionId).toBe('claude_sess_9');
    expect(normalized!.cwd).toBe('/Users/david/repo');
    expect(normalized!.toolName).toBe('mcp__lux__lux_resolve_review');
  });

  it('formats Stop continuation decisions per harness specification', () => {
    const agyOut = formatStopContinuationOutput('antigravity', 'New feedback #1');
    expect(agyOut).toEqual({
      decision: 'continue',
      reason: 'New feedback #1',
    });

    const claudeOut = formatStopContinuationOutput('claude-code', 'New feedback #1');
    expect(claudeOut).toEqual({
      decision: 'block',
      reason: 'New feedback #1',
    });

    const codexOut = formatStopContinuationOutput('codex', 'New feedback #1');
    expect(codexOut).toEqual({
      decision: 'block',
      reason: 'New feedback #1',
    });
  });

  it('merges and removes Antigravity hooks.json non-destructively', () => {
    const hooksPath = path.join(testDir, 'hooks.json');
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({
        'custom-hook': {
          Stop: [{ type: 'command', command: 'echo hi' }],
        },
      })
    );

    mergeHarnessHooksConfig(hooksPath, 'antigravity');
    const merged = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    expect(merged['custom-hook']).toBeDefined();
    expect(merged['lux-live-review']).toBeDefined();
    expect(merged['lux-live-review'].PostToolUse[0].matcher).toBe('.*lux.*');
    expect(merged['lux-live-review'].Stop[0].command).toContain('lux-edit hook event --harness antigravity --event Stop');

    removeHarnessHooksConfig(hooksPath, 'antigravity');
    const afterRemove = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    expect(afterRemove['custom-hook']).toBeDefined();
    expect(afterRemove['lux-live-review']).toBeUndefined();
  });

  it('merges and removes Claude Code settings.json and Codex hooks.json non-destructively', () => {
    const settingsPath = path.join(testDir, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        theme: 'dark',
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'echo other' }] }],
        },
      })
    );

    mergeHarnessHooksConfig(settingsPath, 'claude');
    const merged = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(merged.theme).toBe('dark');
    expect(merged.hooks.Stop).toHaveLength(2);
    expect(merged.hooks.PostToolUse).toHaveLength(1);

    removeHarnessHooksConfig(settingsPath, 'claude');
    const afterRemove = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(afterRemove.theme).toBe('dark');
    expect(afterRemove.hooks.Stop).toHaveLength(1);
    expect(afterRemove.hooks.PostToolUse).toBeUndefined();
  });

  it('generates valid Antigravity hooks.json content', () => {
    const parsed = getAntigravityHooksContent(false);
    expect(parsed['lux-live-review']).toBeDefined();
    expect(parsed['lux-live-review'].PostToolUse).toHaveLength(1);
    expect(parsed['lux-live-review'].Stop).toHaveLength(1);
  });

  it('normalizes Antigravity hook with conversation_id or missing sessionId', () => {
    const normalized = normalizeHookPayload(
      {
        conversation_id: 'conv_snake_123',
        cwd: '/Users/david/project',
      },
      'antigravity',
      'Stop'
    );
    expect(normalized).not.toBeNull();
    expect(normalized!.sessionId).toBe('conv_snake_123');

    const defaultSess = normalizeHookPayload(
      {
        cwd: '/Users/david/project',
      },
      'antigravity',
      'Stop'
    );
    expect(defaultSess).not.toBeNull();
    expect(defaultSess!.sessionId).toBe('default');
  });

  it('enforces session affinity and non-blocking Stop in Antigravity while supporting long-poll in Claude/Codex and background Wait', async () => {
    let statusResponse: any = {
      hookLease: { connected: true, sessionId: 'agent_session_A', waiterConnected: true },
      waiterConnected: true,
      reviewMode: 'live',
      connectedClients: 1,
      hasPendingReview: false,
    };
    let hookResponse: any = {
      listening: true,
      feedbackAvailable: false,
      cursor: 1,
    };

    const server = http.createServer((req, res) => {
      if (req.url === '/__visual_edit__/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(statusResponse));
        return;
      }
      if (req.url === '/__visual_edit__/api/hooks' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(hookResponse));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const serverUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Unrelated Session B Stop hook must exit immediately with {}
      const resultB = await handleHookEvent(
        { conversationId: 'agent_session_B', workspacePaths: [testDir] },
        { harness: 'antigravity', event: 'Stop', serverUrl }
      );
      expect(resultB).toEqual({});

      // 2. Unbound lease (connected: false) must NEVER be claimed by Stop in any harness
      statusResponse = {
        hookLease: { connected: false, sessionId: undefined },
        reviewMode: 'live',
        connectedClients: 1,
        hasPendingReview: false,
      };
      const resultUnboundClaude = await handleHookEvent(
        { session_id: 'claude_unbound', cwd: testDir },
        { harness: 'claude-code', event: 'Stop', serverUrl, maxWaitMs: 300, pollTickMs: 100 }
      );
      expect(resultUnboundClaude).toEqual({});

      // 3. Antigravity Session A with no pending review must exit immediately with {} (never locking UI in "Working")
      statusResponse = {
        hookLease: { connected: true, sessionId: 'agent_session_A', waiterConnected: true },
        waiterConnected: true,
        reviewMode: 'live',
        connectedClients: 1,
        hasPendingReview: false,
      };
      const resultAIdle = await handleHookEvent(
        { conversationId: 'agent_session_A', workspacePaths: [testDir] },
        { harness: 'antigravity', event: 'Stop', serverUrl }
      );
      expect(resultAIdle).toEqual({});

      // 4. Antigravity Session A WITH pending review immediately returns decision: "continue"
      statusResponse = {
        hookLease: { connected: true, sessionId: 'agent_session_A', waiterConnected: false },
        waiterConnected: false,
        reviewMode: 'batch',
        connectedClients: 1,
        hasPendingReview: true,
      };
      hookResponse = {
        listening: true,
        feedbackAvailable: true,
        cursor: 2,
        reason: '[LUX VISUAL REVIEW INTERRUPTION]\nApply batch edit.',
      };
      const resultAPending = await handleHookEvent(
        { conversationId: 'agent_session_A', workspacePaths: [testDir] },
        { harness: 'antigravity', event: 'Stop', serverUrl }
      );
      expect(resultAPending).toEqual({
        decision: 'continue',
        reason: '[LUX VISUAL REVIEW INTERRUPTION]\nApply batch edit.',
      });

      // 5. Claude Code bound session holds in Batch mode even with connectedClients === 0 and wakes on feedback
      statusResponse = {
        hookLease: { connected: true, sessionId: 'claude_session_A' },
        reviewMode: 'batch',
        connectedClients: 0,
        hasPendingReview: false,
      };
      hookResponse = {
        listening: true,
        feedbackAvailable: true,
        cursor: 3,
        reason: '[LUX VISUAL REVIEW INTERRUPTION]\nClaude batch wakeup.',
      };
      const resultClaudeWake = await handleHookEvent(
        { session_id: 'claude_session_A', cwd: testDir },
        { harness: 'claude-code', event: 'Stop', serverUrl, maxWaitMs: 500, pollTickMs: 100 }
      );
      expect(resultClaudeWake).toEqual({
        decision: 'block',
        reason: '[LUX VISUAL REVIEW INTERRUPTION]\nClaude batch wakeup.',
      });

      // 6. Background waiter (handleHookWait) wakes with feedback reason or exits cleanly when superseded
      const waitRes = await handleHookWait({
        harness: 'antigravity',
        sessionId: 'agent_session_A',
        workspaceDir: testDir,
        serverUrl,
        maxWaitMs: 500,
        pollTickMs: 100,
      });
      expect(waitRes.feedbackAvailable).toBe(true);
      expect(waitRes.reason).toContain('Claude batch wakeup.');
    } finally {
      server.close();
    }
  });
});
