import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'node:http';
import { EventStore } from './event-store.js';
import {
  WebSocketMessage,
  VisualEditBatch,
  VisualCaptureRequest,
  VisualCaptureResponse,
  ViewportPreset,
  API_ROUTES,
} from '@visual-edit/core';

interface WsControlPayload {
  reviewMode?: unknown;
  mode?: unknown;
  setId?: string;
  selectedVariantId?: string;
  chosenVariantId?: string;
  userNote?: string;
  targetHash?: string;
  sessionId?: string;
}

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
      if (event.type === 'SAVE_BATCH') return;
      this.broadcast({
        type: event.type,
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

        // Send active pending variant sets after session status sync so unresolved variants persist
        const activeVariants = this.eventStore.getVariantSets().filter((s) => s.status === 'pending');
        ws.send(
          JSON.stringify({
            type: 'SYNC_VARIANTS',
            payload: activeVariants,
          })
        );
      } catch (err) {
        console.debug('[lux] Failed to send initial WebSocket handshake state:', err);
      }

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as WebSocketMessage;
          const ctrl = (msg.payload && typeof msg.payload === 'object' ? msg.payload : {}) as WsControlPayload;
          if (msg.type === 'SUBMIT_BATCH') {
            this.handleIncomingBatch(ws, msg.payload as VisualEditBatch, true);
          } else if (msg.type === 'SYNC_SESSION') {
            this.handleIncomingBatch(ws, msg.payload as VisualEditBatch, false);
          } else if (msg.type === 'SET_REVIEW_MODE') {
            const mode = ctrl.reviewMode || ctrl.mode;
            if (mode === 'live' || mode === 'batch') {
              this.eventStore.setReviewMode(mode);
            }
          } else if (msg.type === 'DECIDE_VARIANT') {
            const chosenId = ctrl.selectedVariantId || ctrl.chosenVariantId;
            if (ctrl.setId && chosenId) {
              this.eventStore.recordVariantDecision({
                setId: ctrl.setId,
                selectedVariantId: chosenId,
                userNote: ctrl.userNote,
                targetHash: ctrl.targetHash,
                sessionId: msg.sessionId || ctrl.sessionId,
              });
            }
          } else if (msg.type === 'DISMISS_VARIANT' || msg.type === 'DELETE_VARIANT_DECISION') {
            if (ctrl.setId) {
              this.eventStore.deleteVariantSet(ctrl.setId, msg.sessionId || ctrl.sessionId);
            }
          } else if (msg.type === 'REVERT_VARIANT_DECISION') {
            if (ctrl.setId) {
              this.eventStore.revertVariantDecision(ctrl.setId, msg.sessionId || ctrl.sessionId);
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

  private handleIncomingBatch(ws: WebSocket, payload: VisualEditBatch | null | undefined, markSubmitted: boolean): void {
    if (!payload) return;
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
    const prevSession = payload?.id ? this.eventStore.getSession(payload.id) : undefined;
    if ((markSubmitted || isLive) && payload) {
      payload.status = 'submitted';
    } else if (payload) {
      payload.status = payload.status || 'draft';
    }
    const saved = this.eventStore.saveBatch(payload, {
      forceSubmit: markSubmitted || isLive,
      explicitSubmit: markSubmitted,
    });
    if (saved && (markSubmitted || isLive) && payload?.id) {
      const updated = this.eventStore.getSession(payload.id);
      if (
        updated?.status === 'submitted' &&
        (markSubmitted || prevSession?.status !== 'submitted' || prevSession?.revisionHash !== updated.revisionHash)
      ) {
        this.broadcast({
          type: 'STATUS_CHANGE',
          sessionId: payload.id,
          payload: { status: 'submitted' },
        });
      }
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
      } catch (err: unknown) {
        clearTimeout(timer);
        this.pendingCaptures.delete(requestId);
        const msg = err instanceof Error ? err.message : 'WebSocket send error';
        resolve({
          requestId,
          success: false,
          error: `Failed to dispatch capture request to browser client: ${msg}`,
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
      } catch (err) {
        console.debug('[lux] Failed to close WebSocket client during shutdown:', err);
      }
    }
    this.clients.clear();
    this.clientSessionMap.clear();
    try {
      this.wss.close();
    } catch (err) {
      console.debug('[lux] Failed to close WebSocketServer during shutdown:', err);
    }
  }
}
