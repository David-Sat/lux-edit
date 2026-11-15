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
  /** True when a shell tool call started a lux review server (as opposed to an MCP call or a lux subcommand). */
  isServerLaunch?: boolean;
  /** Additional metadata directories inferred from `cd <dir>` or `lux --root <dir>` in shell commands. */
  extraMetadataDirs?: string[];
}

const SHELL_TOOL_NAMES = new Set(['bash', 'run_command', 'shell', 'exec_command']);
const LUX_BINARIES = new Set(['lux', 'lux-edit']);
const LUX_NON_SERVER_SUBCOMMANDS = new Set([
  'mcp',
  'hook',
  'init',
  'install',
  'update',
  'upgrade',
  'uninstall',
  'remove',
  'help',
  '-h',
  '--help',
  '-V',
  '--version',
]);
/** Launchers and wrappers that may precede the lux binary within one shell subcommand. */
const COMMAND_PREFIX_WORDS = new Set(['nohup', 'exec', 'env', 'command', 'time', 'sudo', 'npx', 'bunx', 'pnpx', 'dlx', 'timeout']);
const PACKAGE_RUNNER_WORDS = new Set(['pnpm', 'yarn', 'npm', 'bun']);
const PREFIX_FLAGS_WITH_VALUE = new Set(['-u', '--unset', '-p', '--package', '-C', '--chdir']);

export interface LuxShellInspection {
  subcommand: string;
  action?: string;
  metadataDirs: string[];
}

/** Splits a shell command into subcommand segments at control operators outside quotes/escapes. */
function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (quote === "'") {
      current += ch;
      if (ch === "'") quote = null;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (quote === '"') {
      current += ch;
      if (ch === '"') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    const next = command[i + 1];
    if ((ch === '&' && next === '&') || (ch === '|' && next === '|')) {
      segments.push(current);
      current = '';
      i++;
      continue;
    }
    if (ch === ';' || ch === '|' || ch === '\n' || ch === '(' || ch === ')' || (ch === '&' && command[i - 1] !== '>')) {
      segments.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments;
}

/** Tokenizes a single shell segment into unquoted words while preserving quoted substrings as single arguments. */
function tokenizeShellWords(segment: string): string[] {
  const words: string[] = [];
  let current = '';
  let hasToken = false;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (escaped) {
      current += ch;
      hasToken = true;
      escaped = false;
      continue;
    }
    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      hasToken = true;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      hasToken = true;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else current += ch;
      hasToken = true;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasToken = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasToken) {
        words.push(current);
        current = '';
        hasToken = false;
      }
      continue;
    }
    current += ch;
    hasToken = true;
  }
  if (hasToken) words.push(current);
  return words;
}

function extractRootArg(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--root' || arg === '-r') && args[i + 1]) {
      return args[i + 1];
    }
    if (arg.startsWith('--root=')) {
      return arg.slice('--root='.length);
    }
    if (arg.startsWith('-r=')) {
      return arg.slice('-r='.length);
    }
  }
  return undefined;
}

function inspectLuxShellCommand(command: string, baseDir?: string): LuxShellInspection | null {
  if (!command) return null;
  let activeDir = baseDir ? path.resolve(baseDir) : undefined;
  let cdMoved = false;
  let fallback: LuxShellInspection | null = null;

  for (const segment of splitShellSegments(command)) {
    const words = tokenizeShellWords(segment);
    if (words.length === 0) continue;

    if (activeDir && words[0] === 'cd') {
      let target: string | undefined;
      let pastFlags = false;
      for (let j = 1; j < words.length; j++) {
        if (!pastFlags && words[j] === '--') {
          pastFlags = true;
          continue;
        }
        if (!pastFlags && words[j].startsWith('-')) continue;
        target = words[j];
        break;
      }
      if (target && target !== '-') {
        activeDir = path.resolve(activeDir, target);
        cdMoved = true;
      }
      continue;
    }

    let i = 0;
    let sawPrefix = false;
    while (i < words.length) {
      const word = words[i];
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) {
        i++;
        continue;
      }
      if (word === 'timeout' && /^\d+(?:\.\d+)?[smhd]?$/.test(words[i + 1] ?? '')) {
        sawPrefix = true;
        i += 2;
        continue;
      }
      if (COMMAND_PREFIX_WORDS.has(word)) {
        sawPrefix = true;
        i++;
        continue;
      }
      if (PACKAGE_RUNNER_WORDS.has(word) && ['exec', 'dlx', 'x', 'run'].includes(words[i + 1] ?? '')) {
        sawPrefix = true;
        i += 2;
        continue;
      }
      if (sawPrefix && PREFIX_FLAGS_WITH_VALUE.has(word) && i + 1 < words.length) {
        i += 2;
        continue;
      }
      if (word.startsWith('-')) {
        i++;
        continue;
      }
      break;
    }

    const binary = words[i] ?? '';
    const baseName = (binary.split('/').pop() ?? '').replace(/@[^@]*$/, '');
    if (!LUX_BINARIES.has(baseName)) continue;

    const nextWord = words[i + 1];
    const subcommand = nextWord && LUX_NON_SERVER_SUBCOMMANDS.has(nextWord) ? nextWord : '';
    const action = subcommand === 'hook' ? words[i + 2] : undefined;

    const dirs: string[] = [];
    const rootArg = extractRootArg(words.slice(i + 1));
    if (rootArg) {
      dirs.push(activeDir ? path.resolve(activeDir, rootArg) : path.resolve(rootArg));
    }
    if (cdMoved && activeDir) {
      dirs.push(activeDir);
    }

    const inspection: LuxShellInspection = { subcommand, action, metadataDirs: dirs };
    // Prefer an explicit server launch over an earlier utility call like `lux --version && lux .`.
    if (subcommand === '') {
      return inspection;
    }
    if (!fallback) {
      fallback = inspection;
    }
  }
  return fallback;
}

