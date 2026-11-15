import { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import { API_ROUTES, ViewportPreset, checkForUpdates } from '@visual-edit/core';
import {
  ApiRouteContext,
  clampTimeoutMs,
  readJsonBody,
  sendJson,
} from './routes-context.js';
import { handleHooksRoute } from './routes-hooks.js';
import { handleEditsPostRoute, handlePendingRoute } from './routes-sessions.js';
import { handleStatusRoute } from './routes-status.js';
import { handleVariantsRoute } from './routes-variants.js';

export type { ApiRouteContext };
export { readJsonBody, sendJson };

interface CaptureRequestBody {
  timeoutMs?: unknown;
  selector?: string;
  viewport?: ViewportPreset;
  resolution?: 'draft' | 'full';
  includeOverlay?: unknown;
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
        Pragma: 'no-cache',
        Expires: '0',
      });
      fs.createReadStream(ctx.overlayScriptPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Overlay bundle not found. Run `pnpm build` first.');
    }
    return true;
  }

  if (pathname === API_ROUTES.EDITS && req.method === 'POST') {
    return handleEditsPostRoute(req, res, ctx);
  }

  if (pathname === API_ROUTES.HOOKS && req.method === 'POST') {
    return handleHooksRoute(req, res, ctx);
  }

  if (pathname === API_ROUTES.CAPTURE && req.method === 'POST') {
    try {
      const body = await readJsonBody<CaptureRequestBody>(req);
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

  if (pathname === API_ROUTES.VARIANTS) {
    return handleVariantsRoute(req, res, url, ctx);
  }

  if (pathname === API_ROUTES.STATUS) {
    return handleStatusRoute(req, res, ctx);
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
    return handlePendingRoute(res, url, ctx);
  }

  return false;
}
