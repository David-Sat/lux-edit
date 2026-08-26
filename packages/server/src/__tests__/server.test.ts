import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { VisualEditServer } from '../server.js';
import { EventStore } from '../event-store.js';
import path from 'node:path';
import fs from 'node:fs';

describe('Server & EventStore Integration', () => {
  const testDir = path.resolve(process.cwd(), '.test-visual-edit');
  let server: VisualEditServer;
  let reviewUrl: string;

  beforeAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    server = new VisualEditServer({
      target: './fixtures/static-html/index.html',
      port: 0, // OS assigns free port
      host: '127.0.0.1',
      rootDir: testDir,
    });
    reviewUrl = await server.listen();
  });

  afterAll(async () => {
    await server.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('serves HTML with overlay script injected', async () => {
    const res = await fetch(reviewUrl);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<script type="module" src="/__visual_edit__/overlay.js"></script>');
    expect(html).toContain('Build Web Interfaces Visually with AI');
  });

  it('serves the overlay JS bundle at /__visual_edit__/overlay.js', async () => {
    const res = await fetch(`${reviewUrl}/__visual_edit__/overlay.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    const js = await res.text();
    expect(js).toContain('visual-edit-overlay');
  });

  it('handles edit batch submission via REST API and persists session', async () => {
    const batch = {
      id: 'test_session_123',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      userPrompt: 'Increase hero headline size',
      mutations: [
        {
          id: 'm1',
          type: 'STYLE_CHANGE',
          targetSelector: '#main-headline',
          property: 'font-size',
          before: '48px',
          after: '60px',
          tailwindSuggestion: 'text-6xl',
        },
      ],
    };

    const submitRes = await fetch(`${reviewUrl}/__visual_edit__/api/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    expect(submitRes.status).toBe(200);
    const submitJson = (await submitRes.json()) as { success: boolean; id: string };
    expect(submitJson.success).toBe(true);

    // Verify session retrieval via API
    const listRes = await fetch(`${reviewUrl}/__visual_edit__/api/sessions`);
    const sessions = (await listRes.json()) as any[];
    const created = sessions.find((s) => s.id === 'test_session_123');
    expect(created).toBeDefined();
    expect(created.mutationCount).toBe(1);
    expect(created.userPrompt).toBe('Increase hero headline size');
  });

  it('supports atomic agent claiming and status updates', () => {
    const store = server.getEventStore();
    const claimRes = store.claimSession('test_session_123', 'agent-alpha');
    expect(claimRes.success).toBe(true);

    // Another agent trying to claim should fail
    const conflictRes = store.claimSession('test_session_123', 'agent-beta');
    expect(conflictRes.success).toBe(false);
    expect(conflictRes.error).toContain('already claimed');

    // Updating status with message
    const updateRes = store.updateStatus('test_session_123', 'implemented', {
      agentId: 'agent-alpha',
      message: 'Applied text-6xl to main-headline in styles.css',
    });
    expect(updateRes).toBe(true);

    const updatedSession = store.getSession('test_session_123');
    expect(updatedSession?.status).toBe('implemented');
    expect(updatedSession?.replies?.[0].message).toContain('Applied text-6xl');
  });

  it('automatically adds .visual-edit/ to .gitignore if not present', () => {
    const gitignorePath = path.join(testDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'node_modules/\ndist/\n');
    const store = new EventStore(testDir);
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.visual-edit/');
  });
});

describe('Reverse Proxy & Base-Path Support (SageMaker / Codespaces)', () => {
  const testDir = path.resolve(process.cwd(), '.test-basepath-store');
  const basePath = '/codeeditor/default/ports/4401';
  let upstreamServer: http.Server;
  let upstreamPort: number;
  let luxServer: VisualEditServer;
  let luxUrl: string;

  let originUrl: string;

  beforeAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // 1. Create a dummy upstream dev server (like Vite / Next.js)
    upstreamServer = http.createServer((req, res) => {
      if (req.url === '/' || req.url === `${basePath}/` || req.url === `${basePath}`) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><title>App</title></head><body><h1>Hello from Vite</h1></body></html>');
        return;
      }
      if (req.url === '/health' || req.url === `${basePath}/health`) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', url: req.url }));
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      upstreamServer.listen(0, '127.0.0.1', () => {
        const addr = upstreamServer.address() as any;
        upstreamPort = addr.port;
        resolve();
      });
    });

    // 2. Start lux with basePath pointing to upstream
    luxServer = new VisualEditServer({
      target: `http://127.0.0.1:${upstreamPort}`,
      port: 0,
      host: '127.0.0.1',
      rootDir: testDir,
      basePath,
    });
    luxUrl = await luxServer.listen();
    originUrl = luxUrl.replace(basePath, '');
  });

  afterAll(async () => {
    await luxServer.close();
    await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('injects overlay script with basePath prefix', async () => {
    const res = await fetch(`${originUrl}${basePath}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<script type="module" src="${basePath}/__visual_edit__/overlay.js"></script>`);
  });

  it('serves overlay JS bundle under prefixed basePath', async () => {
    const res = await fetch(`${originUrl}${basePath}/__visual_edit__/overlay.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
  });

  it('serves overlay JS bundle under unprefixed path as fallback', async () => {
    const res = await fetch(`${originUrl}/__visual_edit__/overlay.js`);
    expect(res.status).toBe(200);
  });

  it('handles REST API edits endpoint under prefixed basePath', async () => {
    const batch = {
      id: 'basepath_session_1',
      timestamp: Date.now(),
      route: `${basePath}/`,
      status: 'submitted',
      userPrompt: 'Test base path submission',
      mutations: [],
      annotations: [
        {
          id: 'a1',
          type: 'element',
          targetSelector: 'h1',
          comment: 'Make heading bigger',
          timestamp: Date.now(),
        },
      ],
    };

    const res = await fetch(`${originUrl}${basePath}/__visual_edit__/api/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);

    const session = luxServer.getEventStore().getSession('basepath_session_1');
    expect(session).toBeDefined();
    expect(session?.annotations?.[0].comment).toBe('Make heading bigger');
  });

  it('proxies application endpoints upstream without stripping basePath', async () => {
    const res = await fetch(`${originUrl}${basePath}/health`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('ok');
    expect(data.url).toBe(`${basePath}/health`);
  });

  it('connects to WebSocket with basePath prefix', async () => {
    const wsUrl = originUrl.replace('http://', 'ws://') + `${basePath}/__visual_edit__/ws`;
    const { WebSocket } = await import('ws');
    const ws = new WebSocket(wsUrl);

    const connected = await new Promise<boolean>((resolve) => {
      ws.on('open', () => resolve(true));
      ws.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 2000);
    });

    expect(connected).toBe(true);
    ws.close();
  });

  it('returns HTTP/1.1 101 Switching Protocols on raw socket upgrade for prefixed WS path', async () => {
    const net = await import('node:net');
    const urlObj = new URL(originUrl);
    const portNum = parseInt(urlObj.port, 10);

    const firstLine = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection({ port: portNum, host: '127.0.0.1' }, () => {
        client.write(
          `GET ${basePath}/__visual_edit__/ws HTTP/1.1\r\n` +
          `Host: 127.0.0.1:${portNum}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`
        );
      });

      client.on('data', (data) => {
        const line = data.toString().split('\r\n')[0];
        client.destroy();
        resolve(line);
      });

      client.on('error', reject);
      setTimeout(() => reject(new Error('Socket timeout')), 3000);
    });

    expect(firstLine).toContain('101 Switching Protocols');
  });

  it('connects to WebSocket without basePath prefix as fallback', async () => {
    const wsUrl = originUrl.replace('http://', 'ws://') + '/__visual_edit__/ws';
    const { WebSocket } = await import('ws');
    const ws = new WebSocket(wsUrl);

    const connected = await new Promise<boolean>((resolve) => {
      ws.on('open', () => resolve(true));
      ws.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 2000);
    });

    expect(connected).toBe(true);
    ws.close();
  });

  it('watches files in rootDir and auto-resolves sessions in proxy mode', async () => {
    const store = luxServer.getEventStore();
    store.saveBatch({
      id: 'session_to_resolve_on_watch',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      mutations: [{ id: 'm1', type: 'STYLE_CHANGE', targetSelector: 'h1', property: 'color', before: 'black', after: 'red' }],
      annotations: [],
    });

    // Verify session is submitted
    expect(store.getSession('session_to_resolve_on_watch')?.status).toBe('submitted');

    // Simulate agent writing to a source file in rootDir
    const dummySourceFile = path.join(testDir, 'App.tsx');
    fs.writeFileSync(dummySourceFile, 'export function App() { return <h1>Updated</h1>; }');

    // Wait for debounce in file watcher
    await new Promise((r) => setTimeout(r, 400));

    // Verify session was marked implemented
    const resolved = store.getSession('session_to_resolve_on_watch');
    expect(resolved?.status).toBe('implemented');
  });
});

