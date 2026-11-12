import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatBatchSummary, API_ROUTES, checkForUpdates } from '@visual-edit/core';
import {
  LuxServerBridge,
  READ_ONLY_ANNOTATIONS,
  WRITE_IDEMPOTENT_ANNOTATIONS,
  hasPendingContent,
  extractBatchImagesAndSanitize,
  fetchServerStatus,
  fetchSessionsFromRunningServer,
} from './server-bridge.js';

/** Registers the `lux://pending-review` MCP resource and `lux_apply_review` prompt. */
export function registerReviewResourcesAndPrompts(server: McpServer, bridge: LuxServerBridge): void {
  server.registerResource(
    'pending-review',
    'lux://pending-review',
    {
      description: 'Active visual review session, comments, voice walkthroughs, variant decisions, and style edits from the browser overlay',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const batch = await bridge.resolvePendingBatch({ claim: false });
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
      const batch = await bridge.resolvePendingBatch({ claim: true });
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
}

/** Registers pending review reading, session inspection, and resolution MCP tools. */
export function registerReviewTools(server: McpServer, bridge: LuxServerBridge, mcpPkgVersion: string): void {
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
    includeRawJson: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to append full raw JSON batch payload beneath the markdown summary. Defaults to false to minimize token consumption.'),
  };

  const getPendingReviewHandler = async (args?: {
    workspaceDir?: string;
    serverUrl?: string;
    afterCursor?: number;
    waitForFeedbackMs?: number;
    includeRawJson?: boolean;
  }) => {
    let updateNotice = '';
    try {
      const update = await checkForUpdates(mcpPkgVersion);
      if (update.updateAvailable) {
        updateNotice = `\n\n*(Note: A newer version of lux-edit (v${update.latestVersion}) is available. Run \`lux update\` to upgrade.)*`;
      }
    } catch {}

    const targetUrl = bridge.resolveTargetServerUrl(args);
    const [batch, serverStatus] = await Promise.all([
      bridge.resolvePendingBatch({ ...args, claim: true }),
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

    const { imageItems, sanitizedBatch } = extractBatchImagesAndSanitize({
      ...batch,
      nextCursor,
      reviewMode,
      liveHookConnected: hookConnected,
    });

    const rawPayloadSection = args?.includeRawJson
      ? `\n\n### Raw payload:\n\`\`\`json\n${JSON.stringify(sanitizedBatch, null, 2)}\n\`\`\``
      : '';

    return {
      content: [
        ...imageItems,
        {
          type: 'text' as const,
          text: `### Visual review and comments (Session: ${batch.id})\n\n${summary}${nextStepHint}${rawPayloadSection}${updateNotice}`,
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
    includeRawJson = true,
  }: {
    sessionId: string;
    workspaceDir?: string;
    serverUrl?: string;
    includeRawJson?: boolean;
  }) => {
    const store = bridge.resolveEventStore(workspaceDir);
    let session = store.getSession(sessionId);

    if (!session && (serverUrl || !workspaceDir)) {
      const targetUrl = bridge.resolveTargetServerUrl({ workspaceDir, serverUrl });
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

    const { imageItems, sanitizedBatch: sanitizedSession } = extractBatchImagesAndSanitize(session);
    const formattedSummary = formatBatchSummary(session);
    const rawPayloadSection = includeRawJson
      ? `\n\n### Raw payload:\n\`\`\`json\n${JSON.stringify(sanitizedSession, null, 2)}\n\`\`\``
      : '';

    return {
      content: [
        ...imageItems,
        {
          type: 'text' as const,
          text: `### Session: ${session.id}\n\n${formattedSummary}${rawPayloadSection}`,
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
      includeRawJson: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether to append sanitized raw JSON batch payload (screenshots redacted) beneath the markdown summary. Defaults to true.'),
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
    const store = bridge.resolveEventStore(workspaceDir);
    let allSessions: any[] = store.listSessions();

    if (allSessions.length === 0 && (serverUrl || !workspaceDir)) {
      const targetUrl = bridge.resolveTargetServerUrl({ workspaceDir, serverUrl });
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
    const store = bridge.resolveEventStore(workspaceDir);
    let targetId = sessionId;

    if (!targetId) {
      const pending = await bridge.resolvePendingBatch({ workspaceDir, serverUrl, claim: false });
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

    const targetUrl = bridge.resolveTargetServerUrl({ workspaceDir, serverUrl });
    let liveNotified = false;
    if (targetUrl) {
      try {
        const res = await fetch(`${targetUrl}${API_ROUTES.STATUS}`, {
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
          await fetch(`${targetUrl}${API_ROUTES.PENDING}?resolve=true`, { signal: AbortSignal.timeout(600) }).catch(() => {});
        } catch {}
      }
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
}
