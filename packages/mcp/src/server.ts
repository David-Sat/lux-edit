import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventStore } from '@visual-edit/server';
import {
  formatBatchSummary,
  VisualEditBatch,
  LuxServerMetadata,
  SERVER_METADATA_DIR,
  SERVER_METADATA_FILE,
  DEFAULT_SERVER_URL,
  API_ROUTES,
} from '@visual-edit/core';
import path from 'node:path';
import fs from 'node:fs';

function hasPendingContent(batch: VisualEditBatch | null): batch is VisualEditBatch {
  if (!batch) return false;
  return Boolean(
    (batch.mutations && batch.mutations.length > 0) ||
    (batch.annotations && batch.annotations.length > 0) ||
    (batch.voiceReviews && batch.voiceReviews.length > 0)
  );
}

function readServerMetadata(rootDir: string): LuxServerMetadata | null {
  try {
    const metaPath = path.join(rootDir, SERVER_METADATA_DIR, SERVER_METADATA_FILE);
    if (!fs.existsSync(metaPath)) return null;
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const data = JSON.parse(raw) as LuxServerMetadata;
    // Check if process is still alive if PID is provided
    if (data.pid && typeof data.pid === 'number') {
      try {
        process.kill(data.pid, 0);
      } catch (e: any) {
        if (e.code === 'ESRCH') {
          // Process no longer exists - clean up stale lock file
          try { fs.unlinkSync(metaPath); } catch {}
          return null;
        }
      }
    }
    return data;
  } catch {
    return null;
  }
}

