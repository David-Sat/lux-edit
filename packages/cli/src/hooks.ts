import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  API_ROUTES,
  DEFAULT_SERVER_URL,
  SERVER_METADATA_DIR,
  SERVER_METADATA_FILE,
  LuxServerMetadata,
  stripTrailingSlashes,
} from '@visual-edit/core';

export type HookHarness = 'antigravity' | 'claude-code' | 'codex' | 'claude' | 'auto';
export type HookEventName = 'PostToolUse' | 'PreInvocation' | 'Stop' | 'SessionEnd' | 'Interrupt' | 'Wait';

export interface NormalizedHookInput {
  harness: 'antigravity' | 'claude-code' | 'codex' | 'claude';
  event: HookEventName;
  sessionId: string;
  workspaceDir: string;
  cwd: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResponse?: any;
  seenCursor?: number;
  terminationReason?: string;
  stopReason?: string;
}

export function getAntigravityHooksContent(autoUpdate: boolean = false) {
  const cmd = autoUpdate ? 'npx -y lux-edit@latest' : 'lux-edit';
  return {
    'lux-live-review': {
      PreInvocation: [
        {
          type: 'command',
          command: `${cmd} hook event --harness antigravity --event PreInvocation`,
          timeout: 5,
        },
      ],
      PostToolUse: [
        {
          matcher: '.*lux.*',
          hooks: [
            {
              type: 'command',
              command: `${cmd} hook event --harness antigravity --event PostToolUse`,
              timeout: 10,
            },
          ],
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `${cmd} hook event --harness antigravity --event Stop`,
          timeout: 600,
        },
      ],
    },
  };
}

function isGeneratedHookCommand(cmd: unknown): boolean {
  if (typeof cmd !== 'string') return false;
  return cmd.includes('lux-edit') && cmd.includes('hook event');
}

/**
 * Merges Claude Code or Codex hook definitions into ~/.claude/settings.json,
 * .claude/settings.local.json, or .codex/hooks.json while preserving user settings.
 */
export function mergeHarnessHooksConfig(
  filePath: string,
  harness: 'antigravity' | 'claude-code' | 'codex' | 'claude',
  dryRun: boolean = false,
  autoUpdate: boolean = false
): boolean {
  try {
    let data: Record<string, any> = {};
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (raw) {
        data = JSON.parse(raw);
      }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    if (harness === 'antigravity') {
      const agyContent = getAntigravityHooksContent(autoUpdate);
      Object.assign(data, agyContent);
      if (!dryRun) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        fs.renameSync(tempPath, filePath);
      }
      return true;
    }

    if (!data.hooks || typeof data.hooks !== 'object' || Array.isArray(data.hooks)) {
      data.hooks = {};
    }

    const pkg = autoUpdate ? 'lux-edit@latest' : 'lux-edit';
    const cmd = autoUpdate ? `npx -y ${pkg}` : 'lux-edit';
    const normalizedHarness = harness === 'claude' ? 'claude' : harness;
    const events: Array<{ event: HookEventName; timeout: number; matcher?: string }> = [
      { event: 'PostToolUse', timeout: 10, matcher: '.*lux.*' },
      { event: 'Stop', timeout: 600 },
      { event: 'SessionEnd', timeout: 3 },
    ];
    if (harness === 'codex') {
      events.push({ event: 'Interrupt', timeout: 3 });
    }

    for (const { event, timeout, matcher } of events) {
      const existingList = Array.isArray(data.hooks[event]) ? data.hooks[event] : [];
      const cleaned = existingList
        .map((group: any) => {
          if (!group || typeof group !== 'object' || !Array.isArray(group.hooks)) return group;
          const kept = group.hooks.filter((h: any) => !isGeneratedHookCommand(h?.command));
          if (kept.length === 0) return null;
          return { ...group, hooks: kept };
        })
        .filter(Boolean);

      const newEntry: Record<string, any> = {
        hooks: [
          {
            type: 'command',
            command: `${cmd} hook event --harness ${normalizedHarness} --event ${event}`,
            timeout,
          },
        ],
      };
      if (matcher) {
        newEntry.matcher = matcher;
      }
      cleaned.push(newEntry);
      data.hooks[event] = cleaned;
    }

    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      fs.renameSync(tempPath, filePath);
    }
    return true;
  } catch {
    return false;
  }
}

