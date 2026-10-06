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

export class VisualEditServer {
  public readonly appId: string;
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

  constructor(options: VisualEditServerOptions) {
    this.options = options;
    this.rootDir = path.resolve(options.rootDir || process.cwd());
    this.appId = options.appId || this.computeAppId(options.target, this.rootDir);
    this.eventStore = EventStore.getInstance(this.rootDir);

    // Normalize base path prefix (e.g., '/codeeditor/default/ports/4401')
    let basePath = (options.basePath || process.env.LUX_BASE_PATH || '').trim();
    if (basePath) {
      if (!basePath.startsWith('/')) basePath = '/' + basePath;
      basePath = basePath.replace(/\/+$/, '');
    }
    this.basePath = basePath;

    // Locate overlay bundle
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
    let reloadDebounce: any = null;

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
        if (reloadDebounce) clearTimeout(reloadDebounce);
        reloadDebounce = setTimeout(() => {
          console.log(`[lux] Detected code change in ${filename || watchTarget}, resolving active review and notifying browser...`);
          this.eventStore.markPendingSessionsImplemented({ port: this.options.port, appId: this.appId });
          this.wsHub.broadcast({
            type: 'RELOAD_PAGE',
            payload: { file: filename || watchTarget },
          });
        }, 150);
      });
    } catch (e) {
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

      res.writeHead(proxyRes.statusCode || 200, headers);

      if (!isHtml) {
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
        res.end(injected);
      });
    });

    this.proxy.on('error', (err, req, res) => {
      console.error('[visual-edit] Proxy error:', err.message);
      if (res && 'writeHead' in res && !res.headersSent) {
        (res as ServerResponse).writeHead(502, { 'Content-Type': 'text/plain' });
        (res as ServerResponse).end(`Proxy error: Cannot reach upstream target at ${this.options.target}`);
      }
    });
  }

  private injectOverlayScript(html: string): string {
    const scriptSrc = `${this.basePath}${API_ROUTES.OVERLAY_JS}`;
    const configScript = `<script>window.__LUX_APP_ID__ = ${JSON.stringify(this.appId)};</script>`;
    const scriptTag = `${configScript}\n<script type="module" src="${scriptSrc}"></script>`;
    if (html.includes('</head>')) {
      return html.replace('</head>', `${scriptTag}\n</head>`);
    }
    if (html.includes('</body>')) {
      return html.replace('</body>', `${scriptTag}\n</body>`);
    }
    return `${html}\n${scriptTag}`;
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let pathname = url.pathname;

    // Normalize pathname by stripping basePath prefix if present
    if (this.basePath && pathname.startsWith(this.basePath)) {
      pathname = pathname.slice(this.basePath.length) || '/';
    }

    // Handle favicon.ico cleanly
    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serve Overlay JS Bundle
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

    // REST API - Submit Edit Batch
    if (pathname === API_ROUTES.EDITS && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk.toString()));
      req.on('end', () => {
        try {
          const batch = JSON.parse(body);
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
          this.wsHub.broadcast({
            type: 'STATUS_CHANGE',
            sessionId: batch.id,
            payload: { status: 'submitted' },
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, id: batch.id }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // REST API - List Sessions
    if ((pathname === API_ROUTES.SESSIONS || pathname === '/__lux/api/sessions') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.eventStore.listSessions()));
      return;
    }

    // REST API - Pending Review Batch
    if ((pathname === API_ROUTES.PENDING || pathname === '/__lux/api/pending') && req.method === 'GET') {
      const activeSessionIds = this.wsHub.getActiveSessionIds();
      const pending = this.eventStore.getPendingReview({
        port: this.options.port,
        appId: this.appId,
        activeSessionIds,
      });

      const shouldResolve = url.searchParams.get('resolve') === 'true' || url.searchParams.get('resolve') === '1';
      if (pending && shouldResolve) {
        this.eventStore.markPendingSessionsImplemented({
          port: this.options.port,
          appId: this.appId,
          sessionId: pending.id,
        });
        this.wsHub.broadcast({
          type: 'STATUS_CHANGE',
          sessionId: pending.id,
          payload: { status: 'implemented', replies: [] },
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pending || null));
      return;
    }

    // Static Single HTML File Mode
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

    // Static Directory Mode
    if (this.isStatic && this.staticDir) {
      let cleanPath = pathname;
      if (cleanPath.endsWith('/')) {
        cleanPath += 'index.html';
      }

      // Check if resolving to an HTML file (direct, index.html, or SPA fallback)
      let candidateHtml: string | null = null;
      const directPath = path.join(this.staticDir, cleanPath);

      if (fs.existsSync(directPath)) {
        if (fs.statSync(directPath).isFile() && directPath.endsWith('.html')) {
          candidateHtml = directPath;
        } else if (fs.statSync(directPath).isDirectory()) {
          const indexHtml = path.join(directPath, 'index.html');
          if (fs.existsSync(indexHtml) && fs.statSync(indexHtml).isFile()) {
            candidateHtml = indexHtml;
          }
        }
      } else if (!path.extname(cleanPath)) {
        const withHtmlExt = `${directPath}.html`;
        const rootIndexHtml = path.join(this.staticDir, 'index.html');
        if (fs.existsSync(withHtmlExt) && fs.statSync(withHtmlExt).isFile()) {
          candidateHtml = withHtmlExt;
        } else if (fs.existsSync(rootIndexHtml) && fs.statSync(rootIndexHtml).isFile()) {
          candidateHtml = rootIndexHtml;
        }
      }

      if (candidateHtml) {
        const rawHtml = fs.readFileSync(candidateHtml, 'utf-8');
        const injected = this.injectOverlayScript(rawHtml);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(injected);
        return;
      }

      // For non-HTML static assets (.css, .js, .png, etc.), delegate to sirv
      if (this.staticHandler) {
        const originalUrl = req.url;
        req.url = pathname + (url.search || '');
        this.staticHandler(req, res);
        req.url = originalUrl;
        return;
      }
    }

    // Reverse Proxy Mode: Pass the original unmodified request to upstream dev server
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
          // If port is in use and strictPort is false and not using random port 0, try next port
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
          // Only remove if this process owns the metadata file
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
    if (this.fileWatcher) {
      try {
        this.fileWatcher.close();
      } catch (e) {}
    }
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