async function fetchFromRunningServer(serverUrl: string, autoResolve = true): Promise<VisualEditBatch | null> {
  try {
    const url = serverUrl.replace(/\/+$/, '') + `${API_ROUTES.PENDING}${autoResolve ? '?resolve=true' : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      const data = (await res.json()) as VisualEditBatch | null;
      if (hasPendingContent(data)) {
        return data;
      }
    }
  } catch {}
  return null;
}

async function fetchSessionsFromRunningServer(serverUrl: string): Promise<VisualEditBatch[] | null> {
  try {
    const url = serverUrl.replace(/\/+$/, '') + API_ROUTES.SESSIONS;
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
    version: '0.10.0',
  });

  const resolveEventStore = (workspaceDir?: string) => {
    if (workspaceDir && workspaceDir.trim()) {
      return EventStore.getInstance(path.resolve(workspaceDir.trim()));
    }
    return defaultEventStore;
  };

  const resolvePendingBatch = async (args?: { workspaceDir?: string; serverUrl?: string }): Promise<VisualEditBatch | null> => {
    const targetRootDir = args?.workspaceDir ? path.resolve(args.workspaceDir.trim()) : resolvedRoot;

    // 1. If explicit serverUrl provided, probe that specific server URL first (peek without resolving)
    if (args?.serverUrl && args.serverUrl.trim()) {
      const live = await fetchFromRunningServer(args.serverUrl.trim(), false);
      if (live) return live;
    }

    // 2. Deterministic Discovery: Check active server lockfile in target workspace or root
    const serverMeta = readServerMetadata(targetRootDir) || (targetRootDir !== resolvedRoot ? readServerMetadata(resolvedRoot) : null);
    if (serverMeta && serverMeta.url) {
      const live = await fetchFromRunningServer(serverMeta.url, false);
      if (live) return live;
    }

    // 3. If explicit workspaceDir provided, check that store on disk
    if (args?.workspaceDir && args.workspaceDir.trim()) {
      const store = resolveEventStore(args.workspaceDir);
      const batch = store.getPendingReview({ serverUrl: args?.serverUrl });
      if (hasPendingContent(batch)) {
        return batch;
      }
    }

    // 4. Check default eventStore on disk
    const localBatch = defaultEventStore.getPendingReview({ serverUrl: args?.serverUrl });
    if (hasPendingContent(localBatch)) {
      return localBatch;
    }

    // 5. Fall back to probing default review server URL if no reviews on disk
    if (!args?.workspaceDir) {
      const fallbackUrl = DEFAULT_SERVER_URL;
      const live = await fetchFromRunningServer(fallbackUrl, false);
      if (live) return live;
    }

    return localBatch || null;
  };

  // Standard MCP Resource: lux://pending-review
  server.registerResource(
    'pending-review',
    'lux://pending-review',
    {
      description: 'Active visual review session, comments, and style edits from the browser overlay',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const batch = await resolvePendingBatch();
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

      const summary = formatBatchSummary(batch!);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: `### Visual review and comments (Session: ${batch!.id})\n\n${summary}\n\n### Raw payload:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``,
          },
        ],
      };
    }
  );

  // Standard MCP Prompt: lux_apply_review
  server.registerPrompt(
    'lux_apply_review',
    {
      title: 'Apply visual review',
      description: 'Apply pending visual edits and comments from the browser overlay to your codebase',
    },
    async () => {
      const batch = await resolvePendingBatch();
      let contextText = 'No pending visual edits or comments found.';
      if (hasPendingContent(batch)) {
        const summary = formatBatchSummary(batch!);
        contextText = `Feedback from session ${batch!.id}:\n\n${summary}\n\nRaw batch:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``;
      }

      return {
        description: 'Review and implement user visual edits and annotations',
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Review and apply the following visual edits and annotations from the lux browser overlay to the project codebase:\n\n${contextText}\n\nUpdate the relevant component files, styling, and copy, and verify everything builds properly.`,
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
  };

  // Primary Tool: Get Active / Pending Visual Review and Comments
  const getPendingReviewHandler = async (args?: { workspaceDir?: string; serverUrl?: string }) => {
    const batch = await resolvePendingBatch(args);
    if (!hasPendingContent(batch)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No pending visual edits or comments found. Make sure lux is running in the right workspace directory or pass workspaceDir.',
          },
        ],
      };
    }

    const summary = formatBatchSummary(batch);
    return {
      content: [
        {
          type: 'text' as const,
          text: `### Visual review and comments (Session: ${batch.id})\n\n${summary}\n\n### Raw payload:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``,
        },
      ],
    };
  };

  server.tool(
    'lux_get_pending_review',
    'Get active pinned comments and visual edits from the browser overlay.',
    reviewParams,
    getPendingReviewHandler
  );

  server.tool(
    'lux_get_comments',
    'Alias for lux_get_pending_review: Get active pinned comments and visual edits.',
    reviewParams,
    getPendingReviewHandler
  );

  // Query Tool: Get Specific Session Details
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
      const targetRootDir = workspaceDir ? path.resolve(workspaceDir.trim()) : resolvedRoot;
      const meta = readServerMetadata(targetRootDir) || readServerMetadata(resolvedRoot);
      const targetUrl = serverUrl || meta?.url || DEFAULT_SERVER_URL;
      const liveSessions = await fetchSessionsFromRunningServer(targetUrl);
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
    getSessionHandler
  );

  // Query Tool: List All Sessions
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
      const targetRootDir = workspaceDir ? path.resolve(workspaceDir.trim()) : resolvedRoot;
      const meta = readServerMetadata(targetRootDir) || readServerMetadata(resolvedRoot);
      const targetUrl = serverUrl || meta?.url || DEFAULT_SERVER_URL;
      const liveSessions = await fetchSessionsFromRunningServer(targetUrl);
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
    listSessionsHandler
  );

  // Resolution Tool: Mark a review session implemented or resolved
  const resolveReviewHandler = async ({
    sessionId,
    status = 'implemented',
    reply,
    workspaceDir,
    serverUrl,
  }: {
    sessionId?: string;
    status?: 'implemented' | 'resolved';
    reply?: string;
    workspaceDir?: string;
    serverUrl?: string;
  }) => {
    const store = resolveEventStore(workspaceDir);
    let targetId = sessionId;

    if (!targetId) {
      const pending = await resolvePendingBatch({ workspaceDir, serverUrl });
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

    const updated = store.updateStatus(
      targetId,
      status,
      reply ? { agentId: 'agent', message: reply } : undefined
    );

    // Notify live running review server if available
    const targetRootDir = workspaceDir ? path.resolve(workspaceDir.trim()) : resolvedRoot;
    const meta = readServerMetadata(targetRootDir) || readServerMetadata(resolvedRoot);
    const targetUrl = serverUrl || meta?.url || DEFAULT_SERVER_URL;
    try {
      const url = targetUrl.replace(/\/+$/, '') + `${API_ROUTES.PENDING}?resolve=true`;
      await fetch(url, { signal: AbortSignal.timeout(600) }).catch(() => {});
    } catch {}

    return {
      content: [
        {
          type: 'text' as const,
          text: updated
            ? `✓ Review session "${targetId}" marked as ${status}.${reply ? ` Reply recorded: "${reply}"` : ''}`
            : `Session "${targetId}" not found on disk, but live review server was notified.`,
        },
      ],
    };
  };

  server.tool(
    'lux_resolve_review',
    'Mark a visual review session as implemented or resolved with optional agent feedback.',
    {
      sessionId: z.string().optional().describe('Session ID to resolve. Defaults to the latest active review session if omitted.'),
      status: z.enum(['implemented', 'resolved']).default('implemented').describe('Status to mark the session with (default: implemented)'),
      reply: z.string().optional().describe('Optional closing message or summary of applied code changes to record in the session'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    resolveReviewHandler
  );

  server.tool(
    'lux_mark_resolved',
    'Alias for lux_resolve_review: Mark a visual review session as implemented or resolved.',
    {
      sessionId: z.string().optional().describe('Session ID to resolve. Defaults to the latest active review session if omitted.'),
      status: z.enum(['implemented', 'resolved']).default('implemented').describe('Status to mark the session with (default: implemented)'),
      reply: z.string().optional().describe('Optional closing message or summary of applied code changes to record in the session'),
      workspaceDir: z.string().optional().describe('Absolute path to project workspace directory'),
      serverUrl: z.string().optional().describe('URL of running lux server'),
    },
    resolveReviewHandler
  );

  return server;
}