export function removeHarnessHooksConfig(
  filePath: string,
  harnessOrDryRun?: string | boolean,
  dryRunOpt: boolean = false
): boolean {
  try {
    const dryRun = typeof harnessOrDryRun === 'boolean' ? harnessOrDryRun : dryRunOpt;
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return false;
    }

    let modified = false;

    if (data['lux-live-review']) {
      delete data['lux-live-review'];
      modified = true;
    }

    if (data.hooks && typeof data.hooks === 'object') {
      for (const event of Object.keys(data.hooks)) {
        const list = data.hooks[event];
        if (!Array.isArray(list)) continue;
        const cleaned = list
          .map((group: any) => {
            if (!group || typeof group !== 'object' || !Array.isArray(group.hooks)) return group;
            const kept = group.hooks.filter((h: any) => !isGeneratedHookCommand(h?.command));
            if (kept.length !== group.hooks.length) {
              modified = true;
            }
            if (kept.length === 0) return null;
            return { ...group, hooks: kept };
          })
          .filter(Boolean);

        if (cleaned.length === 0) {
          delete data.hooks[event];
        } else {
          data.hooks[event] = cleaned;
        }
      }

      if (Object.keys(data.hooks).length === 0) {
        delete data.hooks;
      }
    }

    if (modified && !dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    }
    return modified;
  } catch {
    return false;
  }
}

function extractCursorFromToolResponse(response: any): number | undefined {
  if (!response) return undefined;
  try {
    const str = typeof response === 'string' ? response : JSON.stringify(response);
    const match = str.match(/"nextCursor"\s*:\s*(\d+)/) || str.match(/"latestCursor"\s*:\s*(\d+)/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {}
  return undefined;
}

/**
 * Normalizes stdin payload from Google Antigravity (camelCase), Claude Code (snake_case),
 * or OpenAI Codex (snake_case) into a unified structure.
 */
export function normalizeHookPayload(
  rawPayload: Record<string, any>,
  harnessHint?: HookHarness,
  event?: HookEventName
): NormalizedHookInput | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;

  const eventName: HookEventName = event || rawPayload.hook_event_name || rawPayload.event || 'Stop';

  // Detect harness from payload shape if 'auto'
  const isAntigravityShape =
    typeof rawPayload.conversationId === 'string' ||
    typeof rawPayload.conversation_id === 'string' ||
    Array.isArray(rawPayload.workspacePaths) ||
    typeof rawPayload.toolCall === 'object';

  const harness: 'antigravity' | 'claude-code' | 'codex' | 'claude' =
    !harnessHint || harnessHint === 'auto'
      ? isAntigravityShape
        ? 'antigravity'
        : 'claude'
      : (harnessHint as any);

  const sessionId = String(
    rawPayload.conversationId ||
    rawPayload.conversation_id ||
    rawPayload.session_id ||
    rawPayload.sessionId ||
    'default'
  ).trim();

  const workspaceDir =
    (Array.isArray(rawPayload.workspacePaths) && rawPayload.workspacePaths[0]) ||
    rawPayload.cwd ||
    rawPayload.workspaceDir ||
    process.cwd();

  const toolName = String(
    rawPayload.toolCall?.name || rawPayload.tool_name || rawPayload.toolName || ''
  );
  const toolInput =
    rawPayload.toolCall?.args || rawPayload.tool_input || rawPayload.toolInput || {};
  const toolResponse = rawPayload.tool_response || rawPayload.toolResponse;
  const terminationReason = rawPayload.terminationReason || rawPayload.termination_reason;

  // For PostToolUse, only attach if the tool call was a lux tool or a command invoking lux
  if (eventName === 'PostToolUse') {
    const lowerTool = toolName.toLowerCase();
    const cmdStr = String(toolInput?.CommandLine || toolInput?.command || '').toLowerCase();
    const isLuxCommand =
      (lowerTool === 'run_command' || lowerTool === 'bash') &&
      /\b(lux-edit|lux)\b/.test(cmdStr) &&
      !cmdStr.includes('hook event');
    if (!lowerTool.includes('lux') && !isLuxCommand) {
      return null;
    }
  }

  const seenCursor = extractCursorFromToolResponse(toolResponse);
  const stopReason = terminationReason
    ? (terminationReason.toLowerCase().includes('cancel') ? 'user' : terminationReason)
    : undefined;

  return {
    harness,
    event: eventName,
    sessionId,
    workspaceDir: typeof workspaceDir === 'string' ? workspaceDir : process.cwd(),
    cwd: typeof workspaceDir === 'string' ? workspaceDir : process.cwd(),
    toolName,
    toolInput,
    toolResponse,
    seenCursor,
    terminationReason,
    stopReason,
  };
}

function resolveRunningServerUrl(workspaceDir?: string, explicitUrl?: string): string | null {
  if (explicitUrl && explicitUrl.trim()) {
    return stripTrailingSlashes(explicitUrl.trim());
  }
  const candidates = [workspaceDir, process.cwd()].filter(Boolean) as string[];
  for (const dir of candidates) {
    try {
      const metaPath = path.join(path.resolve(dir), SERVER_METADATA_DIR, SERVER_METADATA_FILE);
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as LuxServerMetadata;
        if (meta && meta.url) {
          if (meta.pid) {
            try {
              process.kill(meta.pid, 0);
            } catch (e: any) {
              if (e.code === 'ESRCH') continue;
            }
          }
          return stripTrailingSlashes(meta.url);
        }
      }
    } catch {}
  }
  return DEFAULT_SERVER_URL;
}

