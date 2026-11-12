import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventStore } from '@visual-edit/server';
import {
  formatBatchSummary,
  VisualEditBatch,
  VisualCaptureResponse,
  ElementVariantSet,
  LuxServerMetadata,
  SERVER_METADATA_DIR,
  SERVER_METADATA_FILE,
  DEFAULT_SERVER_URL,
  API_ROUTES,
  checkForUpdates,
  stripTrailingSlashes,
} from '@visual-edit/core';
import path from 'node:path';
import fs from 'node:fs';

let mcpPkgVersion = '0.13.0';
try {
  mcpPkgVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
} catch {}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const WRITE_IDEMPOTENT_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function hasPendingContent(batch: VisualEditBatch | null): batch is VisualEditBatch {
  if (!batch) return false;
  return Boolean(
    (batch.mutations && batch.mutations.length > 0) ||
    (batch.annotations && batch.annotations.length > 0) ||
    (batch.voiceReviews && batch.voiceReviews.length > 0) ||
    (batch.variantDecisions && batch.variantDecisions.length > 0) ||
    (batch.userPrompt && batch.userPrompt.trim().length > 0)
  );
}

function readServerMetadata(rootDir: string): LuxServerMetadata | null {
  try {
    const metaPath = path.join(rootDir, SERVER_METADATA_DIR, SERVER_METADATA_FILE);
    if (!fs.existsSync(metaPath)) return null;
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const data = JSON.parse(raw) as LuxServerMetadata;
    if (data.pid && typeof data.pid === 'number') {
      try {
        process.kill(data.pid, 0);
      } catch (e: any) {
        if (e.code === 'ESRCH') {
          try {
            fs.unlinkSync(metaPath);
          } catch {}
          return null;
        }
      }
    }
    return data;
  } catch {
    return null;
  }
}

async function fetchFromRunningServer(
  serverUrl: string,
  options?: {
    autoResolve?: boolean;
    claim?: boolean;
    afterCursor?: number;
    waitMs?: number;
  }
): Promise<VisualEditBatch | null> {
  try {
    const params = new URLSearchParams();
    if (options?.autoResolve) params.set('resolve', 'true');
    if (options?.claim) params.set('claim', 'true');
    if (typeof options?.afterCursor === 'number') params.set('afterCursor', String(options.afterCursor));
    if (typeof options?.waitMs === 'number' && options.waitMs > 0) params.set('waitMs', String(options.waitMs));

    const qs = params.toString();
    const url = stripTrailingSlashes(serverUrl) + `${API_ROUTES.PENDING}${qs ? `?${qs}` : ''}`;
    const timeoutMs = (options?.waitMs || 0) + 1200;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      const data = (await res.json()) as VisualEditBatch | null;
      if (hasPendingContent(data)) {
        return data;
      }
    }
  } catch {}
  return null;
}

