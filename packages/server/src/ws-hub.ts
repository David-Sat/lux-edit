import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'node:http';
import { EventStore } from './event-store.js';
import {
  WebSocketMessage,
  VisualCaptureRequest,
  VisualCaptureResponse,
  ViewportPreset,
  API_ROUTES,
} from '@visual-edit/core';

interface PendingCapture {
  resolve: (res: VisualCaptureResponse) => void;
  timer: NodeJS.Timeout;
}

export class WebSocketHub {
  private wss: WebSocketServer;
  private eventStore: EventStore;
  private basePath: string;
  private appId?: string;
  private clients = new Set<WebSocket>();
  private clientSessionMap = new Map<WebSocket, string>();
  private pendingCaptures = new Map<string, PendingCapture>();
  private unsubscribeStore?: () => void;

  constructor(server: Server, eventStore: EventStore, basePath: string = '', appId?: string) {
    this.eventStore = eventStore;
    this.basePath = basePath;
    this.appId = appId;
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('error', (err) => {
      console.debug('[lux] WebSocketServer error:', err);
    });

    this.unsubscribeStore = this.eventStore.subscribe((event) => {
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

      ws.on('error', (err) => {
        console.debug('[lux] WebSocket client error:', err.message);
      });

      try {
        // Send current agent hook lease status & review mode
        ws.send(
          JSON.stringify({
            type: 'AGENT_STATUS',
            payload: this.eventStore.getHookLeaseStatus(),
          })
        );

        // Send active pending variant sets if any exist
        const activeVariants = this.eventStore.getVariantSets().filter((s) => s.status === 'pending');
        ws.send(
          JSON.stringify({
            type: 'SYNC_VARIANTS',
            payload: activeVariants,
          })
        );

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
      } catch {}

      ws.on('message', (data) => {
        try {
          const msg: WebSocketMessage = JSON.parse(data.toString());
          if (msg.type === 'SUBMIT_BATCH') {
            this.handleIncomingBatch(ws, msg.payload, true);
          } else if (msg.type === 'SYNC_SESSION') {
            this.handleIncomingBatch(ws, msg.payload, false);
          } else if (msg.type === 'SET_REVIEW_MODE') {
            const mode = msg.payload?.reviewMode || msg.payload?.mode;
            if (mode === 'live' || mode === 'batch') {
              this.eventStore.setReviewMode(mode);
            }
          } else if (msg.type === 'DECIDE_VARIANT') {
            const chosenId = msg.payload?.selectedVariantId || msg.payload?.chosenVariantId;
            if (msg.payload?.setId && chosenId) {
              this.eventStore.recordVariantDecision({
                setId: msg.payload.setId,
                selectedVariantId: chosenId,
                userNote: msg.payload.userNote,
                targetHash: msg.payload.targetHash,
                sessionId: msg.sessionId || msg.payload.sessionId,
              });
            }
          } else if (msg.type === 'DISMISS_VARIANT' || msg.type === 'DELETE_VARIANT_DECISION') {
            if (msg.payload?.setId) {
              this.eventStore.deleteVariantSet(msg.payload.setId, msg.sessionId || msg.payload.sessionId);
            }
          } else if (msg.type === 'REVERT_VARIANT_DECISION') {
            if (msg.payload?.setId) {
              this.eventStore.revertVariantDecision(msg.payload.setId, msg.sessionId || msg.payload.sessionId);
            }
          } else if (msg.type === 'END_LIVE_REVIEW') {
            this.eventStore.endLiveReview();
          } else if (msg.type === 'CAPTURE_RESPONSE') {
            const res = msg.payload as VisualCaptureResponse;
            if (res && res.requestId) {
              const pending = this.pendingCaptures.get(res.requestId);
              if (pending) {
                clearTimeout(pending.timer);
                this.pendingCaptures.delete(res.requestId);
                pending.resolve(res);
              }
            }
          }
        } catch (err) {
          console.error('[lux] Failed to handle WS message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.clientSessionMap.delete(ws);
      });
    });
  }

  private handleIncomingBatch(ws: WebSocket, payload: any, markSubmitted: boolean): void {
    if (this.appId && payload?.appId && payload.appId !== this.appId) {
      console.warn(`[lux] WS dropping ${markSubmitted ? 'SUBMIT_BATCH' : 'SYNC_SESSION'} from mismatched appId: ${payload.appId} (server: ${this.appId})`);
      return;
    }
    if (this.appId && payload && !payload.appId) {
      payload.appId = this.appId;
    }
    if (payload?.id) {
      this.clientSessionMap.set(ws, payload.id);
    }
    const effectiveMode = payload?.reviewMode || this.eventStore.getReviewMode();
    const isLive = effectiveMode === 'live';
    if ((markSubmitted || isLive) && payload) {
      payload.status = 'submitted';
    } else if (payload) {
      payload.status = payload.status || 'draft';
    }
    this.eventStore.saveBatch(payload, { forceSubmit: markSubmitted || isLive });
    if ((markSubmitted || isLive) && payload?.id) {
      this.broadcast({
        type: 'STATUS_CHANGE',
        sessionId: payload.id,
        payload: { status: 'submitted' },
      });
    }
  }

  public requestVisualCapture(
    options: {
      selector?: string;
      viewport?: ViewportPreset;
      resolution?: 'draft' | 'full';
      includeOverlay?: boolean;
    },
    timeoutMs: number = 12000
  ): Promise<VisualCaptureResponse> {
    const openClients = Array.from(this.clients).filter((c) => c.readyState === WebSocket.OPEN);
    if (openClients.length === 0) {
      return Promise.resolve({
        requestId: `cap_err_${Date.now()}`,
        success: false,
        error: 'No active browser tab is connected to the lux review server. Open the review URL in your browser first.',
        capturedAt: Date.now(),
      });
    }

    const rawTimeout = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) ? Math.floor(timeoutMs) : 12000;
    const clampedTimeout = rawTimeout < 500 ? 500 : rawTimeout > 30000 ? 30000 : rawTimeout;
    const safeTimeoutMs = clampedTimeout >= 500 && clampedTimeout <= 30000 ? clampedTimeout : 12000;

    const requestId = `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const reqPayload: VisualCaptureRequest = {
      requestId,
      selector: options.selector,
      viewport: options.viewport,
      resolution: options.resolution || 'draft',
      includeOverlay: options.includeOverlay ?? false,
    };

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingCaptures.delete(requestId);
        resolve({
          requestId,
          success: false,
          error: `Visual capture timed out after ${safeTimeoutMs}ms waiting for browser response.`,
          capturedAt: Date.now(),
        });
      }, safeTimeoutMs <= 30000 ? safeTimeoutMs : 30000);

      this.pendingCaptures.set(requestId, { resolve, timer });

      // Send capture request to the most recently connected active client
      const targetClient = openClients[openClients.length - 1];
      try {
        targetClient.send(
          JSON.stringify({
            type: 'CAPTURE_REQUEST',
            payload: reqPayload,
          })
        );
      } catch (err: any) {
        clearTimeout(timer);
        this.pendingCaptures.delete(requestId);
        resolve({
          requestId,
          success: false,
          error: `Failed to dispatch capture request to browser client: ${err?.message || 'WebSocket send error'}`,
          capturedAt: Date.now(),
        });
      }
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

  public close(): void {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = undefined;
    }
    for (const [reqId, pending] of this.pendingCaptures.entries()) {
      clearTimeout(pending.timer);
      pending.resolve({
        requestId: reqId,
        success: false,
        error: 'Lux review server closed before capture completed.',
        capturedAt: Date.now(),
      });
    }
    this.pendingCaptures.clear();
    for (const client of this.clients) {
      try {
        client.close();
      } catch {}
    }
    this.clients.clear();
    this.clientSessionMap.clear();
    try {
      this.wss.close();
    } catch {}
  }
}
