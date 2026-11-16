import { IncomingMessage, ServerResponse } from 'node:http';
import { VisualEditBatch } from '@visual-edit/core';
import { ApiRouteContext, clampTimeoutMs, readJsonBody, sendJson } from './routes-context.js';

export async function handleEditsPostRoute(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ApiRouteContext
): Promise<boolean> {
  try {
    const batch = await readJsonBody<VisualEditBatch>(req);
    if (ctx.appId && batch.appId && batch.appId !== ctx.appId) {
      console.warn(`[lux] Dropping REST batch from mismatched appId: ${batch.appId} (expected: ${ctx.appId})`);
      sendJson(res, { error: 'App ID mismatch' }, 400);
      return true;
    }
    if (!batch.appId) {
      batch.appId = ctx.appId;
    }
    const effectiveMode = batch.reviewMode || ctx.eventStore.getReviewMode();
    const isLive = effectiveMode === 'live';
    const isExplicitSubmit = batch.status === 'submitted';
    const saved = ctx.eventStore.saveBatch(batch, {
      forceSubmit: isExplicitSubmit || isLive,
      explicitSubmit: isExplicitSubmit,
    });
    if (saved && (batch.status === 'submitted' || isLive)) {
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

export async function handlePendingRoute(
  res: ServerResponse,
  url: URL,
  ctx: ApiRouteContext
): Promise<boolean> {
  const activeSessionIds = ctx.wsHub.getActiveSessionIds();
  const afterCursorParam = url.searchParams.get('afterCursor');
  const afterCursor = afterCursorParam !== null ? parseInt(afterCursorParam, 10) : undefined;
  const waitMsParam = url.searchParams.get('waitMs');
  const parsedWaitMs = waitMsParam !== null ? parseInt(waitMsParam, 10) : 0;
  const waitMs = clampTimeoutMs(parsedWaitMs, 0, 0, 60000);
  const shouldClaim = url.searchParams.get('claim') === 'true' || url.searchParams.get('claim') === '1';
  const shouldResolve = url.searchParams.get('resolve') === 'true' || url.searchParams.get('resolve') === '1';

  const handlePendingResponse = (pending: VisualEditBatch | null) => {
    if (pending && shouldResolve) {
      const verificationTargets = ctx.eventStore.markPendingSessionsImplemented({
        port: ctx.port,
        appId: ctx.appId,
        basePath: ctx.basePath,
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
    basePath: ctx.basePath,
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
