import { IncomingMessage, ServerResponse } from 'node:http';
import { VisualEditBatch, formatBatchSummary } from '@visual-edit/core';
import { ApiRouteContext, clampTimeoutMs, readJsonBody, sendJson } from './routes-context.js';

interface HookRequestBody {
  harness?: string;
  sessionId?: string;
  event?: 'PostToolUse' | 'Stop' | 'SessionEnd' | 'Interrupt' | 'PreInvocation' | 'Wait';
  seenCursor?: number;
  waitMs?: unknown;
  waiterId?: string;
}

function isLeaseOwnerSession(
  lease: { connected: boolean; sessionId?: string },
  sessionId: string
): boolean {
  return Boolean(
    lease.connected &&
      (!lease.sessionId ||
        lease.sessionId === sessionId ||
        lease.sessionId === 'default' ||
        lease.sessionId === 'waiter')
  );
}

function buildInterruptionReason(batch: VisualEditBatch, event: string, harness: string): string {
  const summary = formatBatchSummary(batch);

  const allCommentText = [
    ...(batch.annotations || []).map((a) => a.comment || ''),
    ...(batch.voiceReviews || []).map((v) => v.transcript || ''),
    ...(batch.voiceReviews || []).flatMap((v) => (v.sections || []).map((s) => s.transcript || '')),
    batch.userPrompt || '',
  ].join(' ');

  const asksForVariants = /\b(options?|variants?|alternatives?|choices?|different designs?)\b/i.test(allCommentText);
  const formatRestartStep = (stepNumber: number): string =>
    event === 'Wait' || harness === 'antigravity'
      ? `\n${stepNumber}. If working in Antigravity, start a fresh background listener (\`npx lux-edit hook wait\` with \`WaitMsBeforeAsync: 500, IsDaemon: false\`) before ending your turn so the next browser action wakes you seamlessly.`
      : '';

  const actionDirective = asksForVariants
    ? `ACTION REQUIRED (COMPONENT VARIANTS REQUESTED):
The user has explicitly asked for visual options/variants in the browser.
1. DO NOT simply edit one style and do NOT mark resolved.
2. Call \`lux_propose_variants\` (or POST /__visual_edit__/api/variants) proposing 2-4 distinct, creative design options for the targeted element so the user can preview them live in the browser overlay.
3. Finish your turn and wait for the user to make a variant decision.${formatRestartStep(4)}`
    : `ACTION REQUIRED (IMPLEMENT VISUAL FEEDBACK):
1. Locate the source component files referenced in the summary below.
2. Apply the requested visual edits or comment suggestions directly to the codebase.
3. Once applied, call \`lux_resolve_review\` (or POST /__visual_edit__/api/status with action 'resolve').
4. DO NOT dismiss or mark this review resolved without making changes or proposing variants.${formatRestartStep(5)}`;

  return `[LUX VISUAL REVIEW INTERRUPTION]
A live user visual action just occurred in the browser. Visual feedback takes absolute precedence over any prior conversation.

${actionDirective}

---
${summary}
---`;
}

export async function handleHooksRoute(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ApiRouteContext
): Promise<boolean> {
  try {
    const payload = await readJsonBody<HookRequestBody>(req);
    const harness = String(payload.harness || 'unknown');
    const sessionId = String(payload.sessionId || 'default');
    const event = payload.event || 'Stop';
    const seenCursor = typeof payload.seenCursor === 'number' ? payload.seenCursor : undefined;
    const waitMs = clampTimeoutMs(payload.waitMs, 25000, 100, 60000);
    const waiterId = typeof payload.waiterId === 'string' ? payload.waiterId : undefined;

    const lease = ctx.eventStore.registerHookEvent({
      harness,
      sessionId,
      event,
      seenCursor,
    });

    if (event === 'SessionEnd' || event === 'Interrupt') {
      sendJson(res, { listening: false });
      return true;
    }

    if (event === 'PostToolUse') {
      sendJson(res, { listening: true, lease });
      return true;
    }

    if (event === 'PreInvocation') {
      if (!isLeaseOwnerSession(lease, sessionId)) {
        sendJson(res, { listening: false, feedbackAvailable: false });
        return true;
      }

      const pending = ctx.eventStore.getSubmittedPendingReview({
        afterCursor: lease.seenCursor,
      });
      if (!pending) {
        sendJson(res, { listening: true, feedbackAvailable: false });
        return true;
      }

      const summary = formatBatchSummary(pending);
      const reason = `[LUX VISUAL REVIEW INTERRUPTION]
Pending visual feedback from the browser is ready to be applied alongside the user's message.

${summary}`;

      sendJson(res, {
        listening: true,
        feedbackAvailable: true,
        cursor: pending.latestCursor ?? ctx.eventStore.getLatestCursor(),
        sessionId: pending.id,
        revisionHash: pending.revisionHash,
        reason,
      });
      return true;
    }

    // Strict Session Affinity: only the session that bound the lease via PostToolUse (or background Wait) may hold on Stop.
    if (event === 'Stop' && !isLeaseOwnerSession(lease, sessionId)) {
      sendJson(res, {
        listening: false,
        feedbackAvailable: false,
        ignored: true,
        reason: 'Session does not own visual review lease',
      });
      return true;
    }

    if (event === 'Stop' || event === 'Wait') {
      const waitResult = await ctx.eventStore.waitForFeedback({
        afterCursor: lease.seenCursor,
        timeoutMs: waitMs,
        waiterId,
        source: event === 'Wait' ? 'background_waiter' : 'stop_hook',
      });

      if (waitResult.superseded) {
        sendJson(res, {
          listening: false,
          feedbackAvailable: false,
          superseded: true,
        });
        return true;
      }

      if (waitResult.ended) {
        sendJson(res, {
          listening: false,
          feedbackAvailable: false,
          endedByUser: true,
        });
        return true;
      }

      if (waitResult.batch) {
        const b = waitResult.batch;
        sendJson(res, {
          listening: true,
          feedbackAvailable: true,
          cursor: waitResult.cursor,
          sessionId: b.id,
          revisionHash: b.revisionHash,
          reviewMode: ctx.eventStore.getReviewMode(),
          connectedClients: ctx.wsHub.getConnectedClientCount(),
          reason: buildInterruptionReason(b, event, harness),
        });
        return true;
      }

      sendJson(res, {
        listening: true,
        feedbackAvailable: false,
        cursor: waitResult.cursor,
        reviewMode: ctx.eventStore.getReviewMode(),
        connectedClients: ctx.wsHub.getConnectedClientCount(),
      });
      return true;
    }

    sendJson(res, { listening: lease.connected, lease });
  } catch {
    sendJson(res, { error: 'Invalid hook payload' }, 400);
  }
  return true;
}
