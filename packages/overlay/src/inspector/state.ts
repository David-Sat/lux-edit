import {
  AgentReply,
  CommentAnnotation,
  MutationRecord,
  SessionStatus,
  VisualEditBatch,
  VoiceReviewWalkthrough,
  VoiceTargetPin,
  API_ROUTES,
  DockPosition,
  ReviewMode,
  HookLeaseStatus,
  ElementVariantSet,
  VariantDecision,
  VerificationTarget,
  computeBatchRevisionHash,
} from '@visual-edit/core';
import { resolveSourceLocation } from '../source-locator/index.js';
import { VoiceRecorder } from './voice-recorder.js';
import { getRouteFromLocation, normalizeRoute } from './route-utils.js';
import { DomMutationManager, ElementSnapshot } from './dom-mutations.js';
import { VariantManager } from './variant-manager.js';
import { VoiceReviewManager } from './voice-review-manager.js';
import { AnnotationManager } from './annotation-manager.js';
import {
  clearPersistedDraft,
  clearVerificationTargets,
  consumeVerificationTargets,
  loadPersistedState,
  persistVerificationTargets,
  saveDockPosition,
  savePersistedDraft,
  saveReviewMode,
} from './storage.js';
import { StatusChangePayload, WsSyncClient } from './ws-sync.js';

export type { DockPosition, ElementSnapshot };

interface LuxGlobalWindow extends Window {
  __LUX_VERSION__?: string;
  __LUX_APP_ID__?: string;
}

function getLuxWindow(): LuxGlobalWindow | undefined {
  return typeof window !== 'undefined' ? (window as LuxGlobalWindow) : undefined;
}

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

export class OverlayStateManager {
  private static instance?: OverlayStateManager;
  private static resizeHandler: (() => void) | null = null;
  private static workbenchMode = false;

  public static setWorkbenchMode(enabled: boolean): void {
    OverlayStateManager.workbenchMode = enabled;
  }

  public static isWorkbenchMode(): boolean {
    return OverlayStateManager.workbenchMode;
  }

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

  public version: string = getLuxWindow()?.__LUX_VERSION__ || '0.15.1';
  public currentPathname: string = getRouteFromLocation();
  public updateInfo: {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string;
    changelogUrl: string;
  } | null = null;

  private domMutations = new DomMutationManager();
  private variantManager: VariantManager;
  private voiceReviewManager: VoiceReviewManager;
  private annotationManager: AnnotationManager;
  private wsSync: WsSyncClient;
  private get ws(): WebSocket | null {
    return this.wsSync.getWebSocket();
  }
  private listeners = new Set<() => void>();
  private liveMutationTimer: ReturnType<typeof setTimeout> | null = null;
  private verificationTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.wsSync = new WsSyncClient(BASE_PATH_PREFIX, {
      getReviewMode: () => this.reviewMode,
      onStatusChange: (payload) => this.handleServerStatusChange(payload),
      onAgentReply: (reply) => {
        this.agentReplies.push(reply);
        this.notify();
      },
      onAgentStatus: (lease) => {
        this.hookLease = lease;
        this.notify();
      },
      onSetReviewMode: (mode) => {
        this.reviewMode = mode;
        if (mode === 'batch') {
          this.sessionStatus = 'draft';
        }
        saveReviewMode(this.reviewMode);
        this.notify();
      },
      onSyncVariants: (list) => {
        this.variantSets = list.filter((s) => s.status === 'pending');
        this.notify();
      },
      onProposeVariants: (incoming) => {
        const idx = this.variantSets.findIndex((s) => s.id === incoming.id);
        if (idx !== -1) {
          this.variantSets[idx] = incoming;
        } else {
          this.variantSets.push(incoming);
        }
        this.notify();
      },
      onSupersedeVariants: (incoming) => {
        const idx = this.variantSets.findIndex((s) => s.id === incoming.id);
        if (idx !== -1) {
          this.variantSets[idx] = incoming;
        }
        if (this.activeVariantPreview.has(incoming.id)) {
          this.previewVariant(incoming.id, null);
        }
        this.notify();
      },
      onReloadPage: (payload) => {
        if (Array.isArray(payload?.verificationTargets) && payload.verificationTargets.length > 0) {
          persistVerificationTargets(payload.verificationTargets);
        }
        clearPersistedDraft();

        if (this.isComposingComment()) {
          this.pendingPageReload = true;
          this.notify();
        } else if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },
    });