describe('Static Directory Target Mode', () => {
  const testDir = path.resolve(process.cwd(), '.test-static-dir');
  let server: VisualEditServer;
  let reviewUrl: string;

  beforeAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, 'assets'), { recursive: true });

    // Create an index.html, subpage.html, and a css file
    fs.writeFileSync(
      path.join(testDir, 'index.html'),
      '<!DOCTYPE html><html><head><title>Home</title></head><body><h1>Directory Home</h1></body></html>'
    );
    fs.writeFileSync(
      path.join(testDir, 'subpage.html'),
      '<!DOCTYPE html><html><head><title>Subpage</title></head><body><h2>Subpage Title</h2></body></html>'
    );
    fs.writeFileSync(
      path.join(testDir, 'assets', 'style.css'),
      'body { background: #fafafa; }'
    );

    server = new VisualEditServer({
      target: testDir,
      port: 0,
      host: '127.0.0.1',
      rootDir: testDir,
    });
    reviewUrl = await server.listen();
  });

  afterAll(async () => {
    await server.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('serves directory index.html with overlay injected when requesting /', async () => {
    const res = await fetch(`${reviewUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<script type="module" src="/__visual_edit__/overlay.js"></script>');
    expect(html).toContain('Directory Home');
  });

  it('serves directory index.html with overlay injected when requesting /index.html', async () => {
    const res = await fetch(`${reviewUrl}/index.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<script type="module" src="/__visual_edit__/overlay.js"></script>');
    expect(html).toContain('Directory Home');
  });

  it('serves subpage.html with overlay injected', async () => {
    const res = await fetch(`${reviewUrl}/subpage.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<script type="module" src="/__visual_edit__/overlay.js"></script>');
    expect(html).toContain('Subpage Title');
  });

  it('serves non-HTML static assets without script injection', async () => {
    const res = await fetch(`${reviewUrl}/assets/style.css`);
    expect(res.status).toBe(200);
    const css = await res.text();
    expect(css).toContain('background: #fafafa;');
    expect(css).not.toContain('overlay.js');
  });
});

describe('Multiple Concurrent Servers & Port Fallback', () => {
  const dirA = path.resolve(process.cwd(), '.test-multi-a');
  const dirB = path.resolve(process.cwd(), '.test-multi-b');
  let serverA: VisualEditServer;
  let serverB: VisualEditServer;

  beforeAll(() => {
    fs.mkdirSync(dirA, { recursive: true });
    fs.mkdirSync(dirB, { recursive: true });
    fs.writeFileSync(path.join(dirA, 'index.html'), '<html><body>App A</body></html>');
    fs.writeFileSync(path.join(dirB, 'index.html'), '<html><body>App B</body></html>');
  });

  afterAll(async () => {
    if (serverA) await serverA.close();
    if (serverB) await serverB.close();
    if (fs.existsSync(dirA)) fs.rmSync(dirA, { recursive: true, force: true });
    if (fs.existsSync(dirB)) fs.rmSync(dirB, { recursive: true, force: true });
  });

  it('runs multiple apps simultaneously and auto-assigns next port on collision', async () => {
    const basePort = 19430;
    serverA = new VisualEditServer({
      target: path.join(dirA, 'index.html'),
      port: basePort,
      host: '127.0.0.1',
      rootDir: dirA,
    });
    const urlA = await serverA.listen();
    expect(urlA).toBe(`http://127.0.0.1:${basePort}`);

    serverB = new VisualEditServer({
      target: path.join(dirB, 'index.html'),
      port: basePort, // Request same port
      host: '127.0.0.1',
      rootDir: dirB,
    });
    const urlB = await serverB.listen();
    expect(urlB).toBe(`http://127.0.0.1:${basePort + 1}`);

    // Both servers respond independently
    const resA = await fetch(urlA);
    const htmlA = await resA.text();
    expect(htmlA).toContain('App A');

    const resB = await fetch(urlB);
    const htmlB = await resB.text();
    expect(htmlB).toContain('App B');
  });
});
