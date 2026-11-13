import fs from 'node:fs';
import path from 'node:path';
import {
  API_ROUTES,
  DEFAULT_SERVER_URL,
  SERVER_METADATA_DIR,
  SERVER_METADATA_FILE,
  LuxServerMetadata,
  stripTrailingSlashes,
} from '@visual-edit/core';
import type { HookHarness, HookEventName } from './hook-config.js';

export {
  getAntigravityHooksContent,
  mergeHarnessHooksConfig,
  removeHarnessHooksConfig,
  type HookHarness,
  type HookEventName,
} from './hook-config.js';

export type ConcreteHookHarness = 'antigravity' | 'claude-code' | 'codex' | 'claude';

export interface RawHookPayload {
  hook_event_name?: HookEventName;
  event?: HookEventName;
  conversationId?: string;
  conversation_id?: string;
  session_id?: string;
  sessionId?: string;
  workspacePaths?: string[];
  cwd?: string;
  workspaceDir?: string;
  toolCall?: { name?: string; args?: Record<string, unknown>; arguments?: Record<string, unknown> };
  tool_name?: string;
  toolName?: string;
  tool_input?: Record<string, unknown>;
  toolInput?: Record<string, unknown>;
  tool_response?: unknown;
  toolResponse?: unknown;
  terminationReason?: string;
  termination_reason?: string;
  continuationActive?: boolean;
  [key: string]: unknown;
}

export interface HookServerStatusResponse {
  waiterConnected?: boolean;
  hasPendingReview?: boolean;
  connectedClients?: number;
  hookLease?: {
    connected?: boolean;
    sessionId?: string;
    waiterConnected?: boolean;
  };
}

export interface HookApiResponse {
  listening?: boolean;
  endedByUser?: boolean;
  feedbackAvailable?: boolean;
  reason?: string;
  cursor?: number;
  superseded?: boolean;
}

export type HookDecisionOutput =
  | Record<string, never>
  | { decision: 'continue' | 'block'; reason: string }
  | { injectSteps: Array<{ systemMessage: { systemMessage: string } }> };

export interface NormalizedHookInput {
  harness: ConcreteHookHarness;
  event: HookEventName;
  sessionId: string;
  workspaceDir: string;
  cwd: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResponse?: unknown;
  seenCursor?: number;
  terminationReason?: string;
  stopReason?: string;
}

const NON_CONTINUABLE_STOP_REASONS = new Set([
  'USER_CANCELED',
  'USER_CANCELLED',
  'ERROR',
  'MAX_INVOCATIONS',
  'MAX_FORCED_INVOCATIONS',
  'MAX_TOKEN_BUDGET_EXCEEDED',
  'TERMINAL_CUSTOM_HOOK',
]);

function extractCursorFromToolResponse(response: unknown): number | undefined {
  if (!response) return undefined;
  try {
    const str = typeof response === 'string' ? response : JSON.stringify(response);
    const match = str.match(/"nextCursor"\s*:\s*(\d+)/) || str.match(/"latestCursor"\s*:\s*(\d+)/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // Non-serializable or non-cursor tool response; continue without cursor.
  }
  return undefined;
}

/**
 * Normalizes stdin payload from Google Antigravity (camelCase), Claude Code (snake_case),
 * or OpenAI Codex (snake_case) into a unified structure.
 */
export function normalizeHookPayload(
  rawPayload: RawHookPayload,
  harnessHint?: HookHarness,
  event?: HookEventName
): NormalizedHookInput | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;

  const eventName: HookEventName = event || rawPayload.hook_event_name || rawPayload.event || 'Stop';

  const isAntigravityShape =
    typeof rawPayload.conversationId === 'string' ||
    typeof rawPayload.conversation_id === 'string' ||
    Array.isArray(rawPayload.workspacePaths) ||
    typeof rawPayload.toolCall === 'object';

  const harness: ConcreteHookHarness =
    !harnessHint || harnessHint === 'auto'
      ? isAntigravityShape
        ? 'antigravity'
        : 'claude'
      : harnessHint;

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

  const toolName = String(rawPayload.toolCall?.name || rawPayload.tool_name || rawPayload.toolName || '');
  const toolInput = rawPayload.toolCall?.args || rawPayload.tool_input || rawPayload.toolInput || {};
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
    ? terminationReason.toLowerCase().includes('cancel')
      ? 'user'
      : terminationReason
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
            } catch (e: unknown) {
              if ((e as NodeJS.ErrnoException).code === 'ESRCH') continue;
            }
          }
          return stripTrailingSlashes(meta.url);
        }
      }
    } catch {
      // Metadata file missing, unreadable, or invalid; try next candidate directory.
    }
  }
  return DEFAULT_SERVER_URL;
}

