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
  SERVER_METADATA_DIR,
  computeBatchRevisionHash,
} from '@visual-edit/core';

export interface GetPendingReviewOptions {
  port?: number;
  serverUrl?: string;
  appId?: string;
  activeSessionIds?: string[];
  maxAgeMs?: number;
  afterCursor?: number;
}

export function sessionMatchesTarget(sessionUrl: string | undefined, port?: number, serverUrl?: string): boolean {
  if (!port && !serverUrl) return true;
  if (!sessionUrl) return true;
  try {
    const parsed = new URL(sessionUrl);
    if (port) {
      if (parsed.port === String(port)) return true;
      if (!parsed.port && ((parsed.protocol === 'http:' && port === 80) || (parsed.protocol === 'https:' && port === 443))) return true;
      return false;
    }
    if (serverUrl) {
      const targetParsed = new URL(serverUrl);
      if (parsed.host === targetParsed.host) return true;
      return false;
    }
  } catch {
    if (port && sessionUrl.includes(`:${port}`)) return true;
    if (serverUrl && sessionUrl.startsWith(serverUrl)) return true;
  }
  return false;
}

import { VariantStore } from './variant-store.js';
import { LeaseManager, HookWaiter } from './lease-manager.js';

export { VariantStore } from './variant-store.js';
export { LeaseManager };
export type { HookWaiter } from './lease-manager.js';

export class EventStore {
  private static instances = new Map<string, EventStore>();
  private rootDir: string;
  private filePath: string;
  private variantsPath: string;
  private reviewModePath: string;
  private sessions = new Map<string, VisualEditBatch>();
  private listeners = new Set<(event: { type: string; sessionId: string; payload: any }) => void>();
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
    this.ensureGitignored(this.rootDir);
    this.loadReviewModeFromDisk();
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

  private loadReviewModeFromDisk(): void {
    try {
      if (fs.existsSync(this.reviewModePath)) {
        const raw = JSON.parse(fs.readFileSync(this.reviewModePath, 'utf-8'));
        if (raw?.reviewMode === 'live' || raw?.reviewMode === 'batch') {
          this.reviewMode = raw.reviewMode;
        }
      }
    } catch {}
  }

  private ensureGitignored(rootDir: string): void {
    try {
      const gitignorePath = path.join(rootDir, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        if (!content.includes('.visual-edit')) {
          const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
          fs.appendFileSync(gitignorePath, `${separator}.visual-edit/\n`, 'utf-8');
        }
      }
    } catch {
      // Intentionally silent
    }
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
    return Boolean(
      (batch.mutations && batch.mutations.length > 0) ||
      (batch.annotations && batch.annotations.length > 0) ||
      (batch.voiceReviews && batch.voiceReviews.length > 0) ||
      (batch.variantDecisions && batch.variantDecisions.length > 0) ||
      (batch.userPrompt && batch.userPrompt.trim().length > 0)
    );
  }

