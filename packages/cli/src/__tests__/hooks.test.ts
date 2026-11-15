import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {
  normalizeHookPayload,
  findLuxShellInvocation,
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
    expect(merged.hooks.PostToolUse).toHaveLength(2);

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

  it('generates Claude Code PostToolUse groups for lux MCP tools and Bash-launched lux servers', () => {
    const settingsPath = path.join(testDir, 'claude-settings.json');
    mergeHarnessHooksConfig(settingsPath, 'claude-code');
    // Re-running install must stay idempotent rather than stacking duplicate groups.
    mergeHarnessHooksConfig(settingsPath, 'claude-code');
    const { hooks } = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

    expect(hooks.PostToolUse).toEqual([
      {
        matcher: '.*lux.*',
        hooks: [{ type: 'command', command: 'lux-edit hook event --harness claude-code --event PostToolUse', timeout: 10 }],
      },
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: 'lux-edit hook event --harness claude-code --event PostToolUse',
            timeout: 10,
            if: 'Bash(*lux*)',
          },
        ],
      },
    ]);
    expect(hooks.Stop).toHaveLength(1);
    expect(hooks.Stop[0].matcher).toBeUndefined();
    expect(hooks.Stop[0].hooks[0].if).toBeUndefined();
  });

  it('generates a single tool-name regex matcher for Codex, which has no input-based filter', () => {
    const codexPath = path.join(testDir, 'codex-hooks.json');
    mergeHarnessHooksConfig(codexPath, 'codex');
    const { hooks } = JSON.parse(fs.readFileSync(codexPath, 'utf-8'));

    expect(hooks.PostToolUse).toHaveLength(1);
    expect(hooks.PostToolUse[0].matcher).toBe('^Bash$|lux');
    expect(hooks.PostToolUse[0].hooks[0].if).toBeUndefined();
    const re = new RegExp(hooks.PostToolUse[0].matcher);
    expect(re.test('Bash')).toBe(true);
    expect(re.test('mcp__lux__lux_get_pending_review')).toBe(true);
    expect(re.test('apply_patch')).toBe(false);
    expect(hooks.Interrupt).toHaveLength(1);
  });

  it('detects lux only in command position of a shell subcommand', () => {
    const cases: Array<[string, { subcommand: string } | null]> = [
      ['lux architecture.html --port 4321', { subcommand: '' }],
      ['cd app && lux http://localhost:5173', { subcommand: '' }],
      ['nohup lux ./index.html > /tmp/lux.log 2>&1 &', { subcommand: '' }],
      ['PORT=1 npx -y lux-edit@latest ./dist', { subcommand: '' }],
      ['pnpm exec lux .', { subcommand: '' }],
      ['/opt/homebrew/bin/lux index.html', { subcommand: '' }],
      ['env -u FOO lux ./index.html', { subcommand: '' }],
      ['timeout 10 lux ./index.html', { subcommand: '' }],
      ['lux --version && lux ./index.html', { subcommand: '' }],
      ['npx lux-edit hook wait', { subcommand: 'hook' }],
      ['lux init', { subcommand: 'init' }],
      ['lux --version', { subcommand: '--version' }],
      ['grep -rn lux packages/cli/src', null],
      ['cat $TMPDIR/lux.log', null],
      ['curl -s http://127.0.0.1:4321/lux', null],
      ['luxury-tool run', null],
      ['git commit -m "fix(hooks); lux bar"', null],
      ["python3 -c 'x = \"a; lux b\"'", null],
      ['', null],
    ];
    for (const [command, expected] of cases) {
      expect(findLuxShellInvocation(command), command).toEqual(expected);
    }
  });

  it('attaches PostToolUse only for real lux review commands and flags server launches', () => {
    const post = (tool_name: string, command: string) =>
      normalizeHookPayload(
        { session_id: 's1', cwd: testDir, tool_name, tool_input: { command } },
        'claude-code',
        'PostToolUse'
      );

    expect(post('Bash', 'grep -rn lux src')).toBeNull();
    expect(post('Bash', 'git commit -m "docs; lux workflow"')).toBeNull();
    expect(post('Bash', 'lux-edit hook event --harness claude-code --event Stop')).toBeNull();
    expect(post('Bash', 'lux init')).toBeNull();
    expect(post('Bash', 'lux --version')).toBeNull();
    expect(post('Bash', 'lux index.html --port 4321')?.isServerLaunch).toBe(true);
    expect(post('Bash', 'cd apps/web && lux index.html')?.extraMetadataDirs).toEqual([path.join(testDir, 'apps/web')]);
    expect(post('Bash', 'lux . --root custom-root')?.extraMetadataDirs).toEqual([path.join(testDir, 'custom-root')]);
    expect(post('Bash', 'npx lux-edit hook wait')?.isServerLaunch).toBe(false);
    expect(post('mcp__lux__lux_get_pending_review', '')?.isServerLaunch).toBe(false);
    expect(post('Edit', 'lux')).toBeNull();
  });

  it('binds the lease after a cd-prefixed backgrounded lux server writes subdirectory metadata', async () => {
    const posts: any[] = [];
    const server = http.createServer((req, res) => {
      if (req.url === '/__visual_edit__/api/hooks' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          posts.push(JSON.parse(body));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ listening: true }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const appDir = path.join(testDir, 'sub-app');
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    try {
      setTimeout(() => {
        fs.mkdirSync(path.join(appDir, '.visual-edit'), { recursive: true });
        fs.writeFileSync(
          path.join(appDir, '.visual-edit', 'server.json'),
          JSON.stringify({ pid: process.pid, port, url: `http://127.0.0.1:${port}` })
        );
      }, 40);

      const out = await handleHookEvent(
        { session_id: 'claude_cd_launch', cwd: testDir, tool_name: 'Bash', tool_input: { command: 'cd sub-app && lux index.html' } },
        { harness: 'claude-code', event: 'PostToolUse', serverLaunchWaitMs: 1500, serverLaunchRetryMs: 20 }
      );

      expect(out).toEqual({});
      expect(posts.at(-1)).toMatchObject({ event: 'PostToolUse', sessionId: 'claude_cd_launch', harness: 'claude-code' });
    } finally {
      cwdSpy.mockRestore();
      server.close();
    }
  });

  it('binds the lease once a backgrounded lux server comes up, retrying until it accepts', async () => {
    const posts: any[] = [];
    let ready = false;
    const server = http.createServer((req, res) => {
      if (req.url === '/__visual_edit__/api/hooks' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          posts.push(JSON.parse(body));
          if (!ready) {
            res.writeHead(503);
            res.end();
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ listening: true }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    setTimeout(() => {
      ready = true;
    }, 150);
    // Metadata discovery also falls back to process.cwd(); keep it away from any real lux server in the repo.
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    try {
      // No metadata yet: the hook must not fall back to the default port, then picks the server up once it is written.
      setTimeout(() => {
        fs.mkdirSync(path.join(testDir, '.visual-edit'), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, '.visual-edit', 'server.json'),
          JSON.stringify({ pid: process.pid, port, url: `http://127.0.0.1:${port}` })
        );
      }, 60);

      const out = await handleHookEvent(
        { session_id: 'claude_launch', cwd: testDir, tool_name: 'Bash', tool_input: { command: 'lux index.html --port 0' } },
        { harness: 'claude-code', event: 'PostToolUse', serverLaunchWaitMs: 2000, serverLaunchRetryMs: 25 }
      );

      expect(out).toEqual({});
      expect(ready).toBe(true);
      expect(posts.at(-1)).toMatchObject({ event: 'PostToolUse', sessionId: 'claude_launch', harness: 'claude-code' });
    } finally {
      cwdSpy.mockRestore();
      server.close();
    }
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
