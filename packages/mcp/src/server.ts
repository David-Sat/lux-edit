import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventStore } from '@visual-edit/server';
import { formatBatchSummary, VisualEditBatch } from '@visual-edit/core';
import path from 'node:path';

async function fetchFromRunningServer(serverUrl: string): Promise<VisualEditBatch | null> {
  try {
    const url = serverUrl.replace(/\/+$/, '') + '/__visual_edit__/api/pending';
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      const data = (await res.json()) as VisualEditBatch | null;
      if (data && ((data.mutations && data.mutations.length > 0) || (data.annotations && data.annotations.length > 0))) {
        return data;
      }
    }
  } catch {}
  return null;
}

async function fetchSessionsFromRunningServer(serverUrl: string): Promise<VisualEditBatch[] | null> {
  try {
    const url = serverUrl.replace(/\/+$/, '') + '/__visual_edit__/api/sessions';
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
    version: '0.7.0',
  });

  const resolveEventStore = (workspaceDir?: string) => {
    if (workspaceDir && workspaceDir.trim()) {
      return EventStore.getInstance(path.resolve(workspaceDir.trim()));
    }
    return defaultEventStore;
  };

  const resolvePendingBatch = async (args?: { workspaceDir?: string; serverUrl?: string }): Promise<VisualEditBatch | null> => {
    // 1. If explicit serverUrl provided, probe that specific server URL first
    if (args?.serverUrl && args.serverUrl.trim()) {
      const live = await fetchFromRunningServer(args.serverUrl.trim());
      if (live) return live;
    }

    // 2. If explicit workspaceDir provided, check that store on disk
    if (args?.workspaceDir && args.workspaceDir.trim()) {
      const store = resolveEventStore(args.workspaceDir);
      const batch = store.getPendingReview({ serverUrl: args?.serverUrl });
      if (batch && ((batch.mutations && batch.mutations.length > 0) || (batch.annotations && batch.annotations.length > 0))) {
        return batch;
      }
    }

    // 3. Check default eventStore on disk
    const localBatch = defaultEventStore.getPendingReview({ serverUrl: args?.serverUrl });
    if (localBatch && ((localBatch.mutations && localBatch.mutations.length > 0) || (localBatch.annotations && localBatch.annotations.length > 0))) {
      return localBatch;
    }

    // 4. Fall back to probing live running review servers if no reviews on disk
    if (!args?.workspaceDir) {
      const candidateUrls = ['http://127.0.0.1:4320', 'http://127.0.0.1:4321', 'http://127.0.0.1:4322', 'http://127.0.0.1:4330'];
      for (const url of candidateUrls) {
        const live = await fetchFromRunningServer(url);
        if (live) return live;
      }
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
      if (!batch || ((!batch.mutations || batch.mutations.length === 0) && (!batch.annotations || batch.annotations.length === 0))) {
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
      if (batch && ((batch.mutations && batch.mutations.length > 0) || (batch.annotations && batch.annotations.length > 0))) {
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
    if (!batch || ((!batch.mutations || batch.mutations.length === 0) && (!batch.annotations || batch.annotations.length === 0))) {
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
      const targetUrl = serverUrl || 'http://127.0.0.1:4320';
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
      const targetUrl = serverUrl || 'http://127.0.0.1:4320';
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

  return server;
}