    this.variantManager = new VariantManager({
      getSessionId: () => this.sessionId,
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
      getWebSocket: () => this.wsSync.getWebSocket(),
      submitBatch: () => this.submitBatch(),
      autoSync: () => this.autoSync(),
      notify: () => this.notify(),
      basePathPrefix: BASE_PATH_PREFIX,
    });
    this.voiceReviewManager = new VoiceReviewManager({
      getCurrentPathname: () => this.getCurrentPathname(),
      getReviewMode: () => this.reviewMode,
      getAnnotations: () => this.annotations,
      setAnnotations: (next) => {
        this.annotations = next;
      },
      getVoiceReviews: () => this.voiceReviews,
      setVoiceReviews: (next) => {
        this.voiceReviews = next;
      },
      getActiveVoicePins: () => this.activeVoicePins,
      setActiveVoicePins: (pins) => {
        this.activeVoicePins = pins;
      },
      getIsStoppingVoice: () => this.isStoppingVoice,
      setIsStoppingVoice: (val) => {
        this.isStoppingVoice = val;
      },
      onStartVoiceMode: () => {
        this.activeTool = 'voice';
        this.activeVoicePins = [];
        this.hoveredElement = null;
        this.setActiveElement(null);
        this.commentTargetElement = null;
        this.commentTargetElements = [];
      },
      clearToolToNone: () => {
        this.activeTool = 'none';
      },
      setSessionStatus: (status) => {
        this.sessionStatus = status;
      },
      setDrawerOpen: (open) => {
        this.isDrawerOpen = open;
      },
      submitBatch: () => this.submitBatch(),
      scheduleAutoSync: () => this.scheduleAutoSync(),
      notify: () => this.notify(),
    });
    this.annotationManager = new AnnotationManager({
      isWorkbenchMode: () => OverlayStateManager.workbenchMode,
      getCurrentPathname: () => this.getCurrentPathname(),
      getPageMetadata: () => this.getPageMetadata(),
      getReviewMode: () => this.reviewMode,
      isCommentToolActive: () => this.activeTool === 'comment',
      clearToolToNone: () => {
        this.activeTool = 'none';
      },
      setSessionStatus: (status) => {
        this.sessionStatus = status;
      },
      setDrawerOpen: (open) => {
        this.isDrawerOpen = open;
      },
      getAnnotations: () => this.annotations,
      setAnnotations: (next) => {
        this.annotations = next;
      },
      getVoiceReviews: () => this.voiceReviews,
      setVoiceReviews: (next) => {
        this.voiceReviews = next;
      },
      setActiveVoicePins: (pins) => {
        this.activeVoicePins = pins;
      },
      getCommentDraftText: () => this.commentDraftText,
      setCommentDraftTextField: (text) => {
        this.commentDraftText = text;
      },
      getCommentTargetElement: () => this.commentTargetElement,
      setCommentTargetElement: (el) => {
        this.commentTargetElement = el;
      },
      getCommentTargetElements: () => this.commentTargetElements,
      setCommentTargetElements: (els) => {
        this.commentTargetElements = els;
      },
      getCommentTargetSelectedText: () => this.commentTargetSelectedText,
      setCommentTargetSelectedText: (val) => {
        this.commentTargetSelectedText = val;
      },
      getCommentTargetBounds: () => this.commentTargetBounds,
      setCommentTargetBounds: (bounds) => {
        this.commentTargetBounds = bounds;
      },
      getCommentPendingScreenshot: () => this.commentPendingScreenshot,
      setCommentPendingScreenshot: (screenshot) => {
        this.commentPendingScreenshot = screenshot;
      },
      getPendingPageReload: () => this.pendingPageReload,
      setPendingPageReload: (val) => {
        this.pendingPageReload = val;
      },
      submitBatch: () => this.submitBatch(),
      notify: () => this.notify(),
    });
    if (!OverlayStateManager.workbenchMode) {
      this.loadFromStorage();
      this.restoreVerificationTargets();
      this.wsSync.connect();
      this.fetchVersionInfo();
    }
    if (typeof window !== 'undefined') {
      if (OverlayStateManager.resizeHandler) {
        window.removeEventListener('resize', OverlayStateManager.resizeHandler);
      }
      const resizeHandler = () => OverlayStateManager.instance?.clampDockPosition();
      OverlayStateManager.resizeHandler = resizeHandler;
      window.addEventListener('resize', resizeHandler);
    }
  }

  private handleServerStatusChange(payload: StatusChangePayload): void {
    const prevStatus = this.sessionStatus;
    const hasTargets = Array.isArray(payload.verificationTargets) && payload.verificationTargets.length > 0;
    const hasReplies = Boolean(payload.replies && payload.replies.length > 0);
    this.sessionStatus = payload.status;
    if (hasTargets) {
      persistVerificationTargets(payload.verificationTargets!);
      this.triggerVerificationHalo(payload.verificationTargets!);
    }
    if (payload.status === 'implemented' || payload.status === 'resolved') {
      this.mutations = [];
      this.annotations = [];
      this.voiceReviews = [];
      this.activeVoicePins = [];
      this.variantDecisions = [];
      const pendingSets = this.variantSets.filter((s) => s.status === 'pending');
      const pendingSetIds = new Set(pendingSets.map((s) => s.id));
      this.variantSets = pendingSets;
      for (const id of this.activeVariantPreview.keys()) {
        if (!pendingSetIds.has(id)) {
          this.activeVariantPreview.delete(id);
        }
      }
      this.variantManager.clearOriginalSnapshots(pendingSetIds);
      this.userPrompt = '';
      this.activeElement = null;
      this.domMutations.clear();
      this.sessionId = `session_${Date.now().toString(36)}`;
      this.sessionStatus = 'draft';
      this.lastSyncedDigest = null;
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
        this.syncTimer = null;
      }
      clearPersistedDraft();
    } else {
      this.lastSyncedDigest = this.computeSyncDigest(this.getBatch());
    }
    if (payload.replies) {
      this.agentReplies = payload.replies;
    }
    if (prevStatus === this.sessionStatus && !hasTargets && !hasReplies) {
      return;
    }
    this.notify({ skipSync: true });
  }

  private hasPendingFeedback(): boolean {
    return (
      this.mutations.length > 0 ||
      this.annotations.length > 0 ||
      this.voiceReviews.length > 0 ||
      this.variantDecisions.length > 0 ||
      this.userPrompt.trim().length > 0
    );
  }

  public setReviewMode(mode: ReviewMode): void {
    this.reviewMode = mode;
    if (mode === 'batch') {
      this.sessionStatus = 'draft';
    }
    if (!OverlayStateManager.workbenchMode) {
      saveReviewMode(mode);
      this.wsSync.send('SET_REVIEW_MODE', { reviewMode: mode, mode });
    }
    if (mode === 'live' && this.hasPendingFeedback()) {
      this.submitBatch();
      return;
    }
    this.notify();
  }

  public endLiveReview(): void {
    if (!OverlayStateManager.workbenchMode) {
      this.wsSync.send('END_LIVE_REVIEW', {});
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
      clearVerificationTargets();
      this.notify();
    }, 6000);
    this.notify();
  }

  private restoreVerificationTargets(): void {
    const targets = consumeVerificationTargets();
    if (targets) {
      this.triggerVerificationHalo(targets);
    }
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
    } catch (err) {
      console.debug('[lux] Failed to fetch version status:', err);
    }
  }

  private loadFromStorage(): void {
    const loaded = loadPersistedState();
    if (loaded.reviewMode) this.reviewMode = loaded.reviewMode;
    if (loaded.sessionId) this.sessionId = loaded.sessionId;
    if (loaded.sessionStatus) this.sessionStatus = loaded.sessionStatus;
    if (loaded.mutations) this.mutations = loaded.mutations;
    if (loaded.annotations) this.annotations = loaded.annotations;
    if (loaded.voiceReviews) this.voiceReviews = loaded.voiceReviews;
    if (loaded.variantDecisions) this.variantDecisions = loaded.variantDecisions;
    if (loaded.userPrompt !== undefined) this.userPrompt = loaded.userPrompt;
    if (loaded.dockPosition) this.dockPosition = loaded.dockPosition;
    if (loaded.commentDraftText !== undefined) this.commentDraftText = loaded.commentDraftText;
  }

  private saveToStorage(): void {
    if (OverlayStateManager.workbenchMode) return;
    savePersistedDraft(this.getBatch(), this.hasPendingFeedback(), this.sessionStatus);
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
    if (this.liveMutationTimer) {
      clearTimeout(this.liveMutationTimer);
      this.liveMutationTimer = null;
    }
    if (this.verificationTimer) {
      clearTimeout(this.verificationTimer);
      this.verificationTimer = null;
    }
    if (typeof window !== 'undefined' && OverlayStateManager.resizeHandler) {
      window.removeEventListener('resize', OverlayStateManager.resizeHandler);
      OverlayStateManager.resizeHandler = null;
    }
    this.wsSync.close();
    this.listeners.clear();
  }

  public resetForWorkbench(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.liveMutationTimer) {
      clearTimeout(this.liveMutationTimer);
      this.liveMutationTimer = null;
    }
    if (this.verificationTimer) {
      clearTimeout(this.verificationTimer);
      this.verificationTimer = null;
    }

    this.activeTool = 'none';
    this.isDockMenuOpen = false;
    this.isDrawerOpen = false;
    this.dockPosition = {
      side: 'right',
      verticalAnchor: 'bottom',
      offsetY: 24,
    };
    this.activeElement = null;
    this.hoveredElement = null;
    this.commentTargetElement = null;
    this.commentTargetElements = [];
    this.commentTargetSelectedText = undefined;
    this.commentTargetBounds = undefined;
    this.commentDraftText = '';
    this.pendingPageReload = false;
    this.commentPendingScreenshot = undefined;
    this.userPrompt = '';
    this.sessionId = `workbench_${Date.now().toString(36)}`;
    this.sessionStatus = 'draft';
    this.reviewMode = 'batch';
    this.hookLease = {
      connected: false,
      agentState: 'idle',
      seenCursor: 0,
      latestCursor: 0,
    };
    this.variantSets = [];
    this.variantDecisions = [];
    this.activeVariantPreview.clear();
    this.verificationTargets = [];
    this.mutations = [];
    this.annotations = [];
    this.voiceReviews = [];
    this.activeVoicePins = [];
    this.agentReplies = [];
    this.updateInfo = null;
    this.isStoppingVoice = false;
    this.currentPathname = getRouteFromLocation();

    this.domMutations.clear();
    this.variantManager.clearOriginalSnapshots();
    VoiceRecorder.getInstance().setWorkbenchState(null);

    this.notify();
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

  public notify(options?: { skipSync?: boolean }): void {
    this.listeners.forEach((fn) => fn());
    if (OverlayStateManager.workbenchMode) return;
    this.saveToStorage();
    if (!options?.skipSync && (this.hasPendingFeedback() || this.sessionStatus !== 'draft')) {
      this.scheduleAutoSync();
    }
  }

  private lastSyncedDigest: string | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  private computeSyncDigest(batch: VisualEditBatch): string {
    return `${batch.id}:${batch.status}:${batch.reviewMode ?? ''}:${batch.revisionHash ?? ''}`;
  }

  public scheduleAutoSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.autoSync();
    }, 200);
  }

  public async autoSync(): Promise<void> {
    if (OverlayStateManager.workbenchMode) return;
    const batch = this.getBatch();
    const hasContent = this.hasPendingFeedback();

    if (!hasContent && batch.status === 'draft') {
      return;
    }

    const digest = this.computeSyncDigest(batch);
    if (digest === this.lastSyncedDigest) {
      return;
    }

    const sent = await this.wsSync.sendBatch('SYNC_SESSION', batch, {
      allowHttpFallback: hasContent,
      swallowErrors: true,
    });
    if (sent) {
      this.lastSyncedDigest = digest;
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

  public isStoppingVoice = false;

  public startVoiceRecording(): void {
    this.voiceReviewManager.startVoiceRecording();
  }

  public stopVoiceRecording(): Promise<void> {
    return this.voiceReviewManager.stopVoiceRecording();
  }

  public cancelVoiceRecording(): void {
    this.voiceReviewManager.cancelVoiceRecording();
  }

  public recordVoicePin(targetEl: HTMLElement, appendToCurrentSection: boolean = false): void {
    this.voiceReviewManager.recordVoicePin(targetEl, appendToCurrentSection);
  }

  public deleteVoiceReview(id: string): void {
    this.voiceReviewManager.deleteVoiceReview(id);
  }

  public setDockMenuOpen(val: boolean): void {
    this.isDockMenuOpen = val;
    this.notify();
  }

  public setDockPosition(pos: DockPosition): void {
    this.dockPosition = pos;
    if (!OverlayStateManager.workbenchMode) {
      saveDockPosition(pos);
    }
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
    return this.annotationManager.isComposingComment();
  }

  public setCommentDraftText(text: string): void {
    this.annotationManager.setCommentDraftText(text);
  }

  public setCommentTarget(
    el: HTMLElement | null,
    options?: { selectedText?: string; bounds?: { x: number; y: number; width: number; height: number }; screenshot?: string }
  ): void {
    this.annotationManager.setCommentTarget(el, options);
  }

  public setPendingScreenshot(screenshot?: string): void {
    this.annotationManager.setPendingScreenshot(screenshot);
  }

  public toggleCommentTarget(el: HTMLElement): void {
    this.annotationManager.toggleCommentTarget(el);
  }

  public removeCommentTarget(el: HTMLElement): void {
    this.annotationManager.removeCommentTarget(el);
  }

  public addComment(
    comment: string,
    el?: HTMLElement,
    options?: { selectedText?: string; bounds?: { x: number; y: number; width: number; height: number }; screenshot?: string }
  ): void {
    this.annotationManager.addComment(comment, el, options);
  }

  public snapElementToComposer(el: HTMLElement): Promise<void> {
    return this.annotationManager.snapElementToComposer(el);
  }

  public captureElementScreenshot(el: HTMLElement, commentText?: string): Promise<CommentAnnotation | null> {
    return this.annotationManager.captureElementScreenshot(el, commentText);
  }

  public updateAnnotation(id: string, newText: string): void {
    this.annotationManager.updateAnnotation(id, newText);
  }

  public deleteAnnotation(id: string): void {
    this.annotationManager.deleteAnnotation(id);
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
    if (
      this.activeElement &&
      typeof document !== 'undefined' &&
      document.body?.contains(this.activeElement) &&
      !this.variantManager.isElementVariantTarget(this.activeElement)
    ) {
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
      appId: getLuxWindow()?.__LUX_APP_ID__,
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
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    const batch = this.getBatch();
    this.sessionStatus = 'submitted';
    batch.status = 'submitted';

    if (!OverlayStateManager.workbenchMode) {
      const sent = await this.wsSync.sendBatch('SUBMIT_BATCH', batch);
      if (sent) {
        this.lastSyncedDigest = this.computeSyncDigest(batch);
      }
    }

    this.notify({ skipSync: true });
  }
}
