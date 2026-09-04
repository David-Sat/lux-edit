import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventStore } from '@visual-edit/server';
import { formatBatchSummary } from '@visual-edit/core';

import path from 'node:path';

export function createVisualEditMcpServer(rootDir: string = process.cwd()) {
  const resolvedRoot = path.resolve(rootDir);
  const eventStore = EventStore.getInstance(resolvedRoot);
  console.error(`[lux-mcp] Initialized MCP server (root: ${resolvedRoot})`);

  const server = new McpServer({
    name: 'lux-edit',
    version: '0.5.0',
  });

  // Standard MCP Resource: lux://pending-review
  server.registerResource(
    'pending-review',
    'lux://pending-review',
    {
      description: 'Active visual review session, comments, annotations, and style edits from the browser overlay',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const batch = eventStore.getPendingReview();
      if (!batch || ((!batch.mutations || batch.mutations.length === 0) && (!batch.annotations || batch.annotations.length === 0))) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/markdown',
              text: 'No pending visual edits or comment notes found.',
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
            text: `### 🎯 Visual Review & Comments from User (Session: ${batch.id})\n\n${summary}\n\n### Raw Payload:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``,
          },
        ],
      };
    }
  );

  // Standard MCP Prompt: lux_apply_review
  server.registerPrompt(
    'lux_apply_review',
    {
      title: 'Apply Lux Visual Review',
      description: 'Apply pending visual edits, comments, and design changes from the browser overlay to your codebase',
    },
    async () => {
      const batch = eventStore.getPendingReview();
      let contextText = 'No pending visual edits or comment notes found.';
      if (batch && ((batch.mutations && batch.mutations.length > 0) || (batch.annotations && batch.annotations.length > 0))) {
        const summary = formatBatchSummary(batch);
        contextText = `Here is the visual review feedback from session ${batch.id}:\n\n${summary}\n\nRaw Batch JSON:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``;
      }

      return {
        description: 'Review and implement user visual edits and annotations',
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please review and apply the following visual edits and annotations from the Lux browser overlay to the project codebase:\n\n${contextText}\n\nCarefully update the relevant component files, styling, and copy, and verify everything builds properly.`,
            },
          },
        ],
      };
    }
  );

  // Primary Tool: Get Active / Pending Visual Review and Comments (Instant & Non-blocking)
  const getPendingReviewHandler = async () => {
    const batch = eventStore.getPendingReview();
    if (!batch || ((!batch.mutations || batch.mutations.length === 0) && (!batch.annotations || batch.annotations.length === 0))) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No pending visual edits or comment notes found. The user has not added any comments or modifications in the browser overlay yet.',
          },
        ],
      };
    }

    const summary = formatBatchSummary(batch);
    return {
      content: [
        {
          type: 'text' as const,
          text: `### 🎯 Visual Review & Comments from User (Session: ${batch.id})\n\n${summary}\n\n### Raw Payload:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``,
        },
      ],
    };
  };

  server.tool(
    'lux_get_pending_review',
    'Get all active pinned comments, user instructions, component selectors, and visual style edits from the browser overlay without blocking or waiting.',
    {},
    getPendingReviewHandler
  );

  server.tool(
    'lux_get_comments',
    'Alias for lux_get_pending_review: Retrieve all pinned user comments and visual edits.',
    {},
    getPendingReviewHandler
  );

  // Optional Query Tool: Get Specific Session Details
  const getSessionHandler = async ({ sessionId }: { sessionId: string }) => {
    const session = eventStore.getSession(sessionId);
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
          text: `${formattedSummary}\n\n### Raw Payload (JSON):\n\`\`\`json\n${JSON.stringify(session, null, 2)}\n\`\`\``,
        },
      ],
    };
  };

  server.tool(
    'lux_get_session',
    'Get specific visual edit batch details by session ID',
    {
      sessionId: z.string().describe('The ID of the visual edit session to retrieve'),
    },
    getSessionHandler
  );

  // Optional Query Tool: List All Sessions
  const listSessionsHandler = async ({ status }: { status?: string }) => {
    const allSessions = eventStore.listSessions();
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
    'List all recorded visual edit and comment sessions',
    {
      status: z
        .enum(['draft', 'submitted', 'in_progress', 'implemented', 'resolved', 'all'])
        .optional()
        .describe('Filter sessions by status'),
    },
    listSessionsHandler
  );

  return server;
}
