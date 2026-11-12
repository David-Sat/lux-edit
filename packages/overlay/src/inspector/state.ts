import {
  AgentReply,
  AnnotationTarget,
  CommentAnnotation,
  MutationRecord,
  SessionStatus,
  SourceLocation,
  VisualEditBatch,
  VoiceReviewWalkthrough,
  VoiceTargetPin,
  STORAGE_KEYS,
  API_ROUTES,
  DockPosition,
  ReviewMode,
  HookLeaseStatus,
  ElementVariantSet,
  VariantDecision,
  VerificationTarget,
  computeTargetHash,
  computeBatchRevisionHash,
} from '@visual-edit/core';
import { resolveSourceLocation } from '../source-locator/index.js';
import { VoiceRecorder } from './voice-recorder.js';
import { getRouteFromLocation, isAnnotationOnRoute, normalizeRoute } from './route-utils.js';
import { captureVisualSnapshot } from './visual-capture.js';
import { DomMutationManager, ElementSnapshot } from './dom-mutations.js';
import { VariantManager, applySanitizedHtml } from './variant-manager.js';

export type { DockPosition, ElementSnapshot };

// Derive prefix dynamically from script loading URL for reverse proxies
const BASE_PATH_PREFIX = (() => {
  try {
    const pathname = new URL(import.meta.url).pathname;
    if (pathname.endsWith(API_ROUTES.OVERLAY_JS)) {
      return pathname.slice(0, -API_ROUTES.OVERLAY_JS.length);
    }
    return '';
  } catch {
    return '';
  }
})();

export type ActiveTool = 'none' | 'edit' | 'comment' | 'voice' | 'screenshot';

function isWebSocketOpen(ws: WebSocket | null): ws is WebSocket {
  if (!ws) return false;
  const openState = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
  return ws.readyState === openState;
}

export class OverlayStateManager {
  private static instance?: OverlayStateManager;

  public activeTool: ActiveTool = 'none';
  public isDockMenuOpen = false;
  public isDrawerOpen = false;
  public dockPosition: DockPosition = {
    side: 'right',
    verticalAnchor: 'bottom',
    offsetY: 24,
  };

  public activeElement: HTMLElement | null = null;
  public hoveredElement: HTMLElement | null = null;
  public commentTargetElement: HTMLElement | null = null;
  public commentTargetElements: HTMLElement[] = [];
  public commentTargetSelectedText?: string;
  public commentTargetBounds?: { x: number; y: number; width: number; height: number };
  public commentDraftText: string = '';
  public pendingPageReload: boolean = false;
  public commentPendingScreenshot?: string;

  public userPrompt = '';
  public sessionId = `session_${Date.now().toString(36)}`;
  public sessionStatus: SessionStatus = 'draft';
  public reviewMode: ReviewMode = 'batch';
  public hookLease: HookLeaseStatus = {
    connected: false,
    agentState: 'idle',
    seenCursor: 0,
    latestCursor: 0,
  };
  public variantSets: ElementVariantSet[] = [];
  public variantDecisions: VariantDecision[] = [];
  public activeVariantPreview = new Map<string, string | null>();
  public verificationTargets: VerificationTarget[] = [];

  public mutations: MutationRecord[] = [];
  public annotations: CommentAnnotation[] = [];
  public voiceReviews: VoiceReviewWalkthrough[] = [];
  public activeVoicePins: VoiceTargetPin[] = [];
  public agentReplies: AgentReply[] = [];

  public version: string =
    typeof window !== 'undefined' && (window as any).__LUX_VERSION__
      ? (window as any).__LUX_VERSION__
      : '0.15.1';
  public currentPathname: string = getRouteFromLocation();
  public updateInfo: {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string;
    changelogUrl: string;
  } | null = null;

  private domMutations = new DomMutationManager();
  private variantManager: VariantManager;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private liveMutationTimer: any = null;
  private verificationTimer: any = null;

  private constructor() {
    this.variantManager = new VariantManager({
      getVariantSets: () => this.variantSets,
      setVariantSets: (sets) => {
        this.variantSets = sets;
      },
      getVariantDecisions: () => this.variantDecisions,
      setVariantDecisions: (decisions) => {
        this.variantDecisions = decisions;
      },
      getActiveVariantPreview: () => this.activeVariantPreview,
      getReviewMode: () => this.reviewMode,
      getWebSocket: () => this.ws,
      submitBatch: () => this.submitBatch(),
      autoSync: () => this.autoSync(),
      notify: () => this.notify(),
      basePathPrefix: BASE_PATH_PREFIX,
    });
    this.loadFromStorage();
    this.restoreVerificationTargets();
    this.initWebSocket();
    this.fetchVersionInfo();
    if (typeof window !== 'undefined') {
      const prevResizeHandler = (OverlayStateManager as any)._resizeHandler;
      if (prevResizeHandler) {
        window.removeEventListener('resize', prevResizeHandler);
      }
      const resizeHandler = () => OverlayStateManager.instance?.clampDockPosition();
      (OverlayStateManager as any)._resizeHandler = resizeHandler;
      window.addEventListener('resize', resizeHandler);
    }
  }

