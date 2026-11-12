import fs from 'node:fs';
import path from 'node:path';
import {
  VisualEditBatch,
  SessionStatus,
  SessionSummary,
  AgentReply,
  ReviewMode,
  ElementVariantSet,
  VariantDecision,
  HookLeaseStatus,
  VerificationTarget,
  WebSocketMessage,
  SERVER_METADATA_DIR,
  computeBatchRevisionHash,
} from '@visual-edit/core';
import {
  GetPendingReviewOptions,
  ensureVisualEditGitignored,
  extractVerificationTargetsFromSession,
  hasSessionContent as checkHasSessionContent,
  loadReviewModeFromFile,
  loadSessionsFromJsonl,
  pruneSessionsMap,
  saveReviewModeToFile,
  saveSessionsToJsonl,
  sessionMatchesTarget,
} from './session-storage.js';
import { VariantStore } from './variant-store.js';
import { LeaseManager } from './lease-manager.js';

export { sessionMatchesTarget, type GetPendingReviewOptions } from './session-storage.js';
export { VariantStore } from './variant-store.js';
export { LeaseManager };
export type { HookWaiter } from './lease-manager.js';

export type StoreEventType = WebSocketMessage['type'] | 'SAVE_BATCH';

export interface StoreEvent {
  type: StoreEventType;
  sessionId: string;
  payload: unknown;
}

export class EventStore {
  private static instances = new Map<string, EventStore>();
  private rootDir: string;
  private filePath: string;
  private variantsPath: string;
  private reviewModePath: string;
  private sessions = new Map<string, VisualEditBatch>();
  private listeners = new Set<(event: StoreEvent) => void>();
  private variantStore: VariantStore;
  private leaseManager: LeaseManager;

