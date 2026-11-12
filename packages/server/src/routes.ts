import { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import {
  API_ROUTES,
  checkForUpdates,
  formatBatchSummary,
} from '@visual-edit/core';
import { EventStore } from './event-store.js';
import { WebSocketHub } from './ws-hub.js';

export interface ApiRouteContext {
  eventStore: EventStore;
  wsHub: WebSocketHub;
  appId: string;
  version: string;
  port: number;
  overlayScriptPath: string;
}

export function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(
  res: ServerResponse,
  data: any,
  statusCode: number = 200,
  headers?: Record<string, string>
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(data));
}

function clampTimeoutMs(raw: unknown, defaultMs: number, minMs: number, maxMs: number): number {
  const num = typeof raw === 'number' ? raw : raw !== null && raw !== undefined ? Number(raw) : NaN;
  if (!Number.isFinite(num)) return defaultMs;
  const floored = Math.floor(num);
  if (floored < minMs) return minMs;
  if (floored > maxMs) return maxMs;
  return floored;
}

/**
 * Dispatches API requests. Returns true if the route was handled, false otherwise.
 */
export async function handleApiRoute(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
  ctx: ApiRouteContext
): Promise<boolean> {
  if (pathname === API_ROUTES.OVERLAY_JS) {
    if (fs.existsSync(ctx.overlayScriptPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      fs.createReadStream(ctx.overlayScriptPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Overlay bundle not found. Run `pnpm build` first.');
    }
    return true;
  }

  if (pathname === API_ROUTES.EDITS && req.method === 'POST') {
    try {
      const batch = await readJsonBody(req);
      if (ctx.appId && batch.appId && batch.appId !== ctx.appId) {
        console.warn(`[lux] Dropping REST batch from mismatched appId: ${batch.appId} (expected: ${ctx.appId})`);
        sendJson(res, { error: 'App ID mismatch' }, 400);
        return true;
      }
      if (!batch.appId) {
        batch.appId = ctx.appId;
      }
      ctx.eventStore.saveBatch(batch);
      const effectiveMode = batch.reviewMode || ctx.eventStore.getReviewMode();
      if (batch.status === 'submitted' || effectiveMode === 'live') {
        ctx.wsHub.broadcast({
          type: 'STATUS_CHANGE',
          sessionId: batch.id,
          payload: { status: 'submitted' },
        });
      }
      sendJson(res, {
        success: true,
        id: batch.id,
        revisionHash: batch.revisionHash,
        latestCursor: batch.latestCursor,
      });
    } catch {
      sendJson(res, { error: 'Invalid JSON payload' }, 400);
    }
    return true;
  }

  // Lifecycle Hook Endpoint (Antigravity, Claude Code, Codex)
  if (pathname === API_ROUTES.HOOKS && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
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
        const isLeaseOwner =
          lease.connected &&
          (!lease.sessionId ||
            lease.sessionId === sessionId ||
            lease.sessionId === 'default' ||
            lease.sessionId === 'waiter');

        if (!isLeaseOwner) {
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

      // Strict Session Affinity:
      // For Stop events, only the session that bound the lease via PostToolUse (or background Wait) may hold.
      if (
        event === 'Stop' &&
        (!lease.connected ||
          (lease.sessionId &&
            lease.sessionId !== sessionId &&
            lease.sessionId !== 'default' &&
            lease.sessionId !== 'waiter'))
      ) {
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
          const summary = formatBatchSummary(b);

          const allCommentText = [
            ...(b.annotations || []).map((a) => a.comment || ''),
            ...(b.voiceReviews || []).map((v) => v.transcript || ''),
            ...(b.voiceReviews || []).flatMap((v) => (v.sections || []).map((s) => s.transcript || '')),
            b.userPrompt || '',
          ].join(' ');

          const asksForVariants = /\b(options?|variants?|alternatives?|choices?|different designs?)\b/i.test(allCommentText);

          const restartWaiterStep =
            event === 'Wait' || harness === 'antigravity'
              ? `\n4. If working in Antigravity, start a fresh background listener (\`npx lux-edit hook wait\` with \`WaitMsBeforeAsync: 500, IsDaemon: false\`) before ending your turn so the next browser action wakes you seamlessly.`
              : '';

          let actionDirective = '';
          if (asksForVariants) {
            actionDirective = `ACTION REQUIRED (COMPONENT VARIANTS REQUESTED):
The user has explicitly asked for visual options/variants in the browser.
1. DO NOT simply edit one style and do NOT mark resolved.
2. Call \`lux_propose_variants\` (or POST /__visual_edit__/api/variants) proposing 2-4 distinct, creative design options for the targeted element so the user can preview them live in the browser overlay.
3. Finish your turn and wait for the user to make a variant decision.${restartWaiterStep}`;
          } else {
            actionDirective = `ACTION REQUIRED (IMPLEMENT VISUAL FEEDBACK):
1. Locate the source component files referenced in the summary below.
2. Apply the requested visual edits or comment suggestions directly to the codebase.
3. Once applied, call \`lux_resolve_review\` (or POST /__visual_edit__/api/status with action 'resolve').
4. DO NOT dismiss or mark this review resolved without making changes or proposing variants.${restartWaiterStep}`;
          }

          const reason = `[LUX VISUAL REVIEW INTERRUPTION]
A live user visual action just occurred in the browser. Visual feedback takes absolute precedence over any prior conversation.

${actionDirective}

---
${summary}
---`;

          sendJson(res, {
            listening: true,
            feedbackAvailable: true,
            cursor: waitResult.cursor,
            sessionId: b.id,
            revisionHash: b.revisionHash,
            reviewMode: ctx.eventStore.getReviewMode(),
            connectedClients: ctx.wsHub.getConnectedClientCount(),
            reason,
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

  // Visual Capture Endpoint (Bridges MCP lux_capture_visual to Browser via WebSocket)
  if (pathname === API_ROUTES.CAPTURE && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const timeoutMs = clampTimeoutMs(body.timeoutMs, 12000, 500, 30000);
      const captureResult = await ctx.wsHub.requestVisualCapture(
        {
          selector: body.selector,
          viewport: body.viewport,
          resolution: body.resolution || 'draft',
          includeOverlay: Boolean(body.includeOverlay),
        },
        timeoutMs
      );
      sendJson(res, captureResult, captureResult.success ? 200 : 422);
    } catch {
      sendJson(res, { success: false, error: 'Invalid capture request' }, 400);
    }
    return true;
  }

  // Component Variants Endpoint (lux_propose_variants & variant decisions)
  if (pathname === API_ROUTES.VARIANTS) {
    if (req.method === 'GET') {
      const selector = url.searchParams.get('selector') || undefined;
      sendJson(res, ctx.eventStore.getVariantSets(selector));
      return true;
    }
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if (body.action === 'dismiss' || body.action === 'delete') {
          const deleted = ctx.eventStore.deleteVariantSet(body.setId, body.sessionId);
          sendJson(res, { success: deleted });
          return true;
        }

        if (body.action === 'revert') {
          const reverted = ctx.eventStore.revertVariantDecision(body.setId, body.sessionId);
          sendJson(res, { success: reverted });
          return true;
        }

        if (body.action === 'decide') {
          const decision = ctx.eventStore.recordVariantDecision({
            setId: body.setId,
            selectedVariantId: body.selectedVariantId,
            userNote: body.userNote,
            targetHash: body.targetHash,
            sessionId: body.sessionId,
          });
          if (!decision) {
            sendJson(res, { error: 'Variant set or variant ID not found' }, 404);
            return true;
          }
          sendJson(res, { success: true, decision });
          return true;
        }

        if (!body.targetSelector || !Array.isArray(body.variants) || body.variants.length === 0) {
          sendJson(res, { error: 'targetSelector and non-empty variants array are required' }, 400);
          return true;
        }

        const variantSet = ctx.eventStore.proposeVariants({
          targetSelector: body.targetSelector,
          label: body.label,
          expectedHash: body.expectedHash,
          variants: body.variants,
        });
        sendJson(res, { success: true, variantSet });
      } catch {
        sendJson(res, { error: 'Invalid variants payload' }, 400);
      }
      return true;
    }
  }

  // Server Status & Resolution Endpoint
  if (pathname === API_ROUTES.STATUS) {
    if (req.method === 'GET') {
      const pendingReview = ctx.eventStore.getPendingReview({
        port: ctx.port,
        appId: ctx.appId,
      });
      const hasPendingReview = Boolean(
        pendingReview &&
          (pendingReview.status === 'submitted' || ctx.eventStore.getReviewMode() === 'live')
      );
      sendJson(res, {
        appId: ctx.appId,
        version: ctx.version,
        reviewMode: ctx.eventStore.getReviewMode(),
        latestCursor: ctx.eventStore.getLatestCursor(),
        hookLease: ctx.eventStore.getHookLeaseStatus(),
        waiterConnected: ctx.eventStore.isBackgroundWaiterConnected(),
        connectedClients: ctx.wsHub.getConnectedClientCount(),
        hasPendingReview,
        pendingSessionId: hasPendingReview ? pendingReview?.id : undefined,
      });
      return true;
    }
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if (body.action === 'setReviewMode' && (body.reviewMode === 'live' || body.reviewMode === 'batch')) {
          ctx.eventStore.setReviewMode(body.reviewMode);
          sendJson(res, { success: true, reviewMode: ctx.eventStore.getReviewMode() });
          return true;
        }
        if (body.action === 'endLiveReview') {
          ctx.eventStore.endLiveReview();
          sendJson(res, { success: true });
          return true;
        }
        if (body.action === 'resolve') {
          const targetId = body.sessionId || ctx.eventStore.getPendingReview({ appId: ctx.appId })?.id;
          if (!targetId) {
            sendJson(res, { updated: false, error: 'No active session found' }, 404);
            return true;
          }

          const pendingSession = ctx.eventStore.getSession(targetId);
          const hasUnresolvedItems = Boolean(
            pendingSession &&
              ((pendingSession.annotations && pendingSession.annotations.length > 0) ||
                (pendingSession.mutations && pendingSession.mutations.length > 0) ||
                (pendingSession.voiceReviews && pendingSession.voiceReviews.length > 0))
          );

          const hasModifications = Boolean(
            (Array.isArray(body.modifiedSelectors) && body.modifiedSelectors.length > 0) ||
              body.expectedHash ||
              body.force === true
          );

          // Check if variants were proposed or decided
          const activeVariants = ctx.eventStore.getVariantSets();
          const hasActiveVariants = activeVariants.some(
            (vs) => vs.status === 'pending' || vs.status === 'decided'
          );

          if (hasUnresolvedItems && !hasModifications && !hasActiveVariants) {
            sendJson(res, {
              updated: false,
              error:
                'Cannot resolve session: the session contains visual feedback, but no modified selectors, expectedHash, or proposed variants were provided. To propose visual options, call lux_propose_variants. If you want to force resolve without changes, pass force: true.',
            }, 400);
            return true;
          }

          const result = ctx.eventStore.updateStatus(
            targetId,
            body.status || 'implemented',
            body.reply ? { agentId: body.agentId || 'agent', message: body.reply } : undefined,
            {
              expectedHash: body.expectedHash,
              modifiedSelectors: body.modifiedSelectors,
            }
          );
          sendJson(res, { sessionId: targetId, ...result }, result.staleConflict ? 409 : 200);
          return true;
        }
        sendJson(res, { error: 'Unknown status action' }, 400);
      } catch {
        sendJson(res, { error: 'Invalid status payload' }, 400);
      }
      return true;
    }
  }

  if ((pathname === API_ROUTES.SESSIONS || pathname === '/__lux/api/sessions') && req.method === 'GET') {
    sendJson(res, ctx.eventStore.listSessions());
    return true;
  }

  if ((pathname === API_ROUTES.VERSION || pathname === '/__lux/api/version') && req.method === 'GET') {
    try {
      const result = await checkForUpdates(ctx.version);
      sendJson(res, result, 200, { 'Cache-Control': 'no-cache' });
    } catch {
      sendJson(res, {
        updateAvailable: false,
        currentVersion: ctx.version,
        latestVersion: ctx.version,
        changelogUrl: 'https://github.com/David-Sat/lux-edit/releases',
      });
    }
    return true;
  }

  if ((pathname === API_ROUTES.PENDING || pathname === '/__lux/api/pending') && req.method === 'GET') {
    const activeSessionIds = ctx.wsHub.getActiveSessionIds();
    const afterCursorParam = url.searchParams.get('afterCursor');
    const afterCursor = afterCursorParam !== null ? parseInt(afterCursorParam, 10) : undefined;
    const waitMsParam = url.searchParams.get('waitMs');
    const parsedWaitMs = waitMsParam !== null ? parseInt(waitMsParam, 10) : 0;
    const waitMs = clampTimeoutMs(parsedWaitMs, 0, 0, 60000);
    const shouldClaim = url.searchParams.get('claim') === 'true' || url.searchParams.get('claim') === '1';
    const shouldResolve = url.searchParams.get('resolve') === 'true' || url.searchParams.get('resolve') === '1';

    const handlePendingResponse = (pending: any) => {
      if (pending && shouldResolve) {
        const verificationTargets = ctx.eventStore.markPendingSessionsImplemented({
          port: ctx.port,
          appId: ctx.appId,
          sessionId: pending.id,
        });
        ctx.wsHub.broadcast({
          type: 'STATUS_CHANGE',
          sessionId: pending.id,
          payload: { status: 'implemented', replies: [], verificationTargets },
        });
      } else if (pending && shouldClaim && pending.status !== 'in_progress') {
        ctx.eventStore.updateStatus(pending.id, 'in_progress');
      }

      sendJson(res, pending || null);
    };

    const currentPending = ctx.eventStore.getPendingReview({
      port: ctx.port,
      appId: ctx.appId,
      activeSessionIds,
      afterCursor: !isNaN(afterCursor as number) ? afterCursor : undefined,
    });

    if (currentPending || !waitMs || isNaN(waitMs) || waitMs <= 0) {
      handlePendingResponse(currentPending);
      return true;
    }

    try {
      const resWait = await ctx.eventStore.waitForFeedback({
        afterCursor: !isNaN(afterCursor as number) ? afterCursor : 0,
        timeoutMs: waitMs,
      });
      handlePendingResponse(resWait.batch);
    } catch {
      handlePendingResponse(null);
    }
    return true;
  }

  return false;
}