/**
 * Finds a `lux` / `lux-edit` invocation in a shell command, scanning each subcommand separately outside
 * quotes and looking only at command position, so `grep -rn lux src` or `git commit -m "a; lux"` are
 * not treated as lux. Returns the lux subcommand (or `''` for a server launch), or `null` otherwise.
 */
export function findLuxShellInvocation(command: string): { subcommand: string } | null {
  const inspection = inspectLuxShellCommand(command);
  return inspection ? { subcommand: inspection.subcommand } : null;
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

  const rawWorkspaceDir =
    (Array.isArray(rawPayload.workspacePaths) && rawPayload.workspacePaths[0]) ||
    rawPayload.cwd ||
    rawPayload.workspaceDir ||
    process.cwd();
  const effectiveWorkspaceDir = typeof rawWorkspaceDir === 'string' ? rawWorkspaceDir : process.cwd();

  const toolName = String(rawPayload.toolCall?.name || rawPayload.tool_name || rawPayload.toolName || '');
  const toolInput = rawPayload.toolCall?.args || rawPayload.tool_input || rawPayload.toolInput || {};
  const toolResponse = rawPayload.tool_response || rawPayload.toolResponse;
  const terminationReason = rawPayload.terminationReason || rawPayload.termination_reason;

  // For PostToolUse, only attach if the tool call was a lux tool or a session-binding lux shell command.
  // Harness matchers are only coarse prefilters (Claude Code's `Bash` matcher fires for every shell call).
  let isServerLaunch = false;
  let extraMetadataDirs: string[] | undefined;
  if (eventName === 'PostToolUse') {
    const lowerTool = toolName.toLowerCase();
    if (SHELL_TOOL_NAMES.has(lowerTool)) {
      const command = String(toolInput?.CommandLine || toolInput?.command || '');
      const inspection = inspectLuxShellCommand(command, effectiveWorkspaceDir);
      if (!inspection) return null;
      const isReviewAction =
        inspection.subcommand === '' ||
        inspection.subcommand === 'mcp' ||
        (inspection.subcommand === 'hook' && inspection.action === 'wait');
      if (!isReviewAction) return null;
      isServerLaunch = inspection.subcommand === '';
      if (inspection.metadataDirs.length > 0) {
        extraMetadataDirs = inspection.metadataDirs;
      }
    } else if (!lowerTool.includes('lux')) {
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
    workspaceDir: effectiveWorkspaceDir,
    cwd: effectiveWorkspaceDir,
    toolName,
    toolInput,
    toolResponse,
    seenCursor,
    terminationReason,
    stopReason,
    isServerLaunch,
    extraMetadataDirs,
  };
}

function resolveRunningServerUrl(workspaceDir?: string, explicitUrl?: string): string | null {
  if (explicitUrl && explicitUrl.trim()) {
    return stripTrailingSlashes(explicitUrl.trim());
  }
  return resolveServerUrlFromMetadata(workspaceDir) ?? DEFAULT_SERVER_URL;
}

/** Reads `.visual-edit/server.json` written by a live lux server; never guesses a default port. */
function resolveServerUrlFromMetadata(workspaceDir?: string, extraDirs: string[] = []): string | null {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const dir of [...extraDirs, workspaceDir, process.cwd()]) {
    if (!dir) continue;
    const resolved = path.resolve(dir);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      candidates.push(resolved);
    }
  }
  for (const dir of candidates) {
    try {
      const metaPath = path.join(dir, SERVER_METADATA_DIR, SERVER_METADATA_FILE);
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
  return null;
}

/**
 * A shell call that launches lux in the background returns before the server has bound its port,
 * so the first PostToolUse can arrive too early. Retry briefly (within the 10s hook timeout) until
 * the new server writes its metadata and accepts the lease binding. Only metadata-discovered URLs
 * are tried, so an unrelated app that happens to own the default port is never contacted.
 */
async function bindLeaseAfterServerLaunch(
  normalized: NormalizedHookInput,
  explicitUrl: string | undefined,
  maxWaitMs: number,
  retryDelayMs: number
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (true) {
    const serverUrl = explicitUrl?.trim()
      ? stripTrailingSlashes(explicitUrl.trim())
      : resolveServerUrlFromMetadata(normalized.workspaceDir, normalized.extraMetadataDirs);
    if (serverUrl) {
      try {
        const result = await postHookApi(
          serverUrl,
          { harness: normalized.harness, sessionId: normalized.sessionId, event: 'PostToolUse', waitMs: 0 },
          Math.min(1000, Math.max(200, deadline - Date.now()))
        );
        if (result?.listening === true) return;
      } catch {
        // Server not accepting connections yet; retry until the deadline.
      }
    }
    const remaining = deadline - Date.now();
    if (remaining <= retryDelayMs) return;
    await new Promise((r) => setTimeout(r, retryDelayMs));
  }
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
    /** How long PostToolUse waits for a just-launched lux server to come up (default 8s). */
    serverLaunchWaitMs?: number;
    serverLaunchRetryMs?: number;
  }
): Promise<HookDecisionOutput> {
  const normalized = normalizeHookPayload(rawPayload, options.harness || 'auto', options.event);
  if (!normalized) {
    return {};
  }

  if (normalized.event === 'PostToolUse' && normalized.isServerLaunch) {
    await bindLeaseAfterServerLaunch(
      normalized,
      options.serverUrl,
      options.serverLaunchWaitMs ?? 8000,
      options.serverLaunchRetryMs ?? 250
    );
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
