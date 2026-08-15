import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventStore } from '@visual-edit/server';
import { formatBatchSummary, SessionStatus } from '@visual-edit/core';

export function createVisualEditMcpServer(rootDir: string = process.cwd()) {
  const eventStore = EventStore.getInstance(rootDir);

  const server = new McpServer({
    name: 'lux-edit',
    version: '0.1.0',
  });

  // Tool: Wait For Review Submission (Blocking / Wakeup Tool)
  const waitForReviewHandler = async ({
    sessionId,
    timeoutSeconds = 300,
    agentId = 'coding-agent',
  }: {
    sessionId?: string;
    timeoutSeconds?: number;
    agentId?: string;
  }) => {
    try {
      const batch = await eventStore.waitForSubmission(sessionId, timeoutSeconds * 1000);
      eventStore.claimSession(batch.id, agentId);

      const summary = formatBatchSummary(batch);
      return {
        content: [
          {
            type: 'text' as const,
            text: `### 🎯 Visual Review Received from User (Session: ${batch.id})\n\n${summary}\n\n### Raw Payload:\n\`\`\`json\n${JSON.stringify(batch, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: err.message || 'Timed out waiting for visual review submission.',
          },
        ],
      };
    }
  };

  server.tool(
    'lux_wait_for_review',
    'Wait for the human user to finish drafting visual edits and comments in the browser overlay and click "Send to Agent". This tool blocks and wakes up the agent immediately when the user submits.',
    {
      sessionId: z.string().optional().describe('Specific session ID to wait for, or leave empty for the next submitted review'),
      timeoutSeconds: z.number().optional().describe('Maximum seconds to wait before timeout (default: 300)'),
      agentId: z.string().optional().describe('Identifier for this agent'),
    },
    waitForReviewHandler
  );

  server.tool(
    'visual_edit_wait_for_review',
    'Alias for lux_wait_for_review',
    {
      sessionId: z.string().optional().describe('Specific session ID to wait for'),
      timeoutSeconds: z.number().optional().describe('Maximum seconds to wait (default: 300)'),
      agentId: z.string().optional().describe('Identifier for this agent'),
    },
    waitForReviewHandler
  );

  // Tool: List Sessions
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
    'List all visual edit draft batches and comment sessions created by the user in the browser overlay',
    {
      status: z
        .enum(['draft', 'submitted', 'in_progress', 'implemented', 'resolved', 'all'])
        .optional()
        .describe('Filter sessions by status'),
    },
    listSessionsHandler
  );

  server.tool(
    'visual_edit_list_sessions',
    'Alias for lux_list_sessions',
    {
      status: z
        .enum(['draft', 'submitted', 'in_progress', 'implemented', 'resolved', 'all'])
        .optional(),
    },
    listSessionsHandler
  );

  // Tool: Get Session Details
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
    'Get full visual edit batch details including source code locations, component names, CSS deltas, HTML snippets, and comments',
    {
      sessionId: z.string().describe('The ID of the visual edit session to retrieve'),
    },
    getSessionHandler
  );

  server.tool(
    'visual_edit_get_session',
    'Alias for lux_get_session',
    {
      sessionId: z.string().describe('The ID of the visual edit session to retrieve'),
    },
    getSessionHandler
  );

  // Tool: Claim Session
  const claimSessionHandler = async ({ sessionId, agentId = 'coding-agent' }: { sessionId: string; agentId?: string }) => {
    const res = eventStore.claimSession(sessionId, agentId);
    if (!res.success) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: res.error || 'Failed to claim session' }],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully claimed session "${sessionId}". Status updated to "in_progress".`,
        },
      ],
    };
  };

  server.tool(
    'lux_claim_session',
    'Atomically claim a visual edit session so other agent windows know this session is currently being processed',
    {
      sessionId: z.string().describe('The session ID to claim'),
      agentId: z.string().optional().describe('Unique identifier for this agent session'),
    },
    claimSessionHandler
  );

  server.tool(
    'visual_edit_claim_session',
    'Alias for lux_claim_session',
    {
      sessionId: z.string().describe('The session ID to claim'),
      agentId: z.string().optional().describe('Unique identifier for this agent session'),
    },
    claimSessionHandler
  );

  // Tool: Update Status & Reply
  const updateStatusHandler = async ({
    sessionId,
    status,
    agentMessage,
    agentId = 'coding-agent',
  }: {
    sessionId: string;
    status: string;
    agentMessage?: string;
    agentId?: string;
  }) => {
    const reply = agentMessage ? { agentId, message: agentMessage } : undefined;
    const success = eventStore.updateStatus(sessionId, status as SessionStatus, reply);

    if (!success) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Session "${sessionId}" not found.` }],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Updated session "${sessionId}" status to "${status}". Browser overlay notified live.`,
        },
      ],
    };
  };

  server.tool(
    'lux_update_status',
    'Update session status (e.g. mark as "implemented") and post reply notes back to the human reviewer in the browser',
    {
      sessionId: z.string().describe('The session ID to update'),
      status: z
        .enum(['in_progress', 'implemented', 'resolved', 'rejected'])
        .describe('New status for the session'),
      agentMessage: z
        .string()
        .optional()
        .describe('Feedback or summary of changes implemented for the reviewer'),
      agentId: z.string().optional().describe('Identifier of the agent submitting the update'),
    },
    updateStatusHandler
  );

  server.tool(
    'visual_edit_update_status',
    'Alias for lux_update_status',
    {
      sessionId: z.string().describe('The session ID to update'),
      status: z
        .enum(['in_progress', 'implemented', 'resolved', 'rejected'])
        .describe('New status for the session'),
      agentMessage: z
        .string()
        .optional()
        .describe('Feedback or summary of changes implemented for the reviewer'),
      agentId: z.string().optional().describe('Identifier of the agent submitting the update'),
    },
    updateStatusHandler
  );

  // Tool: Release Session
  const releaseSessionHandler = async ({ sessionId, agentId = 'coding-agent' }: { sessionId: string; agentId?: string }) => {
    const success = eventStore.releaseSession(sessionId, agentId);
    return {
      content: [
        {
          type: 'text' as const,
          text: success
            ? `Released claim on session "${sessionId}".`
            : `Could not release claim on "${sessionId}" (not found or agent ID mismatch).`,
        },
      ],
    };
  };

  server.tool(
    'lux_release_session',
    'Release claim lease on a visual edit session',
    {
      sessionId: z.string().describe('The session ID to release'),
      agentId: z.string().optional().describe('Agent ID holding the claim'),
    },
    releaseSessionHandler
  );

  server.tool(
    'visual_edit_release_session',
    'Alias for lux_release_session',
    {
      sessionId: z.string().describe('The session ID to release'),
      agentId: z.string().optional().describe('Agent ID holding the claim'),
    },
    releaseSessionHandler
  );

  // Prompt: Apply Visual Edits
  server.prompt(
    'apply_visual_edits',
    'Instructions on applying drafted visual mutations into clean, idiomatic source code',
    {
      sessionId: z.string().describe('The visual edit session ID to implement'),
    },
    async ({ sessionId }) => {
      const session = eventStore.getSession(sessionId);
      const summary = session ? formatBatchSummary(session) : `Session ${sessionId} not loaded yet.`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text' as const,
              text: `Please implement the following visual modifications drafted by the user in the browser overlay:\n\n${summary}\n\n### Implementation Guidelines:\n1. **Idiomatic Styling**: If the project uses Tailwind CSS, use Tailwind classes instead of raw inline styles. If using CSS Modules or external CSS, update the stylesheet accordingly.\n2. **React/Component Source**: If component names and line numbers are provided, edit the exact JSX/TSX source file.\n3. **Preserve Code Quality**: Retain comments, types, and props structure.\n4. **Update Status**: Once code changes are made, call \`lux_update_status\` with \`status="implemented"\` and a brief summary of what was done.`,
            },
          },
        ],
      };
    }
  );

  return server;
}
