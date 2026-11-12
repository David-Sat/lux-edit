import http, { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import httpProxy from 'http-proxy';
import sirv from 'sirv';
import {
  API_ROUTES,
  SERVER_METADATA_DIR,
  SERVER_METADATA_FILE,
  LuxServerMetadata,
  checkForUpdates,
  stripTrailingSlashes,
  formatBatchSummary,
} from '@visual-edit/core';
import { EventStore } from './event-store.js';
import { WebSocketHub } from './ws-hub.js';

export interface VisualEditServerOptions {
  port: number;
  host: string;
  target: string; // URL (http://...) or local file/dir path
  rootDir?: string;
  basePath?: string;
  strictPort?: boolean;
  appId?: string;
}

let serverPkgVersion = '0.13.0';
try {
  serverPkgVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
} catch {}

export class VisualEditServer {
  public readonly appId: string;
  public readonly version: string = serverPkgVersion;
  private server: http.Server;
  private proxy: httpProxy | null = null;
  private isStatic = false;
  private staticHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
  private singleHtmlFile: string | null = null;
  private staticDir: string | null = null;
  private overlayScriptPath: string;
  private eventStore: EventStore;
  private wsHub: WebSocketHub;
  private options: VisualEditServerOptions;
  private basePath: string;
  private rootDir: string;
  private fileWatcher: fs.FSWatcher | null = null;
  private reloadDebounce: NodeJS.Timeout | null = null;

  constructor(options: VisualEditServerOptions) {
    this.options = options;
    this.rootDir = path.resolve(options.rootDir || process.cwd());
    this.appId = options.appId || this.computeAppId(options.target, this.rootDir);
    this.eventStore = EventStore.getInstance(this.rootDir);

    let basePath = (options.basePath || process.env.LUX_BASE_PATH || '').trim();
    if (basePath) {
      if (!basePath.startsWith('/')) basePath = '/' + basePath;
      basePath = stripTrailingSlashes(basePath);
    }
    this.basePath = basePath;
    this.overlayScriptPath = this.resolveOverlayPath();

    if (options.target.startsWith('http://') || options.target.startsWith('https://')) {
      this.isStatic = false;
      this.proxy = httpProxy.createProxyServer({
        target: options.target,
        changeOrigin: true,
        ws: true,
        selfHandleResponse: true,
      });

      this.setupProxyHandlers();
      this.setupFileWatcher(this.rootDir);
    } else {
      this.isStatic = true;
      const cwdResolved = path.resolve(process.cwd(), options.target);
      const rootResolved = path.resolve(this.rootDir, options.target);
      const targetPath = fs.existsSync(cwdResolved) ? cwdResolved : rootResolved;

      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        this.singleHtmlFile = targetPath;
        this.staticDir = path.dirname(targetPath);
        this.staticHandler = sirv(this.staticDir, { dev: true });
        this.setupFileWatcher(targetPath);
      } else {
        this.staticDir = targetPath;
        this.staticHandler = sirv(targetPath, { dev: true, single: true });
        this.setupFileWatcher(targetPath);
      }
    }

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.wsHub = new WebSocketHub(this.server, this.eventStore, this.basePath, this.appId);

    // Forward WebSocket upgrades to upstream proxy if not our ws endpoint
    if (this.proxy) {
      this.server.on('upgrade', (req, socket, head) => {
        const pathname = req.url ? new URL(req.url, `http://${req.headers.host}`).pathname : '';
        const isVisualEditWs =
          pathname === API_ROUTES.WS ||
          (this.basePath && pathname === `${this.basePath}${API_ROUTES.WS}`);

        if (!isVisualEditWs) {
          this.proxy?.ws(req, socket, head);
        }
      });
    }
  }

  private computeAppId(target: string, rootDir: string): string {
    const isUrl = target.startsWith('http://') || target.startsWith('https://');
    const resolvedTarget = isUrl ? target : path.resolve(rootDir, target);
    const hash = crypto.createHash('sha256').update(resolvedTarget).digest('hex').slice(0, 8);
    const name = isUrl
      ? target.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      : path.basename(resolvedTarget).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${name || 'app'}_${hash}`.toLowerCase();
  }

  private setupFileWatcher(watchTarget: string): void {
    if (!fs.existsSync(watchTarget)) return;
    const isFile = fs.statSync(watchTarget).isFile();

    try {
      this.fileWatcher = fs.watch(watchTarget, { recursive: !isFile }, (eventType, filename) => {
        if (filename) {
          if (
            filename.startsWith('.') ||
            filename.includes('.visual-edit') ||
            filename.includes('node_modules') ||
            filename.includes('dist') ||
            filename.includes('.git')
          ) {
            return;
          }
        }
        if (this.reloadDebounce) clearTimeout(this.reloadDebounce);
        this.reloadDebounce = setTimeout(() => {
          console.log(`[lux] Detected code change in ${filename || watchTarget}, resolving active review and notifying browser...`);
          const verificationTargets = this.eventStore.markPendingSessionsImplemented({
            port: this.options.port,
            appId: this.appId,
            onlyIfOlderThanReviewTurn: true,
          });
          this.wsHub.broadcast({
            type: 'RELOAD_PAGE',
            payload: {
              file: filename || watchTarget,
              verificationTargets,
            },
          });
        }, 150);
      });
      this.fileWatcher.on('error', (err) => {
        console.debug('[lux] File watcher error:', err);
      });
    } catch {
      console.debug('[lux] File watch not active for target:', watchTarget);
    }
  }

  private resolveOverlayPath(): string {
    const candidatePaths = [
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './overlay.js'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../overlay/dist/overlay.js'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../overlay/overlay.js'),
      path.resolve(process.cwd(), 'packages/overlay/dist/overlay.js'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
    return candidatePaths[0];
  }

  private setupProxyHandlers(): void {
    if (!this.proxy) return;

    this.proxy.on('proxyReq', (proxyReq) => {
      // Force upstream to send uncompressed HTML so we can safely inject the overlay script
      proxyReq.setHeader('accept-encoding', 'identity');
    });

    this.proxy.on('proxyRes', (proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      const isHtml = contentType.includes('text/html');

      // Strip Content-Length, Content-Encoding, and CSP for HTML injection
      const headers = { ...proxyRes.headers };
      if (isHtml) {
        delete headers['content-length'];
        delete headers['content-encoding'];
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
      }

      if (!isHtml) {
        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
        return;
      }

      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      proxyRes.on('end', () => {
        let buffer = Buffer.concat(chunks);
        const encoding = (proxyRes.headers['content-encoding'] || '').toLowerCase();
        try {
          if (encoding.includes('gzip')) {
            buffer = zlib.gunzipSync(buffer);
          } else if (encoding.includes('br')) {
            buffer = zlib.brotliDecompressSync(buffer);
          } else if (encoding.includes('deflate')) {
            buffer = zlib.inflateSync(buffer);
          }
        } catch (err: any) {
          console.error('[lux] Failed to decompress upstream HTML payload:', err.message);
        }

        const body = buffer.toString('utf-8');
        const injected = this.injectOverlayScript(body);
        if (!res.headersSent) {
          res.writeHead(proxyRes.statusCode || 200, headers);
        }
        res.end(injected);
      });
    });

    this.proxy.on('error', (err, req, res) => {
      console.error('[lux] Proxy error:', err.message);
      if (res && 'writeHead' in res && !(res as ServerResponse).headersSent) {
        (res as ServerResponse).writeHead(502, { 'Content-Type': 'text/plain' });
        (res as ServerResponse).end(`Proxy error: Cannot reach upstream target at ${this.options.target}`);
      } else if (res && 'destroy' in res && typeof (res as any).destroy === 'function') {
        (res as any).destroy();
      }
    });
  }

  private injectOverlayScript(html: string): string {
    const scriptSrc = `${this.basePath}${API_ROUTES.OVERLAY_JS}`;
    const configScript = `<script>window.__LUX_APP_ID__ = ${JSON.stringify(this.appId)}; window.__LUX_VERSION__ = ${JSON.stringify(this.version)};</script>`;
    const scriptTag = `${configScript}\n<script type="module" src="${scriptSrc}"></script>`;
    if (html.includes('</head>')) {
      return html.replace('</head>', `${scriptTag}\n</head>`);
    }
    if (html.includes('</body>')) {
      return html.replace('</body>', `${scriptTag}\n</body>`);
    }
    return `${html}\n${scriptTag}`;
  }

  private readJsonBody(req: IncomingMessage): Promise<any> {
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

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    let pathname = '/';
    let url: URL;
    try {
      url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      pathname = url.pathname;
    } catch {
      url = new URL('/', 'http://localhost');
      pathname = (req.url || '/').split('?')[0];
    }

    if (this.basePath && pathname.startsWith(this.basePath)) {
      pathname = pathname.slice(this.basePath.length) || '/';
    }

    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === API_ROUTES.OVERLAY_JS) {
      if (fs.existsSync(this.overlayScriptPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        });
        fs.createReadStream(this.overlayScriptPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Overlay bundle not found. Run `pnpm build` first.');
      }
      return;
    }

    if (pathname === API_ROUTES.EDITS && req.method === 'POST') {
      this.readJsonBody(req)
        .then((batch) => {
          if (this.appId && batch.appId && batch.appId !== this.appId) {
            console.warn(`[lux] Dropping REST batch from mismatched appId: ${batch.appId} (expected: ${this.appId})`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'App ID mismatch' }));
            return;
          }
          if (!batch.appId) {
            batch.appId = this.appId;
          }
          this.eventStore.saveBatch(batch);
          const effectiveMode = batch.reviewMode || this.eventStore.getReviewMode();
          if (batch.status === 'submitted' || effectiveMode === 'live') {
            this.wsHub.broadcast({
              type: 'STATUS_CHANGE',
              sessionId: batch.id,
              payload: { status: 'submitted' },
            });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              id: batch.id,
              revisionHash: batch.revisionHash,
              latestCursor: batch.latestCursor,
            })
          );
        })
        .catch(() => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        });
      return;
    }

    // Lifecycle Hook Endpoint (Antigravity, Claude Code, Codex)
    if (pathname === API_ROUTES.HOOKS && req.method === 'POST') {
      this.readJsonBody(req)
        .then(async (payload) => {
          const harness = String(payload.harness || 'unknown');
          const sessionId = String(payload.sessionId || 'default');
          const event = payload.event || 'Stop';
          const seenCursor = typeof payload.seenCursor === 'number' ? payload.seenCursor : undefined;
          const waitMs = typeof payload.waitMs === 'number' ? payload.waitMs : 25000;
          const waiterId = typeof payload.waiterId === 'string' ? payload.waiterId : undefined;

          const lease = this.eventStore.registerHookEvent({
            harness,
            sessionId,
            event,
            seenCursor,
          });

          if (event === 'SessionEnd' || event === 'Interrupt') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ listening: false }));
            return;
          }

          if (event === 'PostToolUse') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                listening: true,
                lease,
              })
            );
            return;
          }

          if (event === 'PreInvocation') {
            const isLeaseOwner =
              lease.connected &&
              (!lease.sessionId ||
                lease.sessionId === sessionId ||
                lease.sessionId === 'default' ||
                lease.sessionId === 'waiter');

            if (!isLeaseOwner) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ listening: false, feedbackAvailable: false }));
              return;
            }

            const pending = this.eventStore.getSubmittedPendingReview({
              afterCursor: lease.seenCursor,
            });
            if (!pending) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ listening: true, feedbackAvailable: false }));
              return;
            }

            const summary = formatBatchSummary(pending);
            const reason = `[LUX VISUAL REVIEW INTERRUPTION]
Pending visual feedback from the browser is ready to be applied alongside the user's message.

${summary}`;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                listening: true,
                feedbackAvailable: true,
                cursor: pending.latestCursor ?? this.eventStore.getLatestCursor(),
                sessionId: pending.id,
                revisionHash: pending.revisionHash,
                reason,
              })
            );
            return;
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
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                listening: false,
                feedbackAvailable: false,
                ignored: true,
                reason: 'Session does not own visual review lease',
              })
            );
            return;
          }

          if (event === 'Stop' || event === 'Wait') {
            const waitResult = await this.eventStore.waitForFeedback({
              afterCursor: lease.seenCursor,
              timeoutMs: waitMs,
              waiterId,
              source: event === 'Wait' ? 'background_waiter' : 'stop_hook',
            });

            if (waitResult.superseded) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  listening: false,
                  feedbackAvailable: false,
                  superseded: true,
                })
              );
              return;
            }

            if (waitResult.ended) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  listening: false,
                  feedbackAvailable: false,
                  endedByUser: true,
                })
              );
              return;
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

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  listening: true,
                  feedbackAvailable: true,
                  cursor: waitResult.cursor,
                  sessionId: b.id,
                  revisionHash: b.revisionHash,
                  reviewMode: this.eventStore.getReviewMode(),
                  connectedClients: this.wsHub.getConnectedClientCount(),
                  reason,
                })
              );
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                listening: true,
                feedbackAvailable: false,
                cursor: waitResult.cursor,
                reviewMode: this.eventStore.getReviewMode(),
                connectedClients: this.wsHub.getConnectedClientCount(),
              })
            );
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ listening: lease.connected, lease }));
        })
        .catch(() => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid hook payload' }));
        });
      return;
    }

    // Visual Capture Endpoint (Bridges MCP lux_capture_visual to Browser via WebSocket)
    if (pathname === API_ROUTES.CAPTURE && req.method === 'POST') {
      this.readJsonBody(req)
        .then(async (body) => {
          const timeoutMs = typeof body.timeoutMs === 'number' ? body.timeoutMs : 12000;
          const captureResult = await this.wsHub.requestVisualCapture(
            {
              selector: body.selector,
              viewport: body.viewport,
              resolution: body.resolution || 'draft',
              includeOverlay: Boolean(body.includeOverlay),
            },
            timeoutMs
          );
          res.writeHead(captureResult.success ? 200 : 422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(captureResult));
        })
        .catch(() => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid capture request' }));
        });
      return;
    }

    // Component Variants Endpoint (lux_propose_variants & variant decisions)
    if (pathname === API_ROUTES.VARIANTS) {
      if (req.method === 'GET') {
        const selector = url.searchParams.get('selector') || undefined;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.eventStore.getVariantSets(selector)));
        return;
      }
      if (req.method === 'POST') {
        this.readJsonBody(req)
          .then((body) => {
            if (body.action === 'dismiss' || body.action === 'delete') {
              const deleted = this.eventStore.deleteVariantSet(body.setId, body.sessionId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: deleted }));
              return;
            }

            if (body.action === 'revert') {
              const reverted = this.eventStore.revertVariantDecision(body.setId, body.sessionId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: reverted }));
              return;
            }

            if (body.action === 'decide') {
              const decision = this.eventStore.recordVariantDecision({
                setId: body.setId,
                selectedVariantId: body.selectedVariantId,
                userNote: body.userNote,
                targetHash: body.targetHash,
                sessionId: body.sessionId,
              });
              if (!decision) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Variant set or variant ID not found' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, decision }));
              return;
            }

            if (!body.targetSelector || !Array.isArray(body.variants) || body.variants.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'targetSelector and non-empty variants array are required' }));
              return;
            }

            const variantSet = this.eventStore.proposeVariants({
              targetSelector: body.targetSelector,
              label: body.label,
              expectedHash: body.expectedHash,
              variants: body.variants,
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, variantSet }));
          })
          .catch(() => {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid variants payload' }));
          });
        return;
      }
    }

    // Server Status & Resolution Endpoint
    if (pathname === API_ROUTES.STATUS) {
      if (req.method === 'GET') {
        const pendingReview = this.eventStore.getPendingReview({
          port: this.options.port,
          appId: this.appId,
        });
        const hasPendingReview = Boolean(
          pendingReview &&
            (pendingReview.status === 'submitted' || this.eventStore.getReviewMode() === 'live')
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            appId: this.appId,
            version: this.version,
            reviewMode: this.eventStore.getReviewMode(),
            latestCursor: this.eventStore.getLatestCursor(),
            hookLease: this.eventStore.getHookLeaseStatus(),
            waiterConnected: this.eventStore.isBackgroundWaiterConnected(),
            connectedClients: this.wsHub.getConnectedClientCount(),
            hasPendingReview,
            pendingSessionId: hasPendingReview ? pendingReview?.id : undefined,
          })
        );
        return;
      }
      if (req.method === 'POST') {
        this.readJsonBody(req)
          .then((body) => {
            if (body.action === 'setReviewMode' && (body.reviewMode === 'live' || body.reviewMode === 'batch')) {
              this.eventStore.setReviewMode(body.reviewMode);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, reviewMode: this.eventStore.getReviewMode() }));
              return;
            }
            if (body.action === 'endLiveReview') {
              this.eventStore.endLiveReview();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
              return;
            }
            if (body.action === 'resolve') {
              const targetId = body.sessionId || this.eventStore.getPendingReview({ appId: this.appId })?.id;
              if (!targetId) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ updated: false, error: 'No active session found' }));
                return;
              }

              const pendingSession = this.eventStore.getSession(targetId);
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
              const activeVariants = this.eventStore.getVariantSets();
              const hasActiveVariants = activeVariants.some(
                (vs) => vs.status === 'pending' || vs.status === 'decided'
              );

              if (hasUnresolvedItems && !hasModifications && !hasActiveVariants) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    updated: false,
                    error:
                      'Cannot resolve session: the session contains visual feedback, but no modified selectors, expectedHash, or proposed variants were provided. To propose visual options, call lux_propose_variants. If you want to force resolve without changes, pass force: true.',
                  })
                );
                return;
              }

              const result = this.eventStore.updateStatus(
                targetId,
                body.status || 'implemented',
                body.reply ? { agentId: body.agentId || 'agent', message: body.reply } : undefined,
                {
                  expectedHash: body.expectedHash,
                  modifiedSelectors: body.modifiedSelectors,
                }
              );
              res.writeHead(result.staleConflict ? 409 : 200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ sessionId: targetId, ...result }));
              return;
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unknown status action' }));
          })
          .catch(() => {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid status payload' }));
          });
        return;
      }
    }

    if ((pathname === API_ROUTES.SESSIONS || pathname === '/__lux/api/sessions') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.eventStore.listSessions()));
      return;
    }

    if ((pathname === API_ROUTES.VERSION || pathname === '/__lux/api/version') && req.method === 'GET') {
      checkForUpdates(this.version)
        .then((result) => {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify(result));
        })
        .catch(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              updateAvailable: false,
              currentVersion: this.version,
              latestVersion: this.version,
              changelogUrl: 'https://github.com/David-Sat/lux-edit/releases',
            })
          );
        });
      return;
    }

    if ((pathname === API_ROUTES.PENDING || pathname === '/__lux/api/pending') && req.method === 'GET') {
      const activeSessionIds = this.wsHub.getActiveSessionIds();
      const afterCursorParam = url.searchParams.get('afterCursor');
      const afterCursor = afterCursorParam !== null ? parseInt(afterCursorParam, 10) : undefined;
      const waitMsParam = url.searchParams.get('waitMs');
      const waitMs = waitMsParam !== null ? parseInt(waitMsParam, 10) : 0;
      const shouldClaim = url.searchParams.get('claim') === 'true' || url.searchParams.get('claim') === '1';
      const shouldResolve = url.searchParams.get('resolve') === 'true' || url.searchParams.get('resolve') === '1';

      const handlePendingResponse = (pending: any) => {
        if (pending && shouldResolve) {
          const verificationTargets = this.eventStore.markPendingSessionsImplemented({
            port: this.options.port,
            appId: this.appId,
            sessionId: pending.id,
          });
          this.wsHub.broadcast({
            type: 'STATUS_CHANGE',
            sessionId: pending.id,
            payload: { status: 'implemented', replies: [], verificationTargets },
          });
        } else if (pending && shouldClaim && pending.status !== 'in_progress') {
          this.eventStore.updateStatus(pending.id, 'in_progress');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pending || null));
      };

      const currentPending = this.eventStore.getPendingReview({
        port: this.options.port,
        appId: this.appId,
        activeSessionIds,
        afterCursor: !isNaN(afterCursor as number) ? afterCursor : undefined,
      });

      if (currentPending || !waitMs || isNaN(waitMs) || waitMs <= 0) {
        handlePendingResponse(currentPending);
        return;
      }

      this.eventStore
        .waitForFeedback({
          afterCursor: !isNaN(afterCursor as number) ? afterCursor : 0,
          timeoutMs: waitMs,
        })
        .then((resWait) => {
          handlePendingResponse(resWait.batch);
        })
        .catch(() => {
          handlePendingResponse(null);
        });
      return;
    }

    if (this.isStatic && this.singleHtmlFile) {
      if (pathname === '/' || pathname === `/${path.basename(this.singleHtmlFile)}` || pathname === '/index.html') {
        const rawHtml = fs.readFileSync(this.singleHtmlFile, 'utf-8');
        const injected = this.injectOverlayScript(rawHtml);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(injected);
        return;
      }
    }

    if (this.isStatic && this.staticDir) {
      const resolvedStaticRoot = path.resolve(this.staticDir);
      const safeRoot = resolvedStaticRoot.endsWith(path.sep)
        ? resolvedStaticRoot
        : resolvedStaticRoot + path.sep;

      let decodedPath = pathname;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: Invalid URL encoding');
        return;
      }

      if (decodedPath.includes('\0')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: Invalid path');
        return;
      }

      let cleanPath = decodedPath;
      if (cleanPath.endsWith('/')) {
        cleanPath += 'index.html';
      }

      const relativePath = cleanPath.replace(/^[/\\]+/, '');
      const directPath = path.resolve(resolvedStaticRoot, relativePath);

      const relToRoot = path.relative(resolvedStaticRoot, directPath);
      if (
        relToRoot.startsWith('..') ||
        path.isAbsolute(relToRoot) ||
        (!directPath.startsWith(safeRoot) && directPath !== resolvedStaticRoot)
      ) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden: Path Traversal Denied');
        return;
      }

      let candidateHtml: string | null = null;

      if (directPath.startsWith(safeRoot) || directPath === resolvedStaticRoot) {
        if (fs.existsSync(directPath)) {
          if (fs.statSync(directPath).isFile() && directPath.endsWith('.html')) {
            candidateHtml = directPath;
          } else if (fs.statSync(directPath).isDirectory()) {
            const indexHtml = path.resolve(directPath, 'index.html');
            if (indexHtml.startsWith(safeRoot) && fs.existsSync(indexHtml) && fs.statSync(indexHtml).isFile()) {
              candidateHtml = indexHtml;
            }
          }
        } else if (!path.extname(cleanPath)) {
          const withHtmlExt = path.resolve(resolvedStaticRoot, `${relativePath}.html`);
          const rootIndexHtml = path.resolve(resolvedStaticRoot, 'index.html');
          if (withHtmlExt.startsWith(safeRoot) && fs.existsSync(withHtmlExt) && fs.statSync(withHtmlExt).isFile()) {
            candidateHtml = withHtmlExt;
          } else if (fs.existsSync(rootIndexHtml) && fs.statSync(rootIndexHtml).isFile()) {
            candidateHtml = rootIndexHtml;
          }
        }
      }

      if (candidateHtml && (candidateHtml.startsWith(safeRoot) || candidateHtml === resolvedStaticRoot)) {
        const rawHtml = fs.readFileSync(candidateHtml, 'utf-8');
        const injected = this.injectOverlayScript(rawHtml);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(injected);
        return;
      }

      if (this.staticHandler) {
        const originalUrl = req.url;
        req.url = pathname + (url.search || '');
        this.staticHandler(req, res);
        req.url = originalUrl;
        return;
      }
    }

    if (this.proxy) {
      this.proxy.web(req, res);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  public listen(): Promise<string> {
    return new Promise((resolve, reject) => {
      const initialPort = this.options.port;
      const host = this.options.host;
      const strictPort = !!this.options.strictPort;

      const tryListen = (port: number) => {
        const onError = (err: any) => {
          this.server.removeListener('error', onError);
          if (err.code === 'EADDRINUSE' && !strictPort && initialPort > 0 && port < initialPort + 50) {
            tryListen(port + 1);
          } else {
            reject(err);
          }
        };

        this.server.once('error', onError);
        this.server.listen(port, host, () => {
          this.server.removeListener('error', onError);
          const addr = this.server.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : port;
          this.options.port = actualPort;
          const reviewUrl = `http://${host}:${actualPort}${this.basePath || ''}`;
          this.writeServerMetadata(reviewUrl);
          resolve(reviewUrl);
        });
      };

      tryListen(initialPort);
    });
  }

  private writeServerMetadata(url: string): void {
    try {
      const dataDir = path.join(this.rootDir, SERVER_METADATA_DIR);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const metaPath = path.join(dataDir, SERVER_METADATA_FILE);
      const metadata: LuxServerMetadata = {
        pid: process.pid,
        port: this.options.port,
        url,
        target: this.options.target,
        appId: this.appId,
        startTime: Date.now(),
        rootDir: this.rootDir,
      };
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
    } catch (err: any) {
      console.debug('[lux] Failed to write server metadata lockfile:', err?.message);
    }
  }

  private removeServerMetadata(): void {
    try {
      const metaPath = path.join(this.rootDir, SERVER_METADATA_DIR, SERVER_METADATA_FILE);
      if (fs.existsSync(metaPath)) {
        try {
          const raw = fs.readFileSync(metaPath, 'utf-8');
          const data = JSON.parse(raw);
          if (data.pid === process.pid) {
            fs.unlinkSync(metaPath);
          }
        } catch {
          fs.unlinkSync(metaPath);
        }
      }
    } catch (err: any) {
      console.debug('[lux] Failed to remove server metadata lockfile:', err?.message);
    }
  }

  public close(): Promise<void> {
    this.removeServerMetadata();
    if (this.reloadDebounce) {
      clearTimeout(this.reloadDebounce);
      this.reloadDebounce = null;
    }
    if (this.fileWatcher) {
      try {
        this.fileWatcher.close();
      } catch {}
    }
    this.wsHub.close();
    try {
      this.proxy?.close();
    } catch {}
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  public getEventStore(): EventStore {
    return this.eventStore;
  }

  public getWsHub(): WebSocketHub {
    return this.wsHub;
  }
}
