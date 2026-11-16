import { IncomingMessage, ServerResponse } from 'node:http';
import { EventStore } from './event-store.js';
import { WebSocketHub } from './ws-hub.js';

export interface ApiRouteContext {
  eventStore: EventStore;
  wsHub: WebSocketHub;
  appId: string;
  version: string;
  port: number;
  basePath?: string;
  overlayScriptPath: string;
}

export function readJsonBody<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve((body ? JSON.parse(body) : {}) as T);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(
  res: ServerResponse,
  data: unknown,
  statusCode: number = 200,
  headers?: Record<string, string>
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(data));
}

export function clampTimeoutMs(raw: unknown, defaultMs: number, minMs: number, maxMs: number): number {
  const num = typeof raw === 'number' ? raw : raw !== null && raw !== undefined ? Number(raw) : NaN;
  if (!Number.isFinite(num)) return defaultMs;
  const floored = Math.floor(num);
  if (floored < minMs) return minMs;
  if (floored > maxMs) return maxMs;
  return floored;
}