async function fetchHookStatus(serverUrl: string, timeoutMs: number): Promise<HookServerStatusResponse | null> {
  const statusRes = await fetch(`${serverUrl}${API_ROUTES.STATUS}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!statusRes.ok) return null;
  return (await statusRes.json()) as HookServerStatusResponse;
}

function isSessionLeaseHolder(statusData: HookServerStatusResponse | null, sessionId: string): boolean {
  const lease = statusData?.hookLease;
  return Boolean(
    lease?.connected &&
      (!lease?.sessionId ||
        lease.sessionId === sessionId ||
        lease.sessionId === 'default' ||
        lease.sessionId === 'waiter')
  );
}

async function postHookApi(
  serverUrl: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<HookApiResponse | null> {
  const res = await fetch(`${serverUrl}${API_ROUTES.HOOKS}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  return (await res.json()) as HookApiResponse;
}

/** Formats the stdout JSON decision for the specific agent harness when feedback arrives on Stop. */
export function formatStopContinuationOutput(
  harness: ConcreteHookHarness,
  reason: string
): HookDecisionOutput {
  if (harness === 'antigravity') {
    return { decision: 'continue', reason };
  }
  // Claude Code & Codex use decision: "block" on Stop to continue the agent turn with reason
  return { decision: 'block', reason };
}

/**
 * Executes a single lifecycle hook event against the local lux server.
 * Fails open (`{}`) if the server is not running or if no review session is attached.
 */
export async function handleHookEvent(
  rawPayload: RawHookPayload,
  options: {
    harness?: HookHarness;
    event: HookEventName;
    serverUrl?: string;
    maxWaitMs?: number;
    pollTickMs?: number;
    forceLongPoll?: boolean;
  }
): Promise<HookDecisionOutput> {
  const normalized = normalizeHookPayload(rawPayload, options.harness || 'auto', options.event);
  if (!normalized) {
    return {};
  }

  if (normalized.event === 'Stop' && normalized.terminationReason && NON_CONTINUABLE_STOP_REASONS.has(normalized.terminationReason)) {
    return {};
  }

  const serverUrl = resolveRunningServerUrl(normalized.workspaceDir, options.serverUrl);
  if (!serverUrl) {
    return {};
  }

  if (normalized.event === 'PreInvocation') {
    try {
      const statusData = await fetchHookStatus(serverUrl, 800);
      if (!statusData) return {};
      const waiterConnected = Boolean(statusData?.waiterConnected ?? statusData?.hookLease?.waiterConnected);
      if (!isSessionLeaseHolder(statusData, normalized.sessionId) || !statusData?.hasPendingReview || waiterConnected) {
        return {};
      }

      const result = await postHookApi(
        serverUrl,
        {
          harness: normalized.harness,
          sessionId: normalized.sessionId,
          event: 'PreInvocation',
          waitMs: 0,
        },
        1200
      );
      if (result?.feedbackAvailable === true && typeof result.reason === 'string' && result.reason) {
        return {
          injectSteps: [{ systemMessage: { systemMessage: result.reason } }],
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
      const statusData = await fetchHookStatus(serverUrl, 1000);
      if (!statusData || !isSessionLeaseHolder(statusData, normalized.sessionId)) {
        return {};
      }

      // Antigravity Non-Blocking Stop Architecture: uses `lux-edit hook wait` rather than holding Stop open.
      if (normalized.harness === 'antigravity' && !options.forceLongPoll) {
        const waiterConnected = Boolean(statusData?.waiterConnected ?? statusData?.hookLease?.waiterConnected);
        if (statusData?.hasPendingReview) {
          const result = await postHookApi(
            serverUrl,
            {
              harness: normalized.harness,
              sessionId: normalized.sessionId,
              event: 'Stop',
              seenCursor: normalized.seenCursor,
              waitMs: 0,
            },
            2500
          );
          if (result?.feedbackAvailable === true && typeof result.reason === 'string' && result.reason) {
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

      const result = await postHookApi(
        serverUrl,
        {
          harness: normalized.harness,
          sessionId: normalized.sessionId,
          event: normalized.event,
          seenCursor: normalized.seenCursor,
          waitMs: currentWaitMs,
        },
        currentWaitMs + 2500
      );

      if (!result || normalized.event !== 'Stop') {
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

      const result = await postHookApi(
        serverUrl,
        {
          harness,
          sessionId,
          event: 'Wait',
          waiterId,
          seenCursor,
          waitMs: currentWaitMs,
        },
        currentWaitMs + 3000
      );

      if (!result) {
        return { feedbackAvailable: false };
      }

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

export async function readStdinJson(): Promise<RawHookPayload> {
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
