import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'node:http';
import { EventStore } from './event-store.js';
import { WebSocketMessage, API_ROUTES } from '@visual-edit/core';

export class WebSocketHub {
  private wss: WebSocketServer;
  private eventStore: EventStore;
  private basePath: string;
  private appId?: string;
  private clients = new Set<WebSocket>();
  private clientSessionMap = new Map<WebSocket, string>();

  constructor(server: Server, eventStore: EventStore, basePath: string = '', appId?: string) {
    this.eventStore = eventStore;
    this.basePath = basePath;
    this.appId = appId;
    this.wss = new WebSocketServer({ noServer: true });

    this.eventStore.subscribe((event) => {
      this.broadcast({
        type: event.type as any,
        sessionId: event.sessionId,
        payload: event.payload,
      });
    });

    server.on('upgrade', (request, socket, head) => {
      const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
      const isVisualEditWs =
        pathname === API_ROUTES.WS ||
        (this.basePath && pathname === `${this.basePath}${API_ROUTES.WS}`);

      if (isVisualEditWs) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      // Immediately sync latest session status to newly connected client
      try {
        const latestSessions = this.eventStore.listSessions();
        if (latestSessions.length > 0) {
          const latest = latestSessions[latestSessions.length - 1];
          const fullSession = this.eventStore.getSession(latest.id);
          if (!this.appId || !fullSession?.appId || fullSession.appId === this.appId) {
            ws.send(
              JSON.stringify({
                type: 'STATUS_CHANGE',
                sessionId: latest.id,
                payload: {
                  status: latest.status,
                  replies: fullSession?.replies || [],
                },
              })
            );
          }
        }
      } catch (err) {}

      ws.on('message', (data) => {
        try {
          const msg: WebSocketMessage = JSON.parse(data.toString());
          if (msg.type === 'SUBMIT_BATCH') {
            if (this.appId && msg.payload?.appId && msg.payload.appId !== this.appId) {
              console.warn(`[lux] WS dropping SUBMIT_BATCH from mismatched appId: ${msg.payload.appId} (server: ${this.appId})`);
              return;
            }
            if (this.appId && msg.payload && !msg.payload.appId) {
              msg.payload.appId = this.appId;
            }
            if (msg.payload?.id) {
              this.clientSessionMap.set(ws, msg.payload.id);
            }
            this.eventStore.saveBatch(msg.payload);
            this.broadcast({
              type: 'STATUS_CHANGE',
              sessionId: msg.payload.id,
              payload: { status: 'submitted' },
            });
          } else if (msg.type === 'SYNC_SESSION') {
            if (this.appId && msg.payload?.appId && msg.payload.appId !== this.appId) {
              console.warn(`[lux] WS dropping SYNC_SESSION from mismatched appId: ${msg.payload.appId} (server: ${this.appId})`);
              return;
            }
            if (this.appId && msg.payload && !msg.payload.appId) {
              msg.payload.appId = this.appId;
            }
            if (msg.payload?.id) {
              this.clientSessionMap.set(ws, msg.payload.id);
            }
            this.eventStore.saveBatch(msg.payload);
          }
        } catch (err) {
          console.error('[visual-edit] Failed to handle WS message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.clientSessionMap.delete(ws);
      });
    });
  }

  public getActiveSessionIds(): string[] {
    return Array.from(new Set(this.clientSessionMap.values())).filter(Boolean);
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }

  public broadcast(msg: WebSocketMessage): void {
    const payload = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