async function fetchServerStatus(serverUrl: string): Promise<any | null> {
  try {
    const url = stripTrailingSlashes(serverUrl) + API_ROUTES.STATUS;
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

async function fetchSessionsFromRunningServer(serverUrl: string): Promise<VisualEditBatch[] | null> {
  try {
    const url = stripTrailingSlashes(serverUrl) + API_ROUTES.SESSIONS;
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      return (await res.json()) as VisualEditBatch[];
    }
  } catch {}
  return null;
}

export function createVisualEditMcpServer(rootDir: string = process.cwd()) {
  const resolvedRoot = path.resolve(rootDir);
  const defaultEventStore = EventStore.getInstance(resolvedRoot);
  console.error(`[lux-mcp] Initialized MCP server (root: ${resolvedRoot})`);

  const server = new McpServer({
    name: 'lux-edit',
    version: mcpPkgVersion,
  });

  const resolveEventStore = (workspaceDir?: string) => {
    if (workspaceDir && workspaceDir.trim()) {
      return EventStore.getInstance(path.resolve(workspaceDir.trim()));
    }
    return defaultEventStore;
  };

  const resolveTargetServerUrl = (args?: { workspaceDir?: string; serverUrl?: string }): string | null => {
    if (args?.serverUrl && args.serverUrl.trim()) {
      return stripTrailingSlashes(args.serverUrl.trim());
    }
    const targetRootDir = args?.workspaceDir ? path.resolve(args.workspaceDir.trim()) : resolvedRoot;
    const meta = readServerMetadata(targetRootDir);
    if (meta && meta.url) {
      return stripTrailingSlashes(meta.url);
    }
    if (!args?.workspaceDir) {
      return DEFAULT_SERVER_URL;
    }
    return null;
  };

  const resolvePendingBatch = async (args?: {
    workspaceDir?: string;
    serverUrl?: string;
    afterCursor?: number;
    waitForFeedbackMs?: number;
    claim?: boolean;
  }): Promise<VisualEditBatch | null> => {
    const targetRootDir = args?.workspaceDir ? path.resolve(args.workspaceDir.trim()) : resolvedRoot;
    const fetchOpts = {
      autoResolve: false,
      claim: args?.claim ?? true,
      afterCursor: args?.afterCursor,
      waitMs: args?.waitForFeedbackMs,
    };

    if (args?.serverUrl && args.serverUrl.trim()) {
      const live = await fetchFromRunningServer(args.serverUrl.trim(), fetchOpts);
      if (live) return live;
    }

    const serverMeta = readServerMetadata(targetRootDir) || (targetRootDir !== resolvedRoot ? readServerMetadata(resolvedRoot) : null);
    if (serverMeta && serverMeta.url) {
      const live = await fetchFromRunningServer(serverMeta.url, fetchOpts);
      if (live) return live;
    }

    if (args?.workspaceDir && args.workspaceDir.trim()) {
      const store = resolveEventStore(args.workspaceDir);
      const batch = store.getPendingReview({
        serverUrl: args?.serverUrl,
        afterCursor: args?.afterCursor,
      });
      if (hasPendingContent(batch)) {
        if (args?.claim) {
          store.updateStatus(batch.id, 'in_progress');
        }
        return batch;
      }
    }

    const localBatch = defaultEventStore.getPendingReview({
      serverUrl: args?.serverUrl,
      afterCursor: args?.afterCursor,
    });
    if (hasPendingContent(localBatch)) {
      if (args?.claim) {
        defaultEventStore.updateStatus(localBatch.id, 'in_progress');
      }
      return localBatch;
    }

    if (!args?.workspaceDir) {
      const fallbackUrl = DEFAULT_SERVER_URL;
      const live = await fetchFromRunningServer(fallbackUrl, fetchOpts);
      if (live) return live;
    }

    return localBatch || null;
  };

  server.registerResource(
    'pending-review',
    'lux://pending-review',
    {
      description: 'Active visual review session, comments, voice walkthroughs, variant decisions, and style edits from the browser overlay',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const batch = await resolvePendingBatch({ claim: false });
      if (!hasPendingContent(batch)) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/markdown',
              text: 'No pending visual edits or comments found.',
            },
          ],
        };
      }

      const summary = formatBatchSummary(batch);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: `### Visual review and comments (Session: ${batch.id})\n\n${summary}\n\n### Raw payload:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``,
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'lux_apply_review',
    {
      title: 'Apply visual review',
      description: 'Apply pending visual edits, voice walkthroughs, variant decisions, and comments from the browser overlay to your codebase',
    },
    async () => {
      const batch = await resolvePendingBatch({ claim: true });
      let contextText = 'No pending visual edits or comments found.';
      if (hasPendingContent(batch)) {
        const summary = formatBatchSummary(batch);
        contextText = `Feedback from session ${batch.id}:\n\n${summary}\n\nRaw batch:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``;
      }

      return {
        description: 'Review and implement user visual edits and annotations',
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Review and apply the following visual edits and annotations from the lux browser overlay to the project codebase:\n\n${contextText}\n\nUpdate the relevant component files, styling, and copy, verify with \`lux_capture_visual\` if needed, and call \`lux_resolve_review\` when done.`,
            },
          },
        ],
      };
    }
  );

  const reviewParams = {
    workspaceDir: z
      .string()
      .optional()
      .describe('Absolute path to your project workspace. Pass this so lux reads the right .visual-edit data when started from a global plugin.'),
    serverUrl: z
      .string()
      .optional()
      .describe('URL of the running lux review server, for example http://127.0.0.1:4320.'),
    afterCursor: z
      .number()
      .int()
      .optional()
      .describe('Optional delivery cursor from a previous read. Only returns feedback newer than this cursor.'),
    waitForFeedbackMs: z
      .number()
      .int()
      .min(0)
      .max(30000)
      .optional()
      .describe('Optional long-poll wait in milliseconds (up to 30000ms) to wait for incoming Live/Batch browser feedback when lifecycle hooks are not active.'),
  };

  const getPendingReviewHandler = async (args?: {
    workspaceDir?: string;
    serverUrl?: string;
    afterCursor?: number;
    waitForFeedbackMs?: number;
  }) => {
    let updateNotice = '';
    try {
      const update = await checkForUpdates(mcpPkgVersion);
      if (update.updateAvailable) {
        updateNotice = `\n\n*(Note: A newer version of lux-edit (v${update.latestVersion}) is available. Run \`lux update\` to upgrade.)*`;
      }
    } catch {}

    const targetUrl = resolveTargetServerUrl(args);
    const [batch, serverStatus] = await Promise.all([
      resolvePendingBatch({ ...args, claim: true }),
      targetUrl ? fetchServerStatus(targetUrl) : Promise.resolve(null),
    ]);

    const reviewMode = batch?.reviewMode || serverStatus?.reviewMode || 'batch';
    const hookConnected = Boolean(serverStatus?.hookLease?.connected);
    const waiterConnected = Boolean(serverStatus?.waiterConnected ?? serverStatus?.hookLease?.waiterConnected);

    if (!hasPendingContent(batch)) {
      const listenerHint =
        serverStatus && !waiterConnected
          ? '\n\n*(Tip for Antigravity: To wake automatically when the user submits Live/Batch feedback without locking the chat input, start `npx lux-edit hook wait` via `run_command` with `WaitMsBeforeAsync: 500, IsDaemon: false` before ending your turn.)*'
          : '';
      const statusHint = serverStatus
        ? `Review mode: \`${reviewMode}\` • Live hook: \`${hookConnected ? `connected (${serverStatus.hookLease.harness})` : 'inactive'}\` • Background waiter: \`${waiterConnected ? 'active' : 'inactive'}\` • Latest cursor: \`${serverStatus.latestCursor ?? 0}\`.${listenerHint}`
        : 'Make sure lux is running in the right workspace directory or pass workspaceDir.';

      return {
        content: [
          {
            type: 'text' as const,
            text: `No pending visual edits or comments found. ${statusHint}${updateNotice}`,
          },
        ],
      };
    }

    const summary = formatBatchSummary(batch);
    const nextCursor = batch.latestCursor ?? serverStatus?.latestCursor ?? 0;
    const revHash = batch.revisionHash || '';
    const nextStepHint = `\n\n### Next Steps for Agent\n- Apply the requested code changes to the project files.\n- To visually verify your changes in the live browser, call \`lux_capture_visual\`.\n- When finished, call \`lux_resolve_review\` with \`sessionId: "${batch.id}"\` and \`expectedHash: "${revHash}"\` (or save the modified source file to trigger automatic hot-reload verification).\n- If working in Antigravity, start a fresh background listener (\`npx lux-edit hook wait\` with \`WaitMsBeforeAsync: 500, IsDaemon: false\`) before ending your turn.\n- Carry \`nextCursor: ${nextCursor}\` forward if polling incrementally.`;

    return {
      content: [
        {
          type: 'text' as const,
          text: `### Visual review and comments (Session: ${batch.id})\n\n${summary}${nextStepHint}\n\n### Raw payload:\n\`\`\`json\n${JSON.stringify(
            {
              ...batch,
              nextCursor,
              reviewMode,
              liveHookConnected: hookConnected,
            },
            null,
            2
          )}\n\`\`\`${updateNotice}`,
        },
      ],
    };
  };

  server.tool(
    'lux_get_pending_review',
    'Get active pinned comments, sectioned voice walkthroughs, component variant decisions, and visual CSS/DOM edits from the browser overlay.',
    reviewParams,
    READ_ONLY_ANNOTATIONS,
    getPendingReviewHandler
  );

  server.tool(
    'lux_get_comments',
    'Alias for lux_get_pending_review: Get active pinned comments and visual edits.',
    reviewParams,
    READ_ONLY_ANNOTATIONS,
    getPendingReviewHandler
  );

  const getSessionHandler = async ({
    sessionId,
    workspaceDir,
    serverUrl,
  }: {
    sessionId: string;
    workspaceDir?: string;
    serverUrl?: string;
  }) => {
    const store = resolveEventStore(workspaceDir);
    let session = store.getSession(sessionId);

    if (!session && (serverUrl || !workspaceDir)) {
      const targetUrl = resolveTargetServerUrl({ workspaceDir, serverUrl });
      const liveSessions = targetUrl ? await fetchSessionsFromRunningServer(targetUrl) : null;
      if (liveSessions) {
        session = liveSessions.find((s) => s.id === sessionId);
      }
    }

    if (!session) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Session with ID "${sessionId}" not found.` }],
      };
    }

    const formattedSummary = formatBatchSummary(session);
    return {
      content: [
        {
          type: 'text' as const,
          text: `${formattedSummary}\n\n### Raw payload:\n\`\`\`json\n${JSON.stringify(session, null, 2)}\n\`\`\``,
        },
      ],
    };
  };

  server.tool(
    'lux_get_session',
    'Get visual edit batch details by session ID.',
    {
      sessionId: z.string().describe('The ID of the session to retrieve'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    READ_ONLY_ANNOTATIONS,
    getSessionHandler
  );

  const listSessionsHandler = async ({
    status,
    workspaceDir,
    serverUrl,
  }: {
    status?: string;
    workspaceDir?: string;
    serverUrl?: string;
  }) => {
    const store = resolveEventStore(workspaceDir);
    let allSessions: any[] = store.listSessions();

    if (allSessions.length === 0 && (serverUrl || !workspaceDir)) {
      const targetUrl = resolveTargetServerUrl({ workspaceDir, serverUrl });
      const liveSessions = targetUrl ? await fetchSessionsFromRunningServer(targetUrl) : null;
      if (liveSessions && liveSessions.length > 0) {
        allSessions = liveSessions;
      }
    }

    const filtered = allSessions.filter((s) => {
      if (!status || status === 'all') return true;
      return s.status === status;
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(filtered, null, 2),
        },
      ],
    };
  };

  server.tool(
    'lux_list_sessions',
    'List recorded visual edit and comment sessions.',
    {
      status: z
        .enum(['draft', 'submitted', 'in_progress', 'implemented', 'resolved', 'all'])
        .optional()
        .describe('Filter sessions by status'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    READ_ONLY_ANNOTATIONS,
    listSessionsHandler
  );

  // Resolution Tool: Mark a review session implemented or resolved with hash guards and Green Halo verification
  const resolveReviewParams = {
    sessionId: z
      .string()
      .optional()
      .describe('Session ID to resolve. Defaults to the latest active review session if omitted.'),
    status: z
      .enum(['implemented', 'resolved'])
      .default('implemented')
      .describe('Status to mark the session with (default: implemented)'),
    reply: z
      .string()
      .optional()
      .describe('Optional closing message or summary of applied code changes to record in the session'),
    expectedHash: z
      .string()
      .optional()
      .describe('Optional revisionHash from lux_get_pending_review to verify no newer edits arrived while you were working'),
    modifiedSelectors: z
      .array(z.string())
      .optional()
      .describe('Optional list of CSS selectors modified by your code changes to highlight with a Green Verification Halo in the browser'),
    workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
    serverUrl: z.string().optional().describe('URL of running lux server'),
  };

  const resolveReviewHandler = async ({
    sessionId,
    status = 'implemented',
    reply,
    expectedHash,
    modifiedSelectors,
    workspaceDir,
    serverUrl,
  }: {
    sessionId?: string;
    status?: 'implemented' | 'resolved';
    reply?: string;
    expectedHash?: string;
    modifiedSelectors?: string[];
    workspaceDir?: string;
    serverUrl?: string;
  }) => {
    const store = resolveEventStore(workspaceDir);
    let targetId = sessionId;

    if (!targetId) {
      const pending = await resolvePendingBatch({ workspaceDir, serverUrl, claim: false });
      if (pending) {
        targetId = pending.id;
      }
    }

    if (!targetId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No active review session found to resolve. Pass a specific sessionId or start a review session first.',
          },
        ],
      };
    }

    const localResult = store.updateStatus(
      targetId,
      status,
      reply ? { agentId: 'agent', message: reply } : undefined,
      { expectedHash, modifiedSelectors }
    );

    if (localResult.staleConflict) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Stale revision conflict on session "${targetId}": expected hash "${expectedHash}", but current hash is "${localResult.currentHash}". The user added new edits or comments while you were working. Call \`lux_get_pending_review\` to inspect the latest changes before resolving.`,
          },
        ],
      };
    }

    // Notify live running review server if available
    const targetUrl = resolveTargetServerUrl({ workspaceDir, serverUrl });
    let liveNotified = false;
    try {
      const statusUrl = `${targetUrl}${API_ROUTES.STATUS}`;
      const res = await fetch(statusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          sessionId: targetId,
          status,
          reply,
          expectedHash,
          modifiedSelectors,
        }),
        signal: AbortSignal.timeout(800),
      });
      if (res.status === 409) {
        const conflictData = (await res.json()) as any;
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Stale revision conflict on live server for session "${targetId}": expected hash "${expectedHash}", current hash is "${conflictData?.currentHash}". Call \`lux_get_pending_review\` to read the newest user feedback.`,
            },
          ],
        };
      }
      liveNotified = res.ok;
    } catch {}

    if (!liveNotified) {
      try {
        const url = `${targetUrl}${API_ROUTES.PENDING}?resolve=true`;
        await fetch(url, { signal: AbortSignal.timeout(600) }).catch(() => {});
      } catch {}
    }

    return {
      content: [
        {
          type: 'text' as const,
          text:
            localResult.updated || liveNotified
              ? `Review session "${targetId}" marked as ${status}.${reply ? ` Reply recorded: "${reply}"` : ''}`
              : `Session "${targetId}" not found on disk, but live review server was notified.`,
        },
      ],
    };
  };

  server.tool(
    'lux_resolve_review',
    'Mark a visual review session as implemented or resolved, optionally checking expectedHash and highlighting modified elements with a Green Halo in the browser.',
    resolveReviewParams,
    WRITE_IDEMPOTENT_ANNOTATIONS,
    resolveReviewHandler
  );

  server.tool(
    'lux_mark_resolved',
    'Alias for lux_resolve_review: Mark a visual review session as implemented or resolved.',
    resolveReviewParams,
    WRITE_IDEMPOTENT_ANNOTATIONS,
    resolveReviewHandler
  );

  // Visual Capture Tool: Capture actual rendered pixels & layout diagnostics from the browser
  server.tool(
    'lux_capture_visual',
    'Capture a real-time PNG screenshot and layout/overflow diagnostics of the full viewport or a specific CSS selector from the active browser tab.',
    {
      selector: z
        .string()
        .optional()
        .describe('Optional CSS selector to capture a cropped screenshot and computed styles of a specific element. Omit to capture the full viewport.'),
      viewport: z
        .enum(['desktop', 'tablet', 'mobile'])
        .optional()
        .describe('Optional responsive viewport preset to test (desktop: 1440x900, tablet: 768x1024, mobile: 375x812).'),
      resolution: z
        .enum(['draft', 'full'])
        .default('draft')
        .describe('Capture resolution: "draft" (fast, max 800px wide, token-efficient) or "full" (high-DPI 1x/2x for reading small text).'),
      includeOverlay: z
        .boolean()
        .default(false)
        .describe('Whether to include the lux-edit overlay pins/dock in the screenshot. Defaults to false for clean UI inspection.'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    READ_ONLY_ANNOTATIONS,
    async ({ selector, viewport, resolution = 'draft', includeOverlay = false, workspaceDir, serverUrl }) => {
      const targetUrl = resolveTargetServerUrl({ workspaceDir, serverUrl });
      try {
        const res = await fetch(`${targetUrl}${API_ROUTES.CAPTURE}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selector,
            viewport,
            resolution,
            includeOverlay,
          }),
          signal: AbortSignal.timeout(14000),
        });

        const data = (await res.json()) as VisualCaptureResponse;
        if (!data.success || !data.imageBase64) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: `Visual capture failed: ${data.error || 'Could not capture screenshot from browser.'}`,
              },
            ],
          };
        }

        const diag = data.diagnostics;
        const diagLines: string[] = [
          `### Visual Capture (${selector ? `Selector: \`${selector}\`` : 'Full Viewport'})`,
          `- **Dimensions**: ${data.width || diag?.bounds.width || 0} × ${data.height || diag?.bounds.height || 0}px (${resolution})`,
        ];
        if (data.url) diagLines.push(`- **URL**: \`${data.url}\``);
        if (diag?.domHash) diagLines.push(`- **DOM Hash**: \`${diag.domHash}\``);
        if (diag?.overflowIssues && diag.overflowIssues.length > 0) {
          diagLines.push(`- **[Warning] Layout Overflow Warnings (${diag.overflowIssues.length})**:`);
          for (const issue of diag.overflowIssues.slice(0, 5)) {
            diagLines.push(`  - \`${issue.selector}\`: ${issue.reason} (scroll: ${issue.scrollWidth}×${issue.scrollHeight}, client: ${issue.clientWidth}×${issue.clientHeight})`);
          }
        } else {
          diagLines.push(`- **Layout Check**: No unintended overflow or broken images detected.`);
        }
        if (diag?.brokenImages && diag.brokenImages.length > 0) {
          diagLines.push(`- **[Warning] Broken Images**: ${diag.brokenImages.map((src) => `\`${src}\``).join(', ')}`);
        }
        if (diag?.computedStyles && Object.keys(diag.computedStyles).length > 0) {
          diagLines.push(`- **Computed Styles**: \`${JSON.stringify(diag.computedStyles)}\``);
        }

        const cleanBase64 = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');

        return {
          content: [
            {
              type: 'image' as const,
              data: cleanBase64,
              mimeType: 'image/png',
            },
            {
              type: 'text' as const,
              text: diagLines.join('\n'),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Could not connect to running lux server at ${targetUrl} for visual capture (${err?.message || 'connection refused'}). Make sure \`lux\` is running and open in a browser tab.`,
            },
          ],
        };
      }
    }
  );

  // Component Variant Switcher Tool: Propose A/B/C alternatives for live in-browser preview
  server.tool(
    'lux_propose_variants',
    'Propose 2 to 4 visual/structural component variants for a target CSS selector so the user can interactively toggle, preview, and approve their favorite option live in the browser.',
    {
      targetSelector: z
        .string()
        .describe('CSS selector of the target DOM element to attach the interactive Variant Switcher pill to (e.g. "button.hero-cta" or "#pricing-card").'),
      label: z
        .string()
        .optional()
        .describe('Short human-readable title for this variant exploration (e.g. "Hero Button Treatments").'),
      expectedHash: z
        .string()
        .optional()
        .describe('Optional targetHash from lux_get_pending_review to ensure the target element has not changed incompatibly.'),
      variants: z
        .array(
          z.object({
            id: z.string().optional().describe('Optional short identifier (e.g. "var_glass")'),
            name: z.string().describe('Concise display name shown on the switcher pill (e.g. "Option A: Glassmorphic")'),
            rationale: z.string().describe('One-sentence design rationale shown when the user previews this variant'),
            styles: z
              .record(z.string(), z.string())
              .optional()
              .describe('Optional CSS property map to preview on the element (e.g. {"border-radius": "9999px", "backdrop-filter": "blur(12px)"})'),
            classes: z
              .object({
                add: z.array(z.string()).optional().describe('CSS/Tailwind classes to add when previewing'),
                remove: z.array(z.string()).optional().describe('CSS/Tailwind classes to remove when previewing'),
              })
              .optional()
              .describe('Optional class modifications to preview'),
            html: z
              .string()
              .optional()
              .describe('Optional replacement innerHTML or outerHTML snippet for structural variations'),
            text: z
              .string()
              .optional()
              .describe('Optional replacement textContent for copy variations'),
          })
        )
        .min(1)
        .max(6)
        .describe('List of variants for the user to toggle between in the browser'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    WRITE_IDEMPOTENT_ANNOTATIONS,
    async ({ targetSelector, label, expectedHash, variants, workspaceDir, serverUrl }) => {
      const store = resolveEventStore(workspaceDir);
      const targetUrl = resolveTargetServerUrl({ workspaceDir, serverUrl });

      let variantSet: ElementVariantSet | null = null;
      if (targetUrl) {
        try {
          const res = await fetch(`${targetUrl}${API_ROUTES.VARIANTS}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetSelector,
              label,
              expectedHash,
              variants,
            }),
            signal: AbortSignal.timeout(1500),
          });
          if (res.ok) {
            const data = (await res.json()) as { variantSet: ElementVariantSet };
            variantSet = data.variantSet;
          }
        } catch {}
      }

      if (!variantSet) {
        variantSet = store.proposeVariants({
          targetSelector,
          label,
          expectedHash,
          variants,
        });
      }

      if (variantSet.status === 'stale') {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Stale revision conflict: ${variantSet.staleReason || 'The target element was modified since your last inspection.'}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Proposed ${variantSet.variants.length} variants for \`${targetSelector}\` (Set ID: \`${variantSet.id}\`).\nThe user can now toggle between Original and [${variantSet.variants.map((v) => `"${v.name}"`).join(', ')}] live in the browser overlay and click "Pick & Apply".\nWhen they approve a variant, you will receive their decision via \`lux_get_pending_review\`.`,
          },
        ],
      };
    }
  );

  return server;
}