  public setReviewMode(mode: ReviewMode): void {
    this.reviewMode = mode;
    if (mode === 'batch') {
      this.sessionStatus = 'draft';
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.REVIEW_MODE, mode);
      }
    } catch {}
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'SET_REVIEW_MODE', payload: { reviewMode: mode, mode } }));
    }
    if (
      mode === 'live' &&
      (this.mutations.length > 0 ||
        this.annotations.length > 0 ||
        this.voiceReviews.length > 0 ||
        this.variantDecisions.length > 0 ||
        this.userPrompt.trim().length > 0)
    ) {
      this.submitBatch();
      return;
    }
    this.notify();
  }

  public endLiveReview(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'END_LIVE_REVIEW', payload: {} }));
    }
    this.hookLease = {
      ...this.hookLease,
      connected: false,
      endedByUser: true,
      agentState: 'idle',
    };
    this.notify();
  }

  public previewVariant(setId: string, variantId: string | null): void {
    this.variantManager.previewVariant(setId, variantId);
  }

  public decideVariant(setId: string, variantId: string, userNote?: string): void {
    this.variantManager.decideVariant(setId, variantId, userNote);
  }

  public revertVariantDecision(setId: string): void {
    this.variantManager.revertVariantDecision(setId);
  }

  public deleteVariantDecision(setId: string): void {
    this.variantManager.deleteVariantDecision(setId);
  }

  public dismissVariantSet(setId: string): void {
    this.variantManager.dismissVariantSet(setId);
  }

  public triggerVerificationHalo(targets: VerificationTarget[]): void {
    if (!targets || targets.length === 0) return;
    this.verificationTargets = targets;
    if (this.verificationTimer) clearTimeout(this.verificationTimer);
    this.verificationTimer = setTimeout(() => {
      this.verificationTargets = [];
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(STORAGE_KEYS.VERIFY_TARGETS);
        }
      } catch {}
      this.notify();
    }, 3200);
    this.notify();
  }

  private restoreVerificationTargets(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem(STORAGE_KEYS.VERIFY_TARGETS);
        if (raw) {
          sessionStorage.removeItem(STORAGE_KEYS.VERIFY_TARGETS);
          const targets = JSON.parse(raw) as VerificationTarget[];
          if (Array.isArray(targets) && targets.length > 0) {
            this.triggerVerificationHalo(targets);
          }
        }
      }
    } catch {}
  }

  private scheduleLiveMutationSubmit(): void {
    if (this.reviewMode !== 'live') {
      this.sessionStatus = 'draft';
      return;
    }
    if (this.liveMutationTimer) clearTimeout(this.liveMutationTimer);
    this.liveMutationTimer = setTimeout(() => {
      this.submitBatch();
    }, 800);
  }

  public async fetchVersionInfo(): Promise<void> {
    try {
      if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
      if (typeof window.location !== 'undefined' && window.location.protocol === 'about:') return;
      const url = `${BASE_PATH_PREFIX}${API_ROUTES.VERSION}`;
      const res = await fetch(url).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data === 'object') {
          this.updateInfo = data;
          this.notify();
        }
      }
    } catch {}
  }

  private getStorageKey(): string {
    const appId = typeof window !== 'undefined' ? (window as any).__LUX_APP_ID__ : undefined;
    return `${STORAGE_KEYS.DRAFT_PREFIX}${appId || 'default'}`;
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedMode = localStorage.getItem(STORAGE_KEYS.REVIEW_MODE);
        if (savedMode === 'live' || savedMode === 'batch') {
          this.reviewMode = savedMode;
        }
      }
    } catch {}

    try {
      const key = this.getStorageKey();
      // Load current scoped key, falling back to legacy keys for migration
      let saved = localStorage.getItem(key);
      if (!saved) {
        const appId = typeof window !== 'undefined' ? (window as any).__LUX_APP_ID__ : undefined;
        if (appId) {
          saved = localStorage.getItem(`${STORAGE_KEYS.LEGACY_APP_DRAFT_PREFIX}${appId}`);
        }
        if (!saved) {
          saved = localStorage.getItem(STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
        }
        // If recovered from legacy key, clean it up
        if (saved) {
          try {
            if (appId) localStorage.removeItem(`${STORAGE_KEYS.LEGACY_APP_DRAFT_PREFIX}${appId}`);
            localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
          } catch {}
        }
      }

      if (saved) {
        const data = JSON.parse(saved);
        if (data.status !== 'implemented' && data.status !== 'resolved') {
          this.sessionId = data.id || this.sessionId;
          this.sessionStatus = data.status || 'draft';
          this.mutations = data.mutations || [];
          this.annotations = data.annotations || [];
          this.voiceReviews = data.voiceReviews || [];
          this.variantDecisions = data.variantDecisions || [];
          this.userPrompt = data.userPrompt || '';

          // Reconcile voice reviews & annotations to clean up any orphaned transcripts/pins
          const voiceAnnIds = new Set(this.annotations.filter((a) => a.type === 'voice').map((a) => a.id));
          const voiceReviewIds = new Set(this.voiceReviews.map((v) => v.id));
          this.voiceReviews = this.voiceReviews.filter((v) => voiceAnnIds.has(v.id));
          this.annotations = this.annotations.filter((a) => a.type !== 'voice' || voiceReviewIds.has(a.id));
        }
      }
    } catch (e) {}

    try {
      if (typeof localStorage !== 'undefined') {
        const savedPos = localStorage.getItem(STORAGE_KEYS.DOCK_POSITION);
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (
            (parsed.side === 'left' || parsed.side === 'right') &&
            (parsed.verticalAnchor === 'top' || parsed.verticalAnchor === 'bottom') &&
            typeof parsed.offsetY === 'number'
          ) {
            this.dockPosition = {
              side: parsed.side,
              verticalAnchor: parsed.verticalAnchor,
              offsetY: Math.max(10, parsed.offsetY),
            };
          }
        }
      }
    } catch (e) {}

    try {
      if (typeof sessionStorage !== 'undefined') {
        const savedDraft = sessionStorage.getItem(STORAGE_KEYS.COMPOSER_DRAFT);
        if (savedDraft) {
          this.commentDraftText = savedDraft;
        }
      }
    } catch (e) {}
  }

  private saveToStorage(): void {
    try {
      const key = this.getStorageKey();
      const hasContent =
        this.mutations.length > 0 ||
        this.annotations.length > 0 ||
        this.voiceReviews.length > 0 ||
        this.variantDecisions.length > 0 ||
        this.userPrompt.trim().length > 0;

      if (
        this.sessionStatus === 'implemented' ||
        this.sessionStatus === 'resolved' ||
        (!hasContent && this.sessionStatus === 'draft')
      ) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(this.getBatch()));
      }
    } catch (e) {}
  }

  public static getInstance(): OverlayStateManager {
    if (!OverlayStateManager.instance) {
      OverlayStateManager.instance = new OverlayStateManager();
    }
    return OverlayStateManager.instance;
  }

  public static resetInstance(): void {
    if (OverlayStateManager.instance) {
      OverlayStateManager.instance.destroy();
      OverlayStateManager.instance = undefined;
    }
  }

  public destroy(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.liveMutationTimer) {
      clearTimeout(this.liveMutationTimer);
      this.liveMutationTimer = null;
    }
    if (this.verificationTimer) {
      clearTimeout(this.verificationTimer);
      this.verificationTimer = null;
    }
    if (typeof window !== 'undefined') {
      const resizeHandler = (OverlayStateManager as any)._resizeHandler;
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        (OverlayStateManager as any)._resizeHandler = undefined;
      }
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.listeners.clear();
  }

  public getCurrentPathname(): string {
    return this.currentPathname || getRouteFromLocation();
  }

  private getPageMetadata(): { url: string; pathname: string; pageTitle: string } {
    return {
      url: typeof window !== 'undefined' && window.location ? window.location.href : '',
      pathname: this.getCurrentPathname(),
      pageTitle: typeof document !== 'undefined' ? document.title : '',
    };
  }

  public handleRouteChange(newPath?: string): void {
    const prevPath = this.currentPathname;
    const nextPath = newPath || getRouteFromLocation();
    const routeChanged = normalizeRoute(nextPath) !== normalizeRoute(prevPath);

    let didClear = false;
    const isDetached = (el: HTMLElement | null) =>
      !!el && (typeof document === 'undefined' || !document.body || !document.body.contains(el));

    // When the route actually changed, flush any pending activeElement mutations under the
    // previous route BEFORE updating currentPathname, then clear transient selections so
    // stale pre-commit DOM references do not survive microtask timing races.
    if (routeChanged) {
      if (this.activeElement && typeof document !== 'undefined' && document.body?.contains(this.activeElement)) {
        this.syncMutationsForElement(this.activeElement);
      }
      this.currentPathname = nextPath;
      if (
        this.activeElement ||
        this.hoveredElement ||
        this.commentTargetElement ||
        this.commentTargetElements.length > 0 ||
        this.commentTargetSelectedText !== undefined ||
        this.commentTargetBounds !== undefined
      ) {
        didClear = true;
      }
      this.activeElement = null;
      this.hoveredElement = null;
      this.commentTargetElement = null;
      this.commentTargetElements = [];
      this.commentTargetSelectedText = undefined;
      this.commentTargetBounds = undefined;
    } else {
      this.currentPathname = nextPath;
      if (isDetached(this.activeElement)) {
        this.activeElement = null;
        didClear = true;
      }
      if (isDetached(this.hoveredElement)) {
        this.hoveredElement = null;
        didClear = true;
      }
      if (this.commentTargetElements.length > 0) {
        const remaining = this.commentTargetElements.filter((el) => !isDetached(el));
        if (remaining.length !== this.commentTargetElements.length) {
          this.commentTargetElements = remaining;
          didClear = true;
        }
      }
      if (isDetached(this.commentTargetElement)) {
        this.commentTargetElement =
          this.commentTargetElements[this.commentTargetElements.length - 1] ?? null;
        if (!this.commentTargetElement) {
          this.commentTargetSelectedText = undefined;
          this.commentTargetBounds = undefined;
        }
        didClear = true;
      }
    }

    if (routeChanged || didClear) {
      this.notify();
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public notify(): void {
    this.listeners.forEach((fn) => fn());
    this.saveToStorage();
    const hasContent =
      this.mutations.length > 0 ||
      this.annotations.length > 0 ||
      this.voiceReviews.length > 0 ||
      this.variantDecisions.length > 0 ||
      this.userPrompt.trim().length > 0;
    if (hasContent || this.sessionStatus !== 'draft') {
      this.scheduleAutoSync();
    }
  }

  private syncTimer: any = null;
  public scheduleAutoSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.autoSync();
    }, 200);
  }

  public async autoSync(): Promise<void> {
    const batch = this.getBatch();
    const hasContent =
      (batch.mutations && batch.mutations.length > 0) ||
      (batch.annotations && batch.annotations.length > 0) ||
      (batch.voiceReviews && batch.voiceReviews.length > 0) ||
      (batch.variantDecisions && batch.variantDecisions.length > 0) ||
      (batch.userPrompt && batch.userPrompt.trim().length > 0);

    if (!hasContent && batch.status === 'draft') {
      return;
    }

    if (isWebSocketOpen(this.ws)) {
      this.ws.send(JSON.stringify({ type: 'SYNC_SESSION', payload: batch }));
    } else if (hasContent) {
      try {
        await fetch(`${BASE_PATH_PREFIX}/__visual_edit__/api/edits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        });
      } catch (e) {}
    }
  }

  public setTool(tool: ActiveTool): void {
    if (this.activeTool === tool) {
      if (this.activeTool === 'voice') {
        this.stopVoiceRecording();
        return;
      }
      this.activeTool = 'none';
    } else {
      if (this.activeTool === 'voice') {
        this.stopVoiceRecording();
      }
      this.activeTool = tool;
      if (tool === 'voice') {
        this.startVoiceRecording();
        return;
      }
    }

    if (this.activeTool !== 'edit') {
      this.setActiveElement(null);
    }
    if (this.activeTool !== 'comment') {
      this.commentTargetElement = null;
      this.commentTargetElements = [];
      this.commentTargetSelectedText = undefined;
      this.commentTargetBounds = undefined;
    }
    this.hoveredElement = null;
    this.notify();
  }

  public startVoiceRecording(): void {
    this.activeTool = 'voice';
    this.activeVoicePins = [];
    this.hoveredElement = null;
    this.setActiveElement(null);
    this.commentTargetElement = null;
    this.commentTargetElements = [];
    VoiceRecorder.getInstance().start();
    this.notify();
  }

  public isStoppingVoice = false;

  public async stopVoiceRecording(): Promise<void> {
    if (this.isStoppingVoice) return;
    this.isStoppingVoice = true;
    this.notify();
    try {
      const currentRoute = this.getCurrentPathname();
      const review = await VoiceRecorder.getInstance().stop(currentRoute);
      if (review) {
        const primaryPin = review.pins[0];
        const pinRoutes = Array.from(
          new Set(
            review.pins
              .map((p) => p.pathname)
              .filter((p): p is string => Boolean(p))
              .map((p) => normalizeRoute(p))
          )
        );
        const resolvedPathname =
          pinRoutes.length === 1
            ? review.pins.find((p) => p.pathname)?.pathname || currentRoute
            : review.pathname || primaryPin?.pathname || currentRoute;
        const annotation: CommentAnnotation = {
          id: review.id,
          timestamp: review.timestamp,
          type: 'voice',
          comment: review.annotatedTranscript || review.transcript,
          targetSelector: primaryPin?.targetSelector,
          targetHash: primaryPin?.targetHash,
          sourceLocation: primaryPin?.sourceLocation,
          htmlSnippet: primaryPin?.htmlSnippet,
          bounds: primaryPin?.bounds,
          url: review.url,
          pathname: resolvedPathname,
          pageTitle: review.pageTitle,
          targets: review.pins.map((p) => ({
            targetSelector: p.targetSelector,
            targetHash: p.targetHash,
            sourceLocation: p.sourceLocation,
            htmlSnippet: p.htmlSnippet,
            bounds: p.bounds,
            pathname: p.pathname,
          })),
          voiceSections: review.sections,
        };
        this.annotations.push(annotation);
        this.voiceReviews.push(review);
        if (this.reviewMode === 'live') {
          await this.submitBatch();
        } else {
          this.sessionStatus = 'draft';
          this.scheduleAutoSync();
          this.isDrawerOpen = true;
        }
      }
      this.activeTool = 'none';
      this.activeVoicePins = [];
    } finally {
      this.isStoppingVoice = false;
      this.notify();
    }
  }

  public cancelVoiceRecording(): void {
    VoiceRecorder.getInstance().cancel();
    this.activeVoicePins = [];
    this.activeTool = 'none';
    this.notify();
  }

  public recordVoicePin(targetEl: HTMLElement, appendToCurrentSection: boolean = false): void {
    const recorder = VoiceRecorder.getInstance();
    const sourceLocation = resolveSourceLocation(targetEl);
    const rect = targetEl.getBoundingClientRect();
    const bounds = {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
    const selector =
      targetEl.tagName.toLowerCase() +
      (targetEl.id ? `#${targetEl.id}` : '') +
      (targetEl.className && typeof targetEl.className === 'string'
        ? `.${targetEl.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '');

    const snippet = targetEl.outerHTML.slice(0, 200);

    const pin = recorder.addPin(
      {
        selector,
        sourceLocation,
        htmlSnippet: snippet,
        bounds,
        pathname: this.getCurrentPathname(),
      },
      { appendToCurrentSection }
    );

    this.activeVoicePins = [...this.activeVoicePins, pin];

    // Visual ripple effect on clicked element
    try {
      const origTransition = targetEl.style.transition;
      const origBoxShadow = targetEl.style.boxShadow;
      targetEl.style.transition = 'box-shadow 0.2s ease, transform 0.2s ease';
      targetEl.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.4)';
      setTimeout(() => {
        targetEl.style.boxShadow = origBoxShadow;
        targetEl.style.transition = origTransition;
      }, 400);
    } catch (e) {}

    this.notify();
  }

  public deleteVoiceReview(id: string): void {
    this.voiceReviews = this.voiceReviews.filter((v) => v.id !== id);
    this.annotations = this.annotations.filter((a) => a.id !== id);
    this.activeVoicePins = [];
    if (this.reviewMode === 'batch') this.sessionStatus = 'draft';
    this.notify();
  }

  public setDockMenuOpen(val: boolean): void {
    this.isDockMenuOpen = val;
    this.notify();
  }

  public setDockPosition(pos: DockPosition): void {
    this.dockPosition = pos;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.DOCK_POSITION, JSON.stringify(pos));
      }
    } catch {}
    this.notify();
  }

  public clampDockPosition(): void {
    if (typeof window === 'undefined') return;
    const maxOffset = Math.max(20, window.innerHeight - 80);
    if (this.dockPosition.offsetY > maxOffset) {
      this.dockPosition = {
        ...this.dockPosition,
        offsetY: maxOffset,
      };
      this.notify();
    }
  }

  public setDrawerOpen(val: boolean): void {
    this.isDrawerOpen = val;
    this.notify();
  }

  public getSnapshotForElement(el: HTMLElement): ElementSnapshot | undefined {
    return this.domMutations.getSnapshot(el);
  }

  public resetElementProperty(el: HTMLElement, property: string): void {
    this.domMutations.resetElementProperty(el, property);
    this.syncMutationsForElement(el);
    this.notify();
  }


  public setHoveredElement(el: HTMLElement | null): void {
    if (this.hoveredElement === el) return;
    this.hoveredElement = el;
    this.notify();
  }

  public setActiveElement(el: HTMLElement | null): void {
    if (this.activeElement === el) return;

    if (this.activeElement) {
      this.syncMutationsForElement(this.activeElement);
    }

    this.activeElement = el;
    if (el) {
      this.captureInitialSnapshot(el);
    }
    this.notify();
  }

  public isComposingComment(): boolean {
    return Boolean(
      this.commentTargetElement ||
      this.commentTargetElements.length > 0 ||
      (this.activeTool === 'comment' && this.commentDraftText.trim().length > 0)
    );
  }

  public setCommentDraftText(text: string): void {
    this.commentDraftText = text;
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (text.trim()) {
          sessionStorage.setItem(STORAGE_KEYS.COMPOSER_DRAFT, text);
        } else {
          sessionStorage.removeItem(STORAGE_KEYS.COMPOSER_DRAFT);
        }
      }
    } catch {}
  }

  public setCommentTarget(
    el: HTMLElement | null,
    options?: { selectedText?: string; bounds?: { x: number; y: number; width: number; height: number }; screenshot?: string }
  ): void {
    this.commentTargetElement = el;
    this.commentTargetElements = el ? [el] : [];
    this.commentTargetSelectedText = options?.selectedText;
    this.commentTargetBounds = options?.bounds;
    this.commentPendingScreenshot = options?.screenshot;

    if (!el) {
      this.setCommentDraftText('');
      if (this.pendingPageReload) {
        this.pendingPageReload = false;
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 150);
      }
    }

    this.notify();
  }

  public setPendingScreenshot(screenshot?: string): void {
    this.commentPendingScreenshot = screenshot;
    this.notify();
  }

  public toggleCommentTarget(el: HTMLElement): void {
    if (this.commentTargetSelectedText) {
      this.setCommentTarget(el);
      return;
    }

    const idx = this.commentTargetElements.indexOf(el);
    if (idx === -1) {
      this.commentTargetElements.push(el);
      this.commentTargetElement = el;
    } else {
      if (this.commentTargetElements.length > 1) {
        this.commentTargetElements.splice(idx, 1);
        this.commentTargetElement = this.commentTargetElements[this.commentTargetElements.length - 1];
      } else {
        this.setCommentTarget(null);
        return;
      }
    }
    this.commentTargetBounds = undefined;
    this.notify();
  }

  public removeCommentTarget(el: HTMLElement): void {
    const idx = this.commentTargetElements.indexOf(el);
    if (idx !== -1) {
      this.commentTargetElements.splice(idx, 1);
      if (this.commentTargetElements.length === 0) {
        this.setCommentTarget(null);
        return;
      } else {
        this.commentTargetElement = this.commentTargetElements[this.commentTargetElements.length - 1];
      }
      this.notify();
    }
  }

  public addComment(
    comment: string,
    el?: HTMLElement,
    options?: { selectedText?: string; bounds?: { x: number; y: number; width: number; height: number }; screenshot?: string }
  ): void {
    const commentText = comment.trim();
    const screenshot = options?.screenshot || this.commentPendingScreenshot;
    if (!commentText && !screenshot) return;

    const targetsList =
      this.commentTargetElements.length > 1
        ? this.commentTargetElements
        : el
        ? [el]
        : this.commentTargetElements.length > 0
        ? this.commentTargetElements
        : this.commentTargetElement
        ? [this.commentTargetElement]
        : [];

    const isMulti = targetsList.length > 1;
    const primaryTarget = targetsList[0];
    const selectedText = options?.selectedText || this.commentTargetSelectedText;
    const customBounds = options?.bounds || this.commentTargetBounds;

    const scrollX = typeof window !== 'undefined' ? window.scrollX || window.pageXOffset || 0 : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;
    const primaryLoc = primaryTarget ? resolveSourceLocation(primaryTarget) : undefined;
    const primaryElBounds = primaryTarget ? primaryTarget.getBoundingClientRect() : undefined;
    const primaryBounds = customBounds
      ? {
          x: Math.round(customBounds.x + scrollX),
          y: Math.round(customBounds.y + scrollY),
          width: Math.round(customBounds.width),
          height: Math.round(customBounds.height),
        }
      : primaryElBounds
      ? {
          x: Math.round(primaryElBounds.left + scrollX),
          y: Math.round(primaryElBounds.top + scrollY),
          width: Math.round(primaryElBounds.width),
          height: Math.round(primaryElBounds.height),
        }
      : undefined;
    const primarySnippet = primaryLoc?.htmlSnippet || (primaryTarget ? primaryTarget.outerHTML.slice(0, 300) : undefined);
    const primaryHash = primaryLoc?.selector
      ? computeTargetHash({ selector: primaryLoc.selector, htmlSnippet: primarySnippet })
      : undefined;

    const annotationTargets: AnnotationTarget[] | undefined = isMulti
      ? targetsList.map((targetEl) => {
          const loc = resolveSourceLocation(targetEl);
          const b = targetEl.getBoundingClientRect();
          const snippet = loc.htmlSnippet || targetEl.outerHTML.slice(0, 300);
          return {
            targetSelector: loc.selector,
            targetHash: computeTargetHash({ selector: loc.selector, htmlSnippet: snippet }),
            sourceLocation: loc,
            bounds: {
              x: Math.round(b.left + scrollX),
              y: Math.round(b.top + scrollY),
              width: Math.round(b.width),
              height: Math.round(b.height),
            },
            htmlSnippet: snippet,
            pathname: this.getCurrentPathname(),
          };
        })
      : undefined;

    const componentLabel = primaryLoc?.componentName ? `<${primaryLoc.componentName}>` : primaryLoc?.selector || 'element';
    const finalComment = commentText || `Visual snapshot of ${componentLabel}`;

    const annotation: CommentAnnotation = {
      id: `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: screenshot ? 'screenshot' : isMulti ? 'multi' : selectedText ? 'text' : 'element',
      targets: annotationTargets,
      targetSelector: primaryLoc?.selector,
      targetHash: primaryHash,
      sourceLocation: primaryLoc,
      htmlSnippet: primarySnippet,
      ...this.getPageMetadata(),
      bounds: primaryBounds,
      selectedText,
      screenshot,
      comment: finalComment,
    };

    this.annotations.push(annotation);
    this.commentTargetElement = null;
    this.commentTargetElements = [];
    this.commentTargetSelectedText = undefined;
    this.commentTargetBounds = undefined;
    this.commentPendingScreenshot = undefined;
    this.setCommentDraftText('');
    this.activeTool = 'none';

    if (this.pendingPageReload) {
      this.pendingPageReload = false;
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 150);
    }

    if (this.reviewMode === 'live') {
      this.submitBatch();
    } else {
      this.sessionStatus = 'draft';
      this.notify();
    }
  }

  private triggerShutterFlash(el: HTMLElement): void {
    try {
      const origTransition = el.style.transition;
      const origBoxShadow = el.style.boxShadow;
      el.style.transition = 'box-shadow 0.15s ease, outline 0.15s ease';
      el.style.boxShadow = '0 0 0 3px #f59e0b, 0 0 24px rgba(245, 158, 11, 0.6)';
      setTimeout(() => {
        el.style.boxShadow = origBoxShadow;
        el.style.transition = origTransition;
      }, 350);
    } catch {}
  }

  public async snapElementToComposer(el: HTMLElement): Promise<void> {
    if (!el || typeof document === 'undefined') return;

    const loc = resolveSourceLocation(el);
    const targetSelector = loc.selector || (el.id ? `#${el.id}` : el.tagName.toLowerCase());

    let screenshotDataUrl = '';
    try {
      const snap = await captureVisualSnapshot({
        selector: targetSelector,
        resolution: 'draft',
        includeOverlay: false,
      });
      if (snap && snap.success && snap.imageBase64) {
        screenshotDataUrl = snap.imageBase64;
      }
    } catch {}

    // Flash shutter feedback after clean capture snapshot has been recorded
    this.triggerShutterFlash(el);

    // Open comment composer anchored to el with the captured screenshot
    this.setCommentTarget(el, { screenshot: screenshotDataUrl });
  }

  public async captureElementScreenshot(el: HTMLElement, commentText?: string): Promise<CommentAnnotation | null> {
    if (!el || typeof document === 'undefined') return null;

    const loc = resolveSourceLocation(el);
    const targetSelector = loc.selector || (el.id ? `#${el.id}` : el.tagName.toLowerCase());

    let screenshotDataUrl = '';
    try {
      const snap = await captureVisualSnapshot({
        selector: targetSelector,
        resolution: 'draft',
        includeOverlay: false,
      });
      if (snap && snap.success && snap.imageBase64) {
        screenshotDataUrl = snap.imageBase64;
      }
    } catch {}

    this.triggerShutterFlash(el);

    const componentLabel = loc.componentName ? `<${loc.componentName}>` : targetSelector;
    const defaultComment = (commentText || '').trim() || `Visual snapshot of ${componentLabel}`;

    this.addComment(defaultComment, el, { screenshot: screenshotDataUrl });
    if (this.reviewMode !== 'live') {
      this.setDrawerOpen(true);
    }
    return this.annotations[this.annotations.length - 1] || null;
  }

  public updateAnnotation(id: string, newText: string): void {
    const ann = this.annotations.find((a) => a.id === id);
    if (ann && newText.trim()) {
      ann.comment = newText.trim();
      if (this.reviewMode === 'batch') this.sessionStatus = 'draft';
      this.notify();
    }
  }

  public deleteAnnotation(id: string): void {
    this.annotations = this.annotations.filter((a) => a.id !== id);
    this.voiceReviews = this.voiceReviews.filter((v) => v.id !== id);
    this.activeVoicePins = [];
    if (this.reviewMode === 'batch') this.sessionStatus = 'draft';
    this.notify();
  }

  public setUserPrompt(prompt: string): void {
    this.userPrompt = prompt;
    this.notify();
  }

  public captureInitialSnapshot(el: HTMLElement): void {
    this.domMutations.captureInitialSnapshot(el);
  }

  public updateElementStyle(property: string, value: string): void {
    if (!this.activeElement) return;
    this.domMutations.updateElementStyle(this.activeElement, property, value);
    this.syncMutationsForElement(this.activeElement);
    this.scheduleLiveMutationSubmit();
    this.notify();
  }

  public updateElementText(newText: string): void {
    if (!this.activeElement) return;
    this.domMutations.updateElementText(this.activeElement, newText);
    this.syncMutationsForElement(this.activeElement);
    this.scheduleLiveMutationSubmit();
    this.notify();
  }

  public addClass(className: string): void {
    if (!this.activeElement || !className.trim()) return;
    this.domMutations.addClass(this.activeElement, className);
    this.syncMutationsForElement(this.activeElement);
    this.scheduleLiveMutationSubmit();
    this.notify();
  }

  public removeClass(className: string): void {
    if (!this.activeElement || !className.trim()) return;
    this.domMutations.removeClass(this.activeElement, className);
    this.syncMutationsForElement(this.activeElement);
    this.scheduleLiveMutationSubmit();
    this.notify();
  }

  public deleteElement(): void {
    if (!this.activeElement) return;
    const mutation = this.domMutations.deleteElement(this.activeElement, this.getPageMetadata());
    this.mutations.push(mutation);
    this.setActiveElement(null);
    this.scheduleLiveMutationSubmit();
    this.notify();
  }

  public duplicateElement(): void {
    if (!this.activeElement || !this.activeElement.parentElement) return;
    const { clone, mutation } = this.domMutations.duplicateElement(this.activeElement, this.getPageMetadata());
    this.mutations.push(mutation);
    this.setActiveElement(clone);
    this.scheduleLiveMutationSubmit();
    this.notify();
  }

  public revertMutation(mutationId: string): void {
    const res = this.domMutations.revertMutation(
      mutationId,
      this.mutations,
      this.getCurrentPathname(),
      this.activeElement
    );
    this.mutations = res.remainingMutations;
    if (res.clearActive) {
      this.setActiveElement(null);
    } else if (res.needSyncTarget) {
      this.syncMutationsForElement(res.needSyncTarget);
    }
    this.notify();
  }

  public revertAll(): void {
    this.domMutations.revertAll();
    this.variantManager.revertAll();
    this.activeVariantPreview.clear();
    this.variantDecisions = [];
    this.variantSets = [];

    this.mutations = [];
    this.annotations = [];
    this.voiceReviews = [];
    this.activeVoicePins = [];
    this.sessionStatus = 'draft';
    this.activeElement = null;
    this.commentTargetElement = null;
    this.commentTargetElements = [];
    this.notify();
  }

  public moveElement(direction: 'up' | 'down'): void {
    if (!this.activeElement) return;
    const mutation = this.domMutations.moveElement(this.activeElement, direction, this.getPageMetadata());
    if (mutation) {
      this.mutations.push(mutation);
      this.scheduleLiveMutationSubmit();
      this.notify();
    }
  }

  public syncMutationsForElement(el: HTMLElement): void {
    this.mutations = this.domMutations.syncMutationsForElement(el, this.mutations, this.getPageMetadata());
  }

  public getBatch(): VisualEditBatch {
    if (this.activeElement && typeof document !== 'undefined' && document.body?.contains(this.activeElement)) {
      this.syncMutationsForElement(this.activeElement);
    }

    const currentRoute = this.getCurrentPathname();
    const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const routeWithSearch = currentRoute.includes('?') ? currentRoute : `${currentRoute}${search}`;
    const pageMeta = this.getPageMetadata();

    const primarySource = this.activeElement ? resolveSourceLocation(this.activeElement) : this.mutations[0]?.sourceLocation;

    const visitedByNorm = new Map<string, string>();
    const addVisited = (p?: string) => {
      if (!p) return;
      const norm = normalizeRoute(p);
      if (!visitedByNorm.has(norm)) {
        visitedByNorm.set(norm, p);
      }
    };

    addVisited(currentRoute);
    this.mutations.forEach((m) => addVisited(m.pathname));
    this.annotations.forEach((a) => {
      addVisited(a.pathname);
      a.targets?.forEach((t) => addVisited(t.pathname));
    });
    this.voiceReviews.forEach((v) => {
      addVisited(v.pathname);
      v.pins?.forEach((p) => addVisited(p.pathname));
    });

    const batch: VisualEditBatch = {
      id: this.sessionId,
      timestamp: Date.now(),
      route: routeWithSearch,
      url: pageMeta.url,
      pageTitle: pageMeta.pageTitle,
      pagesVisited: Array.from(visitedByNorm.values()),
      appId: typeof window !== 'undefined' ? (window as any).__LUX_APP_ID__ : undefined,
      status: this.sessionStatus,
      reviewMode: this.reviewMode,
      userPrompt: this.userPrompt,
      primarySource,
      mutations: this.mutations,
      annotations: this.annotations,
      voiceReviews: this.voiceReviews,
      variantSets: this.variantSets,
      variantDecisions: this.variantDecisions,
      replies: this.agentReplies,
    };

    batch.revisionHash = computeBatchRevisionHash(batch);
    return batch;
  }

  public async submitBatch(): Promise<void> {
    const batch = this.getBatch();
    this.sessionStatus = 'submitted';
    batch.status = 'submitted';

    if (isWebSocketOpen(this.ws)) {
      this.ws.send(JSON.stringify({ type: 'SUBMIT_BATCH', payload: batch }));
    } else {
      await fetch(`${BASE_PATH_PREFIX}/__visual_edit__/api/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    }

    this.notify();
  }

  private initWebSocket(): void {
    try {
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${BASE_PATH_PREFIX}${API_ROUTES.WS}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATUS_CHANGE') {
            this.sessionStatus = data.payload.status;
            if (Array.isArray(data.payload.verificationTargets) && data.payload.verificationTargets.length > 0) {
              try {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem(STORAGE_KEYS.VERIFY_TARGETS, JSON.stringify(data.payload.verificationTargets));
                }
              } catch {}
              this.triggerVerificationHalo(data.payload.verificationTargets);
            }
            if (data.payload.status === 'implemented' || data.payload.status === 'resolved') {
              this.mutations = [];
              this.annotations = [];
              this.voiceReviews = [];
              this.activeVoicePins = [];
              this.variantDecisions = [];
              this.variantSets = [];
              this.activeVariantPreview.clear();
              this.variantManager.clearOriginalSnapshots();
              this.userPrompt = '';
              this.sessionId = `session_${Date.now().toString(36)}`;
              this.sessionStatus = 'draft';
              try {
                localStorage.removeItem(this.getStorageKey());
                localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
              } catch (e) {}
            }
            if (data.payload.replies) {
              this.agentReplies = data.payload.replies;
            }
            this.notify();
          } else if (data.type === 'AGENT_REPLY') {
            this.agentReplies.push(data.payload);
            this.notify();
          } else if (data.type === 'AGENT_STATUS') {
            if (data.payload) {
              this.hookLease = data.payload;
              this.notify();
            }
          } else if (data.type === 'SET_REVIEW_MODE') {
            const mode = data.payload?.reviewMode || data.payload?.mode;
            if (mode === 'live' || mode === 'batch') {
              this.reviewMode = mode;
              if (mode === 'batch') {
                this.sessionStatus = 'draft';
              }
              try {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(STORAGE_KEYS.REVIEW_MODE, this.reviewMode);
                }
              } catch {}
              this.notify();
            }
          } else if (data.type === 'SYNC_VARIANTS') {
            const list = Array.isArray(data.payload) ? data.payload : [];
            this.variantSets = list.filter((s: ElementVariantSet) => s.status === 'pending');
            this.notify();
          } else if (data.type === 'PROPOSE_VARIANTS') {
            const incoming = data.payload as ElementVariantSet;
            if (incoming && incoming.id) {
              const idx = this.variantSets.findIndex((s) => s.id === incoming.id);
              if (idx !== -1) {
                this.variantSets[idx] = incoming;
              } else {
                this.variantSets.push(incoming);
              }
              this.notify();
            }
          } else if (data.type === 'SUPERSEDE_VARIANTS') {
            const incoming = data.payload as ElementVariantSet;
            if (incoming && incoming.id) {
              const idx = this.variantSets.findIndex((s) => s.id === incoming.id);
              if (idx !== -1) {
                this.variantSets[idx] = incoming;
              }
              if (this.activeVariantPreview.has(incoming.id)) {
                this.previewVariant(incoming.id, null);
              }
              this.notify();
            }
          } else if (data.type === 'CAPTURE_REQUEST') {
            try {
              const res = await captureVisualSnapshot(data.payload);
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'CAPTURE_RESPONSE', payload: res }));
              }
            } catch (captureErr: any) {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(
                  JSON.stringify({
                    type: 'CAPTURE_RESPONSE',
                    payload: {
                      requestId: data.payload?.requestId || 'unknown',
                      error: captureErr?.message || String(captureErr),
                    },
                  })
                );
              }
            }
          } else if (data.type === 'RELOAD_PAGE') {
            if (Array.isArray(data.payload?.verificationTargets) && data.payload.verificationTargets.length > 0) {
              try {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem(STORAGE_KEYS.VERIFY_TARGETS, JSON.stringify(data.payload.verificationTargets));
                }
              } catch {}
            }
            try {
              localStorage.removeItem(this.getStorageKey());
              localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
            } catch (e) {}

            if (this.isComposingComment()) {
              this.pendingPageReload = true;
              this.notify();
            } else {
              window.location.reload();
            }
          }
        } catch (e) {
          console.error('[visual-edit] WebSocket error parsing message:', e);
        }
      };

      this.ws.onerror = () => {};

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'SET_REVIEW_MODE',
              payload: { reviewMode: this.reviewMode, mode: this.reviewMode },
            })
          );
        }
      };

      this.ws.onclose = () => {
        if (this.reconnectAttempts < 10) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
          this.reconnectTimer = setTimeout(() => this.initWebSocket(), delay);
        }
      };
    } catch {
      console.debug('[lux] WebSocket connection not available');
    }
  }
}