  private currentCursor = 0;
  private reviewMode: ReviewMode = 'batch';

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    const dataDir = path.join(this.rootDir, SERVER_METADATA_DIR);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'sessions.jsonl');
    this.variantsPath = path.join(dataDir, 'variants.json');
    this.reviewModePath = path.join(dataDir, 'review-mode.json');
    ensureVisualEditGitignored(this.rootDir);
    const savedMode = loadReviewModeFromFile(this.reviewModePath);
    if (savedMode) {
      this.reviewMode = savedMode;
    }
    this.loadFromDisk();

    this.variantStore = new VariantStore(this.variantsPath, {
      getPendingReview: () => this.getPendingReview(),
      getSession: (id) => this.getSession(id),
      saveBatch: (batch, opts) => this.saveBatch(batch, opts),
      notify: (type, id, payload) => this.notify(type, id, payload),
      nextCursor: () => this.nextCursor(),
      getReviewMode: () => this.reviewMode,
      onVariantProposed: () => {
        this.leaseManager.updateSeenCursor(this.currentCursor);
      },
    });

    this.leaseManager = new LeaseManager({
      getReviewMode: () => this.reviewMode,
      getCurrentCursor: () => this.currentCursor,
      getSubmittedPendingReview: (opts) => this.getSubmittedPendingReview(opts),
      notify: (type, id, payload) => this.notify(type, id, payload),
    });
  }

  public static getInstance(rootDir?: string): EventStore {
    const resolvedRoot = path.resolve(rootDir || process.cwd());
    let store = EventStore.instances.get(resolvedRoot);
    if (!store) {
      store = new EventStore(resolvedRoot);
      EventStore.instances.set(resolvedRoot, store);
    }
    return store;
  }

  public hasSessionContent(batch: VisualEditBatch): boolean {
    return checkHasSessionContent(batch);
  }

  public hasPendingAgentWork(batch: VisualEditBatch): boolean {
    if (!this.hasSessionContent(batch)) return false;
    if (batch.variantDecisions && batch.variantDecisions.length > 0) return true;
    if (batch.mutations && batch.mutations.length > 0) return true;
    if (batch.voiceReviews && batch.voiceReviews.length > 0) return true;
    if (batch.userPrompt && batch.userPrompt.trim().length > 0) return true;

    // Suppress annotations already addressed by a subsequent pending variant proposal,
    // while still surfacing newer annotations created after the variant set was proposed.
    if (batch.annotations && batch.annotations.length > 0) {
      this.variantStore.loadVariantsFromDisk();
      const latestPendingBySelector = new Map<string, number>();
      for (const vs of this.variantStore.getVariantSets()) {
        if (vs.status === 'pending') {
          const prev = latestPendingBySelector.get(vs.targetSelector) || 0;
          if (vs.createdAt > prev) {
            latestPendingBySelector.set(vs.targetSelector, vs.createdAt);
          }
        }
      }
      const hasUncovered = batch.annotations.some((a) => {
        if (!a.targetSelector) return true;
        const proposedAt = latestPendingBySelector.get(a.targetSelector);
        return proposedAt === undefined || a.timestamp > proposedAt;
      });
      if (hasUncovered) return true;
    }

    return false;
  }

  public getReviewMode(): ReviewMode {
    return this.reviewMode;
  }

  public setReviewMode(mode: ReviewMode): void {
    if (mode !== 'live' && mode !== 'batch') return;
    const prev = this.reviewMode;
    this.reviewMode = mode;
    saveReviewModeToFile(this.reviewModePath, mode);
    if (mode === 'live') {
      const pending = this.getPendingReview();
      if (pending && pending.status === 'draft' && this.hasSessionContent(pending)) {
        pending.status = 'submitted';
        pending.latestCursor = this.nextCursor();
        this.sessions.set(pending.id, pending);
        this.saveToDisk();
        this.notify('STATUS_CHANGE', pending.id, { status: 'submitted' });
      }
      this.leaseManager.wakeHookWaiters();
    }
    if (prev !== mode) {
      this.notify('SET_REVIEW_MODE', 'global', { reviewMode: mode });
      this.leaseManager.notifyAgentStatus();
    }
  }

  public getLatestCursor(): number {
    return this.currentCursor;
  }

  private nextCursor(): number {
    this.currentCursor += 1;
    return this.currentCursor;
  }

  private assignCursorsAndHashes(batch: VisualEditBatch): void {
    let maxBatchCursor = batch.latestCursor || 0;

    for (const collection of [batch.mutations, batch.annotations, batch.voiceReviews, batch.variantDecisions]) {
      if (!collection) continue;
      for (const item of collection) {
        if (typeof item.cursor !== 'number') {
          item.cursor = this.nextCursor();
        }
        if (item.cursor > maxBatchCursor) {
          maxBatchCursor = item.cursor;
        }
      }
    }

    if (maxBatchCursor === 0 && this.hasSessionContent(batch)) {
      maxBatchCursor = this.nextCursor();
    }

    batch.latestCursor = Math.max(batch.latestCursor || 0, maxBatchCursor);
    if (batch.latestCursor > this.currentCursor) {
      this.currentCursor = batch.latestCursor;
    }
    batch.revisionHash = computeBatchRevisionHash(batch);
  }

  public loadFromDisk(): void {
    try {
      const result = loadSessionsFromJsonl(this.filePath, this.currentCursor);
      if (!result) return;
      this.currentCursor = result.maxSeenCursor;
      this.sessions = result.sessions;
      if (result.needsSave) {
        this.saveToDisk();
      }
    } catch (err) {
      console.error('[lux] Failed to load sessions from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      saveSessionsToJsonl(this.filePath, this.sessions);
    } catch (err) {
      console.error('[lux] Failed to save sessions to disk:', err);
    }
  }

  public subscribe(fn: (event: StoreEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public notify(type: StoreEventType, sessionId: string, payload: unknown): void {
    this.listeners.forEach((fn) => fn({ type, sessionId, payload }));
  }

  public saveBatch(batch: VisualEditBatch, options?: { forceSubmit?: boolean }): void {
    this.loadFromDisk();
    if (batch.reviewMode === 'live' || batch.reviewMode === 'batch') {
      this.reviewMode = batch.reviewMode;
    } else {
      batch.reviewMode = this.reviewMode;
    }

    const hasContent = this.hasSessionContent(batch);

    if (!hasContent) {
      if (this.sessions.has(batch.id)) {
        this.sessions.delete(batch.id);
        this.saveToDisk();
        this.notify('SAVE_BATCH', batch.id, batch);
      }
      return;
    }

    const existing = this.sessions.get(batch.id);
    const prevHash = existing?.revisionHash;

    if ((!batch.variantDecisions || batch.variantDecisions.length === 0) && existing?.variantDecisions?.length) {
      batch.variantDecisions = existing.variantDecisions;
    }

    this.assignCursorsAndHashes(batch);

    if (prevHash && prevHash !== batch.revisionHash) {
      batch.latestCursor = this.nextCursor();
    }

    const effectiveMode = batch.reviewMode || this.reviewMode;
    const isLive = effectiveMode === 'live';
    const shouldMarkSubmitted = options?.forceSubmit || batch.status === 'submitted' || (isLive && hasContent);

    if (shouldMarkSubmitted) {
      batch.status = 'submitted';
      if (!prevHash || prevHash !== batch.revisionHash || options?.forceSubmit) {
        batch.latestCursor = this.nextCursor();
      }
    }

    if (existing?.status === 'in_progress' && prevHash && prevHash !== batch.revisionHash) {
      batch.stale = true;
      batch.staleReason = 'User modified elements in the browser while the agent was processing an earlier revision.';
    }

    this.sessions.set(batch.id, batch);
    pruneSessionsMap(this.sessions);
    this.saveToDisk();
    this.notify('SAVE_BATCH', batch.id, batch);

    if (batch.status === 'submitted') {
      this.leaseManager.wakeHookWaiters();
    }
  }

  public getSession(id: string): VisualEditBatch | undefined {
    this.loadFromDisk();
    return this.sessions.get(id);
  }

  public listSessions(): SessionSummary[] {
    this.loadFromDisk();
    return Array.from(this.sessions.values()).map((b) => {
      const primaryTarget = b.primarySource?.fileName
        ? `${b.primarySource.fileName}:${b.primarySource.lineNumber || 1}`
        : b.primarySource?.selector || b.mutations?.[0]?.targetSelector;

      return {
        id: b.id,
        timestamp: b.timestamp,
        route: b.route,
        status: b.status,
        reviewMode: b.reviewMode || this.reviewMode,
        revisionHash: b.revisionHash,
        latestCursor: b.latestCursor,
        mutationCount: b.mutations?.length || 0,
        annotationCount: b.annotations?.length || 0,
        voiceReviewCount: b.voiceReviews?.length || 0,
        variantDecisionCount: b.variantDecisions?.length || 0,
        userPrompt: b.userPrompt,
        primaryTarget,
        hasClaim: Boolean(b.claim && b.claim.expiresAt > Date.now()),
      };
    });
  }

  public updateStatus(
    sessionId: string,
    status: SessionStatus,
    reply?: { agentId: string; message: string },
    options?: { expectedHash?: string; modifiedSelectors?: string[] }
  ): { updated: boolean; staleConflict?: boolean; currentHash?: string; verificationTargets?: VerificationTarget[] } {
    this.loadFromDisk();
    const session = this.sessions.get(sessionId);
    if (!session) return { updated: false };

    if (
      options?.expectedHash &&
      session.revisionHash &&
      options.expectedHash !== session.revisionHash &&
      status === 'implemented'
    ) {
      return {
        updated: false,
        staleConflict: true,
        currentHash: session.revisionHash,
      };
    }

    const verificationTargets = this.extractVerificationTargets(session, options?.modifiedSelectors);

    session.status = status;
    session.stale = false;
    session.staleReason = undefined;
    if (reply) {
      if (!session.replies) session.replies = [];
      const replyRecord: AgentReply = {
        id: `reply_${Date.now()}`,
        timestamp: Date.now(),
        agentId: reply.agentId,
        message: reply.message,
      };
      session.replies.push(replyRecord);
    }

    if (status === 'in_progress') {
      session.claim = {
        agentId: reply?.agentId || 'agent',
        harness: this.leaseManager.getHarness(),
        leasedAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      this.leaseManager.setAgentState('implementing');
      this.notifyAgentStatus();
    } else if (status === 'implemented' || status === 'resolved') {
      session.claim = undefined;
      if (this.leaseManager.getAgentState() === 'implementing') {
        this.leaseManager.setAgentState('listening');
      }
      this.notifyAgentStatus();
    }

    this.saveToDisk();
    this.notify('STATUS_CHANGE', sessionId, {
      status,
      replies: session.replies,
      verificationTargets,
    });
    return { updated: true, currentHash: session.revisionHash, verificationTargets };
  }

  public extractVerificationTargets(session: VisualEditBatch, extraSelectors?: string[]): VerificationTarget[] {
    return extractVerificationTargetsFromSession(session, extraSelectors);
  }

  public getPendingReview(options?: GetPendingReviewOptions): VisualEditBatch | null {
    this.loadFromDisk();
    const maxAge = options?.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const sessions = Array.from(this.sessions.values()).sort((a, b) => b.timestamp - a.timestamp);

    const isCandidate = (s: VisualEditBatch): boolean => {
      if (s.status === 'implemented' || s.status === 'resolved') return false;
      if (now - s.timestamp > maxAge) return false;
      if (options?.appId && s.appId && s.appId !== options.appId) return false;
      if (!sessionMatchesTarget(s.url, options?.port, options?.serverUrl)) return false;
      if (typeof options?.afterCursor === 'number' && (s.latestCursor || 0) <= options.afterCursor) {
        return false;
      }
      return this.hasPendingAgentWork(s);
    };

    const markFetched = (s: VisualEditBatch): VisualEditBatch => {
      s.lastFetchedAt = Date.now();
      this.saveToDisk();
      return s;
    };

    const activeSet = options?.activeSessionIds?.length ? new Set(options.activeSessionIds) : null;
    const prioritized = activeSet ? sessions.filter((s) => activeSet.has(s.id)) : [];
    const pool = prioritized.length > 0 ? prioritized : sessions;
    const match = pool.find(isCandidate);
    return match ? markFetched(match) : null;
  }

  public getSubmittedPendingReview(options?: GetPendingReviewOptions): VisualEditBatch | null {
    const batch = this.getPendingReview(options);
    if (!batch) return null;
    if (batch.status === 'submitted' || this.reviewMode === 'live') {
      return batch;
    }
    return null;
  }

  public markPendingSessionsImplemented(options?: {
    port?: number;
    serverUrl?: string;
    sessionId?: string;
    appId?: string;
    onlyIfOlderThanReviewTurn?: boolean;
  }): VerificationTarget[] {
    this.loadFromDisk();
    let changed = false;
    const allTargets: VerificationTarget[] = [];

    for (const session of this.sessions.values()) {
      if (options?.sessionId && session.id !== options.sessionId) continue;
      if (options?.appId && session.appId && session.appId !== options.appId) continue;
      if (!sessionMatchesTarget(session.url, options?.port, options?.serverUrl)) continue;
      if (session.status !== 'implemented' && session.status !== 'resolved' && this.hasSessionContent(session)) {
        if (options?.onlyIfOlderThanReviewTurn) {
          if (session.status === 'draft' && !session.lastFetchedAt) continue;
          const turnCutoff = session.lastFetchedAt ?? (session.status === 'submitted' ? session.timestamp : 0);
          if (!turnCutoff) continue;

          const latestContentTime = Math.max(
            session.timestamp || 0,
            ...(session.annotations?.map((a) => a.timestamp) || []),
            ...(session.voiceReviews?.map((v) => v.timestamp) || [])
          );
          if (latestContentTime > turnCutoff) continue;
        }

        const targets = this.extractVerificationTargets(session);
        allTargets.push(...targets);
        session.status = 'implemented';
        session.claim = undefined;
        changed = true;
        this.notify('STATUS_CHANGE', session.id, {
          status: 'implemented',
          replies: session.replies || [],
          verificationTargets: targets,
        });
      }
    }
    if (changed) {
      this.leaseManager.onSessionImplemented();
      pruneSessionsMap(this.sessions);
      this.saveToDisk();
    }
    return allTargets;
  }

  // ============================================================================
  // Component Variants ("Element Alternatives")
  // ============================================================================

  public proposeVariants(input: Parameters<VariantStore['proposeVariants']>[0]): ElementVariantSet {
    return this.variantStore.proposeVariants(input);
  }

  public dismissVariantSet(setId: string): boolean {
    return this.variantStore.dismissVariantSet(setId);
  }

  public getVariantSets(targetSelector?: string): ElementVariantSet[] {
    return this.variantStore.getVariantSets(targetSelector);
  }

  public recordVariantDecision(input: Parameters<VariantStore['recordVariantDecision']>[0]): VariantDecision | null {
    return this.variantStore.recordVariantDecision(input);
  }

  public revertVariantDecision(setId: string, sessionId?: string): boolean {
    return this.variantStore.revertVariantDecision(setId, sessionId);
  }

  public deleteVariantSet(setId: string, sessionId?: string): boolean {
    return this.variantStore.deleteVariantSet(setId, sessionId);
  }

  // ============================================================================
  // Lifecycle Hooks & Long-Poll Engine
  // ============================================================================

  public isBackgroundWaiterConnected(): boolean {
    return this.leaseManager.isBackgroundWaiterConnected();
  }

  public getHookLeaseStatus(): HookLeaseStatus {
    return this.leaseManager.getHookLeaseStatus();
  }

  public notifyAgentStatus(): void {
    this.leaseManager.notifyAgentStatus();
  }

  public registerHookEvent(input: Parameters<LeaseManager['registerHookEvent']>[0]): HookLeaseStatus {
    return this.leaseManager.registerHookEvent(input);
  }

  public endLiveReview(): void {
    this.leaseManager.endLiveReview();
  }

  public clearWaiters(): void {
    this.leaseManager.clearWaiters();
  }

  public waitForFeedback(options?: Parameters<LeaseManager['waitForFeedback']>[0]): ReturnType<LeaseManager['waitForFeedback']> {
    return this.leaseManager.waitForFeedback(options);
  }
}
