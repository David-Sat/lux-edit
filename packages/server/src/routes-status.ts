import { IncomingMessage, ServerResponse } from 'node:http';
import { ReviewMode, SessionStatus } from '@visual-edit/core';
import { ApiRouteContext, readJsonBody, sendJson } from './routes-context.js';

interface StatusRequestBody {
  action?: 'setReviewMode' | 'endLiveReview' | 'resolve';
  reviewMode?: ReviewMode;
  sessionId?: string;
  modifiedSelectors?: string[];
  expectedHash?: string;
  force?: boolean;
  status?: SessionStatus;
  reply?: string;
  agentId?: string;
}

export async function handleStatusRoute(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ApiRouteContext
): Promise<boolean> {
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

  if (req.method !== 'POST') {
    return false;
  }

  try {
    const body = await readJsonBody<StatusRequestBody>(req);
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

      const activeVariants = ctx.eventStore.getVariantSets();
      const hasActiveVariants = activeVariants.some(
        (vs) => vs.status === 'pending' || vs.status === 'decided'
      );

      if (hasUnresolvedItems && !hasModifications && !hasActiveVariants) {
        sendJson(
          res,
          {
            updated: false,
            error:
              'Cannot resolve session: the session contains visual feedback, but no modified selectors, expectedHash, or proposed variants were provided. To propose visual options, call lux_propose_variants. If you want to force resolve without changes, pass force: true.',
          },
          400
        );
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