/**
 * Formats the stdout JSON decision for the specific agent harness when feedback arrives on Stop.
 */
export function formatStopContinuationOutput(
  harness: 'antigravity' | 'claude-code' | 'codex' | 'claude',
  reason: string
): Record<string, any> {
  if (harness === 'antigravity') {
    return {
      decision: 'continue',
      reason,
    };
  }
  // Claude Code & Codex use decision: "block" on Stop to continue the agent turn with reason
  return {
    decision: 'block',
    reason,
  };
}

/**
 * Executes a single lifecycle hook event against the local lux server.
 * Fails open (`{}`) if the server is not running or if no review session is attached.
 */
export async function handleHookEvent(
  rawPayload: Record<string, any>,
  options: {
    harness?: HookHarness;
    event: HookEventName;
    serverUrl?: string;
    maxWaitMs?: number;
    pollTickMs?: number;
    forceLongPoll?: boolean;
  }
): Promise<Record<string, any>> {
  const normalized = normalizeHookPayload(rawPayload, options.harness || 'auto', options.event);
  if (!normalized) {
    return {};
  }

  if (normalized.event === 'Stop' && normalized.terminationReason) {
    const nonContinuableReasons = new Set([
      'USER_CANCELED',
      'USER_CANCELLED',
      'ERROR',
      'MAX_INVOCATIONS',
      'MAX_FORCED_INVOCATIONS',
      'MAX_TOKEN_BUDGET_EXCEEDED',
      'TERMINAL_CUSTOM_HOOK',
    ]);
    if (nonContinuableReasons.has(normalized.terminationReason)) {
      return {};
    }
  }

  const serverUrl = resolveRunningServerUrl(normalized.workspaceDir, options.serverUrl);
  if (!serverUrl) {
    return {};
  }

  if (normalized.event === 'PreInvocation') {
    try {
      const statusRes = await fetch(`${serverUrl}${API_ROUTES.STATUS}`, {
        signal: AbortSignal.timeout(800),
      });
      if (!statusRes.ok) return {};
      const statusData = (await statusRes.json()) as any;
      const lease = statusData?.hookLease;
      const hasPendingReview = Boolean(statusData?.hasPendingReview);
      const waiterConnected = Boolean(statusData?.waiterConnected ?? lease?.waiterConnected);

      const isLeaseHolder = Boolean(
        lease?.connected &&
          (!lease?.sessionId ||
            lease.sessionId === normalized.sessionId ||
            lease.sessionId === 'default' ||
            lease.sessionId === 'waiter')
      );

      if (!isLeaseHolder || !hasPendingReview || waiterConnected) {
        return {};
      }

      const hookRes = await fetch(`${serverUrl}${API_ROUTES.HOOKS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          harness: normalized.harness,
          sessionId: normalized.sessionId,
          event: 'PreInvocation',
          waitMs: 0,
        }),
        signal: AbortSignal.timeout(1200),
      });
      if (!hookRes.ok) return {};
      const result = (await hookRes.json()) as any;
      if (result.feedbackAvailable === true && typeof result.reason === 'string' && result.reason) {
        return {
          injectSteps: [
            {
              systemMessage: {
                systemMessage: result.reason,
              },
            },
          ],
        };
      }
      return {};
    } catch {
      return {};
    }
  }

  // For Stop events, verify whether this session owns the review lease
  if (normalized.event === 'Stop') {
    try {
      const statusRes = await fetch(`${serverUrl}${API_ROUTES.STATUS}`, {
        signal: AbortSignal.timeout(1000),
      });
      if (!statusRes.ok) return {};
      const statusData = (await statusRes.json()) as any;
      const lease = statusData?.hookLease;
      const hasPendingReview = Boolean(statusData?.hasPendingReview);
      const waiterConnected = Boolean(statusData?.waiterConnected ?? lease?.waiterConnected);

      // Strict PostToolUse Lease Binding (Artifact-Studio pattern):
      // Stop NEVER claims an unbound lease and NEVER holds unrelated sessions.
      // Only a session that already bound the lease via PostToolUse (or background Wait) may proceed.
      const isLeaseHolder = Boolean(
        lease?.connected &&
          (!lease?.sessionId ||
            lease.sessionId === normalized.sessionId ||
            lease.sessionId === 'default' ||
            lease.sessionId === 'waiter')
      );
      if (!isLeaseHolder) {
        return {};
      }

      // Antigravity Non-Blocking Stop Architecture:
      // In Antigravity, holding Stop open keeps the conversation stuck in "Working" state
      // and blocks the user from chatting. Instead, Antigravity uses a background command
      // (`lux-edit hook wait` with IsDaemon: false) for Reactive Wakeup while idle.
      if (normalized.harness === 'antigravity' && !options.forceLongPoll) {
        if (hasPendingReview) {
          const res = await fetch(`${serverUrl}${API_ROUTES.HOOKS}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              harness: normalized.harness,
              sessionId: normalized.sessionId,
              event: 'Stop',
              seenCursor: normalized.seenCursor,
              waitMs: 0,
            }),
            signal: AbortSignal.timeout(2500),
          });
          if (!res.ok) return {};
          const result = (await res.json()) as any;
          if (result.feedbackAvailable === true && typeof result.reason === 'string' && result.reason) {
            return formatStopContinuationOutput(normalized.harness, result.reason);
          }
        } else if (
          !waiterConnected &&
          !rawPayload.continuationActive &&
          (statusData?.connectedClients ?? 0) > 0 &&
          options.maxWaitMs === undefined
        ) {
          return formatStopContinuationOutput(
            normalized.harness,
            `[LUX LIVE LISTENER REQUIRED]
A Lux review session is active, but no background review listener is running.
To enable seamless Live/Batch browser wakeups without locking the Antigravity chat input:
1. Run \`npx lux-edit hook wait\` via \`run_command\` with \`WaitMsBeforeAsync: 500\` and \`IsDaemon: false\`.
2. Immediately end your turn so the user can both chat here and interact in the browser.`
          );
        }
        return {};
      }
    } catch {
      return {};
    }
  }

  const maxWaitMs = options.maxWaitMs ?? 540_000; // 9 minutes max hold
  const pollTickMs = Math.min(options.pollTickMs ?? 25_000, maxWaitMs);
  const deadline = Date.now() + maxWaitMs;

  while (true) {
    try {
      const remainingMs = Math.max(200, deadline - Date.now());
      const currentWaitMs = normalized.event === 'Stop' ? Math.min(pollTickMs, remainingMs) : 0;

      const res = await fetch(`${serverUrl}${API_ROUTES.HOOKS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          harness: normalized.harness,
          sessionId: normalized.sessionId,
          event: normalized.event,
          seenCursor: normalized.seenCursor,
          waitMs: currentWaitMs,
        }),
        signal: AbortSignal.timeout(currentWaitMs + 2500),
      });

      if (!res.ok) return {};
      const result = (await res.json()) as any;

      if (normalized.event !== 'Stop') {
        return {};
      }

      if (result.listening !== true || result.endedByUser === true) {
        return {};
      }

      if (result.feedbackAvailable === true && typeof result.reason === 'string' && result.reason) {
        return formatStopContinuationOutput(normalized.harness, result.reason);
      }

      if (Date.now() >= deadline) {
        return {};
      }
    } catch {
      // Server stopped or unreachable: fail open so the agent session is never trapped
      return {};
    }
  }
}

/**
 * Long-polls the local lux server for visual review feedback from a background CLI task
 * (`lux-edit hook wait`). Used in Antigravity with `run_command` (`IsDaemon: false, WaitMsBeforeAsync: 500`)
 * so the conversation returns to Idle immediately while the background process wakes the agent via
 * Reactive Wakeup as soon as the user submits a batch or makes a Live edit/walkthrough.
 */
export async function handleHookWait(options: {
  harness?: HookHarness;
  sessionId?: string;
  workspaceDir?: string;
  serverUrl?: string;
  maxWaitMs?: number;
  pollTickMs?: number;
  waiterId?: string;
}): Promise<{ feedbackAvailable: boolean; reason?: string; cursor?: number; superseded?: boolean; endedByUser?: boolean }> {
  const workspaceDir = options.workspaceDir || process.cwd();
  const serverUrl = resolveRunningServerUrl(workspaceDir, options.serverUrl);
  if (!serverUrl) {
    return { feedbackAvailable: false };
  }

  const harness = !options.harness || options.harness === 'auto' ? 'antigravity' : options.harness;
  const sessionId = options.sessionId || 'waiter';
  const waiterId = options.waiterId || `waiter_${process.pid}_${Date.now()}`;
  const maxWaitMs = options.maxWaitMs ?? 3_600_000; // 60 minutes default
  const pollTickMs = Math.min(options.pollTickMs ?? 25_000, maxWaitMs);
  const deadline = Date.now() + maxWaitMs;
  let seenCursor: number | undefined;

  while (true) {
    try {
      const remainingMs = Math.max(200, deadline - Date.now());
      const currentWaitMs = Math.min(pollTickMs, remainingMs);

      const res = await fetch(`${serverUrl}${API_ROUTES.HOOKS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          harness,
          sessionId,
          event: 'Wait',
          waiterId,
          seenCursor,
          waitMs: currentWaitMs,
        }),
        signal: AbortSignal.timeout(currentWaitMs + 3000),
      });

      if (!res.ok) {
        return { feedbackAvailable: false };
      }

      const result = (await res.json()) as any;

      if (result.superseded === true) {
        return { feedbackAvailable: false, superseded: true };
      }

      if (result.endedByUser === true || result.listening === false) {
        return { feedbackAvailable: false, endedByUser: Boolean(result.endedByUser) };
      }

      if (typeof result.cursor === 'number') {
        seenCursor = result.cursor;
      }

      if (result.feedbackAvailable === true && typeof result.reason === 'string' && result.reason) {
        return {
          feedbackAvailable: true,
          reason: result.reason,
          cursor: result.cursor,
        };
      }

      if (Date.now() >= deadline) {
        return { feedbackAvailable: false };
      }
    } catch {
      if (Date.now() >= deadline) {
        return { feedbackAvailable: false };
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export async function readStdinJson(): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve({});
      return;
    }
    let raw = '';
    const timer = setTimeout(() => {
      resolve({});
    }, 1500);

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      try {
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve({});
    });
  });
}
