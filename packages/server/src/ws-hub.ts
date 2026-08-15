import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'node:http';
import { EventStore } from './event-store.js';
import { WebSocketMessage } from '@visual-edit/core';

export class WebSocketHub {
  private wss: WebSocketServer;
  private eventStore: EventStore;
  private clients = new Set<WebSocket>();

  constructor(server: Server, eventStore: EventStore) {
    this.eventStore = eventStore;
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
      if (pathname === '/__visual_edit__/ws') {
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
      } catch (err) {}

      ws.on('message', (data) => {
        try {
          const msg: WebSocketMessage = JSON.parse(data.toString());
          if (msg.type === 'SUBMIT_BATCH') {
            this.eventStore.saveBatch(msg.payload);
            this.broadcast({
              type: 'STATUS_CHANGE',
              sessionId: msg.payload.id,
              payload: { status: 'submitted' },
            });
          }
        } catch (err) {
          console.error('[visual-edit] Failed to handle WS message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
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