  public hasPendingAgentWork(batch: VisualEditBatch): boolean {
    if (!this.hasSessionContent(batch)) return false;
    if (batch.variantDecisions && batch.variantDecisions.length > 0) return true;
    if (batch.mutations && batch.mutations.length > 0) return true;
    if (batch.voiceReviews && batch.voiceReviews.length > 0) return true;
    if (batch.userPrompt && batch.userPrompt.trim().length > 0) return true;

    // For annotations: if all annotations on selectors have active pending variant sets,
    // they are currently being previewed by the user in the browser and awaiting user decision.
    if (batch.annotations && batch.annotations.length > 0) {
      this.variantStore.loadVariantsFromDisk();
      const activePendingVariantSelectors = new Set(
        this.variantStore
          .getVariantSets()
          .filter((vs) => vs.status === 'pending')
          .map((vs) => vs.targetSelector)
      );
      const hasUncovered = batch.annotations.some(
        (a) => !a.targetSelector || !activePendingVariantSelectors.has(a.targetSelector)
      );
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
    try {
      fs.writeFileSync(this.reviewModePath, JSON.stringify({ reviewMode: mode }) + '\n', 'utf-8');
    } catch {}
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

    if (batch.mutations) {
      for (const m of batch.mutations) {
        if (typeof m.cursor !== 'number') {
          m.cursor = this.nextCursor();
        }
        if (m.cursor > maxBatchCursor) maxBatchCursor = m.cursor;
      }
    }

    if (batch.annotations) {
      for (const a of batch.annotations) {
        if (typeof a.cursor !== 'number') {
          a.cursor = this.nextCursor();
        }
        if (a.cursor > maxBatchCursor) maxBatchCursor = a.cursor;
      }
    }

    if (batch.voiceReviews) {
      for (const v of batch.voiceReviews) {
        if (typeof v.cursor !== 'number') {
          v.cursor = this.nextCursor();
        }
        if (v.cursor > maxBatchCursor) maxBatchCursor = v.cursor;
      }
    }

    if (batch.variantDecisions) {
      for (const d of batch.variantDecisions) {
        if (typeof d.cursor !== 'number') {
          d.cursor = this.nextCursor();
        }
        if (d.cursor > maxBatchCursor) maxBatchCursor = d.cursor;
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

  private pruneOldSessions(): void {
    const STALE_TTL = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const [id, s] of this.sessions.entries()) {
      if (now - s.timestamp > STALE_TTL) {
        this.sessions.delete(id);
      }
    }

    const MAX_SESSIONS = 50;
    if (this.sessions.size <= MAX_SESSIONS) return;

    const sorted = Array.from(this.sessions.values()).sort((a, b) => a.timestamp - b.timestamp);
    for (const s of sorted) {
      if (this.sessions.size <= MAX_SESSIONS) break;
      if (s.status === 'implemented' || s.status === 'resolved') {
        this.sessions.delete(s.id);
      }
    }

    if (this.sessions.size > MAX_SESSIONS) {
      const remaining = Array.from(this.sessions.values()).sort((a, b) => a.timestamp - b.timestamp);
      for (const s of remaining) {
        if (this.sessions.size <= MAX_SESSIONS) break;
        if (s.status !== 'in_progress' && s.status !== 'submitted') {
          this.sessions.delete(s.id);
        }
      }
    }
  }

  public loadFromDisk(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      let prunedAny = false;
      const loadedSessions = new Map<string, VisualEditBatch>();
      let maxSeenCursor = this.currentCursor;
      for (const line of lines) {
        try {
          const batch: VisualEditBatch = JSON.parse(line);
          if (!this.hasSessionContent(batch)) {
            prunedAny = true;
            continue;
          }
          if (typeof batch.latestCursor === 'number' && batch.latestCursor > maxSeenCursor) {
            maxSeenCursor = batch.latestCursor;
          }
          if (!batch.revisionHash) {
            batch.revisionHash = computeBatchRevisionHash(batch);
          }
          loadedSessions.set(batch.id, batch);
        } catch {
          prunedAny = true;
        }
      }
      this.currentCursor = maxSeenCursor;
      this.sessions = loadedSessions;
      const initialSize = this.sessions.size;
      this.pruneOldSessions();
      if (prunedAny || this.sessions.size < initialSize) {
        this.saveToDisk();
      }
    } catch (err) {
      console.error('[lux] Failed to load sessions from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const lines = Array.from(this.sessions.values()).map((b) => JSON.stringify(b));
      const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[lux] Failed to save sessions to disk:', err);
    }
  }

  public subscribe(fn: (event: { type: string; sessionId: string; payload: any }) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public notify(type: string, sessionId: string, payload: any): void {
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

    // Preserve existing variantDecisions if the browser sync payload didn't include them
    if (!batch.variantDecisions && existing?.variantDecisions) {
      batch.variantDecisions = existing.variantDecisions;
    }

    this.assignCursorsAndHashes(batch);

    // If hash changed since last save, bump cursor so Live Mode waiters know fresh edits arrived
    if (prevHash && prevHash !== batch.revisionHash) {
      batch.latestCursor = this.nextCursor();
    }

    const effectiveMode = batch.reviewMode || this.reviewMode;
    const isLive = effectiveMode === 'live';
    const shouldMarkSubmitted = options?.forceSubmit || batch.status === 'submitted' || (isLive && hasContent);

    // In Live Mode (or when explicitly submitted), mark submitted so waiting hooks wake up immediately
    if (shouldMarkSubmitted) {
      batch.status = 'submitted';
      if (!prevHash || prevHash !== batch.revisionHash || options?.forceSubmit) {
        batch.latestCursor = this.nextCursor();
      }
    }

    // Stale detection: if an agent was already in_progress on this session and the user mutated it again
    if (existing?.status === 'in_progress' && prevHash && prevHash !== batch.revisionHash) {
      batch.stale = true;
      batch.staleReason = 'User modified elements in the browser while the agent was processing an earlier revision.';
    }

    this.sessions.set(batch.id, batch);
    this.pruneOldSessions();
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
    const targetsMap = new Map<string, VerificationTarget>();
    const now = Date.now();

    for (const m of session.mutations || []) {
      if (m.targetSelector && m.targetSelector !== ':root') {
        targetsMap.set(m.targetSelector, {
          selector: m.targetSelector,
          label: m.type === 'STYLE_CHANGE' ? `Style (${m.property})` : m.type,
          beforeHash: m.targetHash,
          timestamp: now,
        });
      }
    }

    for (const a of session.annotations || []) {
      if (a.targetSelector) {
        targetsMap.set(a.targetSelector, {
          selector: a.targetSelector,
          bounds: a.bounds,
          label: 'Comment Applied',
          beforeHash: a.targetHash,
          timestamp: now,
        });
      }
      for (const t of a.targets || []) {
        if (t.targetSelector) {
          targetsMap.set(t.targetSelector, {
            selector: t.targetSelector,
            bounds: t.bounds,
            label: 'Updated',
            beforeHash: t.targetHash,
            timestamp: now,
          });
        }
      }
    }

    for (const d of session.variantDecisions || []) {
      if (d.targetSelector) {
        targetsMap.set(d.targetSelector, {
          selector: d.targetSelector,
          label: `Variant: ${d.variantName}`,
          beforeHash: d.targetHash,
          timestamp: now,
        });
      }
    }

    for (const sel of extraSelectors || []) {
      if (sel && !targetsMap.has(sel)) {
        targetsMap.set(sel, {
          selector: sel,
          label: 'Updated by Agent',
          timestamp: now,
        });
      }
    }

    return Array.from(targetsMap.values());
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
      if (options?.sessionId && session.id !== options.sessionId) {
        continue;
      }
      if (options?.appId && session.appId && session.appId !== options.appId) {
        continue;
      }
      if (!sessionMatchesTarget(session.url, options?.port, options?.serverUrl)) {
        continue;
      }
      if (session.status !== 'implemented' && session.status !== 'resolved') {
        if (this.hasSessionContent(session)) {
          if (options?.onlyIfOlderThanReviewTurn) {
            // Draft sessions never fetched by an agent turn must never be auto-resolved
            if (session.status === 'draft' && !session.lastFetchedAt) {
              continue;
            }

            // The review turn cutoff is when the agent fetched the review,
            // or when the review was explicitly submitted if not yet fetched.
            const turnCutoff = session.lastFetchedAt ?? (session.status === 'submitted' ? session.timestamp : 0);
            if (!turnCutoff) {
              continue;
            }

            // Check if any comments or voice walkthroughs were added after the turn cutoff
            const latestContentTime = Math.max(
              session.timestamp || 0,
              ...(session.annotations?.map((a) => a.timestamp) || []),
              ...(session.voiceReviews?.map((v) => v.timestamp) || [])
            );
            if (latestContentTime > turnCutoff) {
              // User has added new comments during or after the agent's turn; preserve as pending!
              continue;
            }
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
    }
    if (changed) {
      this.leaseManager.onSessionImplemented();
      this.pruneOldSessions();
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
