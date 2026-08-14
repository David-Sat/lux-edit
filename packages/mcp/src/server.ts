import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventStore } from '@visual-edit/server';
import { formatBatchSummary, SessionStatus } from '@visual-edit/core';

export function createVisualEditMcpServer(rootDir: string = process.cwd()) {
  const eventStore = EventStore.getInstance(rootDir);

  const server = new McpServer({
    name: 'visual-edit',
    version: '0.1.0',
  });

  // Tool: List Sessions
  server.tool(
    'visual_edit_list_sessions',
    'List all visual edit draft batches created by the user in the browser overlay',
    {
      status: z
        .enum(['draft', 'submitted', 'in_progress', 'implemented', 'resolved', 'all'])
        .optional()
        .describe('Filter sessions by status (default: submitted and in_progress)'),
    },
    async ({ status }) => {
      const allSessions = eventStore.listSessions();
      const filtered = allSessions.filter((s) => {
        if (!status || status === 'all') {
          return true;
        }
        return s.status === status;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    }
  );

  // Tool: Get Session Details
  server.tool(
    'visual_edit_get_session',
    'Get full visual edit batch details including source code locations, component names, CSS deltas, and DOM snippets',
    {
      sessionId: z.string().describe('The ID of the visual edit session to retrieve'),
    },
    async ({ sessionId }) => {
      const session = eventStore.getSession(sessionId);
      if (!session) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Session with ID "${sessionId}" not found.` }],
        };
      }

      const formattedSummary = formatBatchSummary(session);

      return {
        content: [
          {
            type: 'text',
            text: `${formattedSummary}\n\n### Raw Payload (JSON):\n\`\`\`json\n${JSON.stringify(session, null, 2)}\n\`\`\``,
          },
        ],
      };
    }
  );

  // Tool: Claim Session
  server.tool(
    'visual_edit_claim_session',
    'Atomically claim a visual edit session so other agent windows know this session is currently being processed',
    {
      sessionId: z.string().describe('The session ID to claim'),
      agentId: z.string().optional().describe('Unique identifier for this agent session'),
    },
    async ({ sessionId, agentId = 'coding-agent' }) => {
      const res = eventStore.claimSession(sessionId, agentId);
      if (!res.success) {
        return {
          isError: true,
          content: [{ type: 'text', text: res.error || 'Failed to claim session' }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Successfully claimed session "${sessionId}". Status updated to "in_progress".`,
          },
        ],
      };
    }
  );

  // Tool: Update Status & Reply
  server.tool(
    'visual_edit_update_status',
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
    async ({ sessionId, status, agentMessage, agentId = 'coding-agent' }) => {
      const reply = agentMessage ? { agentId, message: agentMessage } : undefined;
      const success = eventStore.updateStatus(sessionId, status as SessionStatus, reply);

      if (!success) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Session "${sessionId}" not found.` }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Updated session "${sessionId}" status to "${status}".`,
          },
        ],
      };
    }
  );

  // Tool: Release Session
  server.tool(
    'visual_edit_release_session',
    'Release claim lease on a visual edit session',
    {
      sessionId: z.string().describe('The session ID to release'),
      agentId: z.string().optional().describe('Agent ID holding the claim'),
    },
    async ({ sessionId, agentId = 'coding-agent' }) => {
      const success = eventStore.releaseSession(sessionId, agentId);
      return {
        content: [
          {
            type: 'text',
            text: success
              ? `Released claim on session "${sessionId}".`
              : `Could not release claim on "${sessionId}" (not found or agent ID mismatch).`,
          },
        ],
      };
    }
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
              type: 'text',
              text: `Please implement the following visual modifications drafted by the user in the browser overlay:\n\n${summary}\n\n### Implementation Guidelines:\n1. **Idiomatic Styling**: If the project uses Tailwind CSS, use Tailwind classes instead of raw inline styles. If using CSS Modules or external CSS, update the stylesheet accordingly.\n2. **React/Component Source**: If component names and line numbers are provided, edit the exact JSX/TSX source file.\n3. **Preserve Code Quality**: Retain comments, types, and props structure.\n4. **Update Status**: Once code changes are made, call \`visual_edit_update_status\` with \`status="implemented"\` and a brief summary of what was done.`,
            },
          },
        ],
      };
    }
  );

  return server;
}
