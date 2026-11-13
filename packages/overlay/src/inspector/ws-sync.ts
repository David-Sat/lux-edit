import {
  API_ROUTES,
  AgentReply,
  ElementVariantSet,
  HookLeaseStatus,
  ReviewMode,
  SessionStatus,
  VerificationTarget,
  VisualCaptureRequest,
  VisualEditBatch,
  WebSocketMessage,
} from '@visual-edit/core';
import { captureVisualSnapshot } from './visual-capture.js';

export function isWebSocketOpen(ws: WebSocket | null): ws is WebSocket {
  if (!ws) return false;
  const openState = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
  return ws.readyState === openState;
}

export interface StatusChangePayload {
  status: SessionStatus;
  replies?: AgentReply[];
  verificationTargets?: VerificationTarget[];
}

export interface ReloadPagePayload {
  file?: string;
  [key: string]: unknown;
}

export interface WsSyncHandlers {
  getReviewMode: () => ReviewMode;
  onStatusChange: (payload: StatusChangePayload) => void;
  onAgentReply: (reply: AgentReply) => void;
  onAgentStatus: (lease: HookLeaseStatus) => void;
  onSetReviewMode: (mode: ReviewMode) => void;
  onSyncVariants: (sets: ElementVariantSet[]) => void;
  onProposeVariants: (variantSet: ElementVariantSet) => void;
  onSupersedeVariants: (variantSet: ElementVariantSet) => void;
  onReloadPage: (payload: ReloadPagePayload) => void;
}

export class WsSyncClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private basePathPrefix: string,
    private handlers: WsSyncHandlers
  ) {}

  public getWebSocket(): WebSocket | null {
    return this.ws;
  }

  public send(type: WebSocketMessage['type'] | string, payload: unknown): boolean {
    if (isWebSocketOpen(this.ws)) {
      this.ws.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  }

  public async sendBatch(
    wsType: 'SUBMIT_BATCH' | 'SYNC_SESSION',
    batch: VisualEditBatch,
    options?: { allowHttpFallback?: boolean; swallowErrors?: boolean }
  ): Promise<void> {
    if (this.send(wsType, batch)) {
      return;
    }
    if (options?.allowHttpFallback === false) {
      return;
    }
    const doFetch = () =>
      fetch(`${this.basePathPrefix}/__visual_edit__/api/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });

    if (options?.swallowErrors) {
      try {
        await doFetch();
      } catch (err) {
        console.debug('[lux] HTTP batch sync fallback failed:', err);
      }
    } else {
      await doFetch();
    }
  }

  public connect(): void {
    try {
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${this.basePathPrefix}${API_ROUTES.WS}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'STATUS_CHANGE':
              this.handlers.onStatusChange(data.payload);
              break;
            case 'AGENT_REPLY':
              this.handlers.onAgentReply(data.payload);
              break;
            case 'AGENT_STATUS':
              if (data.payload) {
                this.handlers.onAgentStatus(data.payload);
              }
              break;
            case 'SET_REVIEW_MODE': {
              const mode = data.payload?.reviewMode || data.payload?.mode;
              if (mode === 'live' || mode === 'batch') {
                this.handlers.onSetReviewMode(mode);
              }
              break;
            }
            case 'SYNC_VARIANTS':
              this.handlers.onSyncVariants(Array.isArray(data.payload) ? data.payload : []);
              break;
            case 'PROPOSE_VARIANTS':
              if (data.payload?.id) {
                this.handlers.onProposeVariants(data.payload);
              }
              break;
            case 'SUPERSEDE_VARIANTS':
              if (data.payload?.id) {
                this.handlers.onSupersedeVariants(data.payload);
              }
              break;
            case 'CAPTURE_REQUEST':
              await this.handleCaptureRequest(data.payload);
              break;
            case 'RELOAD_PAGE':
              this.handlers.onReloadPage(data.payload);
              break;
          }
        } catch (e) {
          console.error('[visual-edit] WebSocket error parsing message:', e);
        }
      };

      this.ws.onerror = () => {};

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        const mode = this.handlers.getReviewMode();
        this.send('SET_REVIEW_MODE', { reviewMode: mode, mode });
      };

      this.ws.onclose = () => {
        if (this.reconnectAttempts < 10) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
          this.reconnectTimer = setTimeout(() => this.connect(), delay);
        }
      };
    } catch {
      console.debug('[lux] WebSocket connection not available');
    }
  }

  private async handleCaptureRequest(payload: VisualCaptureRequest): Promise<void> {
    try {
      const res = await captureVisualSnapshot(payload);
      this.send('CAPTURE_RESPONSE', res);
    } catch (captureErr: unknown) {
      this.send('CAPTURE_RESPONSE', {
        requestId: payload?.requestId || 'unknown',
        error: captureErr instanceof Error ? captureErr.message : String(captureErr),
      });
    }
  }

  public close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
      } catch (err) {
        console.debug('[lux] Failed to close WebSocket client cleanly:', err);
      }
      this.ws = null;
    }
  }
}
