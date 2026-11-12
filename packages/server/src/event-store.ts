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

interface HookWaiter {
  afterCursor: number;
  waiterId?: string;
  source?: 'stop_hook' | 'background_waiter';
  resolve: (result: {
    batch: VisualEditBatch | null;
    cursor: number;
    timedOut: boolean;
    ended: boolean;
    superseded?: boolean;
  }) => void;
  timer: NodeJS.Timeout;
}

const LEASE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class EventStore {
  private static instances = new Map<string, EventStore>();
  private rootDir: string;
  private filePath: string;
  private variantsPath: string;
  private reviewModePath: string;
  private sessions = new Map<string, VisualEditBatch>();
  private variantSets = new Map<string, ElementVariantSet>();
  private listeners = new Set<(event: { type: string; sessionId: string; payload: any }) => void>();
  private hookWaiters = new Set<HookWaiter>();
  private lastBackgroundWaiterPollAt = 0;

  private currentCursor = 0;
  private reviewMode: ReviewMode = 'batch';
  private hookLease: {
    harness?: string;
    sessionId?: string;
    agentState: 'idle' | 'listening' | 'implementing';
    seenCursor: number;
    expiresAt: number;
  } | null = null;

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
    this.loadVariantsFromDisk();
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
      this.loadVariantsFromDisk();
      const activePendingVariantSelectors = new Set(
        Array.from(this.variantSets.values())
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
      this.wakeHookWaiters();
    }
    if (prev !== mode) {
      this.notify('SET_REVIEW_MODE', 'global', { reviewMode: mode });
      this.notifyAgentStatus();
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

  private loadVariantsFromDisk(): void {
    if (!fs.existsSync(this.variantsPath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.variantsPath, 'utf-8'));
      if (Array.isArray(raw)) {
        this.variantSets.clear();
        for (const item of raw) {
          if (item && item.id) {
            this.variantSets.set(item.id, item);
          }
        }
        // Ensure only the latest pending set per targetSelector stays pending
        const latestPending = new Map<string, string>();
        for (const item of raw) {
          if (item && item.id && item.status === 'pending' && item.targetSelector) {
            const prevId = latestPending.get(item.targetSelector);
            if (prevId) {
              const prev = this.variantSets.get(prevId);
              if (prev) prev.status = 'superseded';
            }
            latestPending.set(item.targetSelector, item.id);
          }
        }
      }
    } catch {}
  }

  private saveVariantsToDisk(): void {
    try {
      const dataDir = path.dirname(this.variantsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const list = Array.from(this.variantSets.values()).slice(-30);
      const tempPath = `${this.variantsPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(list, null, 2) + '\n', 'utf-8');
      fs.renameSync(tempPath, this.variantsPath);
    } catch {}
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
      this.wakeHookWaiters();
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
        harness: this.hookLease?.harness,
        leasedAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      if (this.hookLease) {
        this.hookLease.agentState = 'implementing';
      }
      this.notifyAgentStatus();
    } else if (status === 'implemented' || status === 'resolved') {
      session.claim = undefined;
      if (this.hookLease && this.hookLease.agentState === 'implementing') {
        this.hookLease.agentState = 'listening';
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

    if (options?.activeSessionIds && options.activeSessionIds.length > 0) {
      const activeSet = new Set(options.activeSessionIds);
      for (const s of sessions) {
        if (activeSet.has(s.id) && isCandidate(s)) {
          return markFetched(s);
        }
      }
    }

    for (const s of sessions) {
      if (isCandidate(s)) {
        return markFetched(s);
      }
    }

    return null;
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
      if (this.hookLease && this.hookLease.agentState === 'implementing') {
        this.hookLease.agentState = 'listening';
        this.notifyAgentStatus();
      }
      this.pruneOldSessions();
      this.saveToDisk();
    }
    return allTargets;
  }

  // ============================================================================
  // Component Variants ("Element Alternatives")
  // ============================================================================

  public proposeVariants(input: {
    targetSelector: string;
    label?: string;
    expectedHash?: string;
    variants: Array<{
      id?: string;
      name: string;
      rationale: string;
      styles?: Record<string, string>;
      classes?: { add?: string[]; remove?: string[] };
      html?: string;
      text?: string;
    }>;
  }): ElementVariantSet {
    this.loadVariantsFromDisk();
    const setId = `varset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Check if current active session has a targetHash for this selector
    let originalTargetHash: string | undefined;
    let isStale = false;
    let staleReason: string | undefined;

    const pending = this.getPendingReview();
    if (pending) {
      const matchingMut = pending.mutations?.find((m) => m.targetSelector === input.targetSelector);
      const matchingAnn = pending.annotations?.find((a) => a.targetSelector === input.targetSelector);
      originalTargetHash = matchingMut?.targetHash || matchingAnn?.targetHash || pending.revisionHash;
      if (input.expectedHash && originalTargetHash && input.expectedHash !== originalTargetHash) {
        isStale = true;
        staleReason = `Target hash mismatch: expected ${input.expectedHash}, current is ${originalTargetHash}`;
      }
    }

    const variantSet: ElementVariantSet = {
      id: setId,
      targetSelector: input.targetSelector,
      label: input.label || `Variants for ${input.targetSelector}`,
      createdAt: Date.now(),
      expectedHash: input.expectedHash,
      originalTargetHash,
      status: isStale ? 'stale' : 'pending',
      staleReason,
      variants: input.variants.map((v: any, idx) => {
        let styles: Record<string, string> | undefined = v.styles;
        if (!styles && Array.isArray(v.styleMutations)) {
          styles = {};
          for (const m of v.styleMutations) {
            if (m.property && m.value !== undefined) {
              styles[m.property] = String(m.value);
            }
          }
        }
        return {
          id: v.id || `var_${idx + 1}_${Date.now().toString(36)}`,
          name: v.name,
          rationale: v.rationale || v.description || '',
          styles,
          classes: v.classes,
          html: v.html,
          text: v.text,
        };
      }),
    };

    if (!isStale) {
      // Supersede any existing pending variant sets for the same targetSelector
      for (const [existingId, existingSet] of this.variantSets.entries()) {
        if (existingSet.targetSelector === input.targetSelector && existingSet.status === 'pending') {
          existingSet.status = 'superseded';
          this.variantSets.set(existingId, existingSet);
          this.notify('SUPERSEDE_VARIANTS', existingId, existingSet);
        }
      }
      this.variantSets.set(setId, variantSet);
      this.saveVariantsToDisk();
      if (this.hookLease) {
        this.hookLease.seenCursor = Math.max(this.hookLease.seenCursor || 0, this.currentCursor);
        this.hookLease.agentState = 'listening';
        this.notifyAgentStatus();
      }
      this.notify('PROPOSE_VARIANTS', setId, variantSet);
    }
    return variantSet;
  }

  public dismissVariantSet(setId: string): boolean {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(setId);
    if (!set) return false;
    set.status = 'superseded';
    this.saveVariantsToDisk();
    this.notify('SUPERSEDE_VARIANTS', setId, set);
    return true;
  }

  public getVariantSets(targetSelector?: string): ElementVariantSet[] {
    this.loadVariantsFromDisk();
    const all = Array.from(this.variantSets.values());
    if (targetSelector) {
      return all.filter((s) => s.targetSelector === targetSelector);
    }
    return all;
  }

  public recordVariantDecision(input: {
    setId: string;
    selectedVariantId: string;
    userNote?: string;
    targetHash?: string;
    sessionId?: string;
  }): VariantDecision | null {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(input.setId);
    if (!set) return null;

    const chosen = set.variants.find((v) => v.id === input.selectedVariantId);
    if (!chosen) return null;

    set.selectedVariantId = chosen.id;
    set.status = 'decided';
    this.saveVariantsToDisk();

    const cursor = this.nextCursor();
    const decision: VariantDecision = {
      id: `vdec_${Date.now().toString(36)}`,
      setId: set.id,
      targetSelector: set.targetSelector,
      label: set.label,
      selectedVariantId: chosen.id,
      variantName: chosen.name,
      rationale: chosen.rationale,
      variant: chosen,
      userNote: input.userNote,
      targetHash: input.targetHash || set.originalTargetHash,
      timestamp: Date.now(),
      cursor,
    };

    // Attach to the active session or create one if none exists
    this.loadFromDisk();
    let targetSession = input.sessionId ? this.sessions.get(input.sessionId) : this.getPendingReview();
    if (!targetSession) {
      const id = input.sessionId || `session_${Date.now().toString(36)}`;
      targetSession = {
        id,
        timestamp: Date.now(),
        route: '/',
        status: this.reviewMode === 'live' ? 'submitted' : 'draft',
        reviewMode: this.reviewMode,
        mutations: [],
        annotations: [],
        voiceReviews: [],
        variantDecisions: [decision],
      };
    } else {
      if (!targetSession.variantDecisions) targetSession.variantDecisions = [];
      targetSession.variantDecisions = targetSession.variantDecisions.filter((d) => d.setId !== set.id);
      targetSession.variantDecisions.push(decision);
    }

    this.saveBatch(targetSession, { forceSubmit: this.reviewMode === 'live' });
    this.notify('DECIDE_VARIANT', targetSession.id, { set, decision });
    return decision;
  }

  public revertVariantDecision(setId: string, sessionId?: string): boolean {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(setId);
    if (!set) return false;

    set.selectedVariantId = undefined;
    set.status = 'pending';
    this.saveVariantsToDisk();

    this.loadFromDisk();
    let targetSession = sessionId ? this.sessions.get(sessionId) : this.getPendingReview();
    if (targetSession && targetSession.variantDecisions) {
      targetSession.variantDecisions = targetSession.variantDecisions.filter((d) => d.setId !== setId);
      this.saveBatch(targetSession, { forceSubmit: this.reviewMode === 'live' });
    }

    this.notify('PROPOSE_VARIANTS', set.id, set);
    this.notify('SYNC_VARIANTS', 'global', this.getVariantSets());
    return true;
  }

  public deleteVariantSet(setId: string, sessionId?: string): boolean {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(setId);
    if (set) {
      set.status = 'superseded';
      set.selectedVariantId = undefined;
      this.saveVariantsToDisk();
      this.notify('SUPERSEDE_VARIANTS', setId, set);
    }

    this.loadFromDisk();
    let targetSession = sessionId ? this.sessions.get(sessionId) : this.getPendingReview();
    if (targetSession && targetSession.variantDecisions) {
      targetSession.variantDecisions = targetSession.variantDecisions.filter((d) => d.setId !== setId);
      this.saveBatch(targetSession, { forceSubmit: this.reviewMode === 'live' });
    }

    this.notify('SYNC_VARIANTS', 'global', this.getVariantSets());
    return true;
  }

  // ============================================================================
  // Lifecycle Hooks & Long-Poll Engine
  // ============================================================================

  public isBackgroundWaiterConnected(): boolean {
    const hasActiveWaiter = Array.from(this.hookWaiters).some(
      (w) => w.source === 'background_waiter'
    );
    if (hasActiveWaiter) return true;
    return Date.now() - this.lastBackgroundWaiterPollAt < 5000;
  }

  public getHookLeaseStatus(): HookLeaseStatus {
    const now = Date.now();
    if (this.hookLease && this.hookLease.expiresAt <= now) {
      this.hookLease = null;
    }
    const waiterConnected = this.isBackgroundWaiterConnected();
    return {
      connected: Boolean(this.hookLease) || waiterConnected,
      harness: this.hookLease?.harness,
      sessionId: this.hookLease?.sessionId,
      agentState: this.hookLease?.agentState || (waiterConnected ? 'listening' : 'idle'),
      seenCursor: this.hookLease?.seenCursor || 0,
      latestCursor: this.currentCursor,
      expiresAt: this.hookLease?.expiresAt,
      reviewMode: this.reviewMode,
      waiterConnected,
    };
  }

  public notifyAgentStatus(): void {
    const status = this.getHookLeaseStatus();
    this.notify('AGENT_STATUS', 'global', status);
  }

  public registerHookEvent(input: {
    harness: string;
    sessionId: string;
    event: 'PostToolUse' | 'Stop' | 'SessionEnd' | 'Interrupt' | 'PreInvocation' | 'Wait';
    seenCursor?: number;
  }): HookLeaseStatus {
    const now = Date.now();

    if (input.event === 'SessionEnd' || input.event === 'Interrupt') {
      if (!this.hookLease || this.hookLease.sessionId === input.sessionId) {
        this.hookLease = null;
        this.lastBackgroundWaiterPollAt = 0;
        this.endAllHookWaiters(true);
        this.notifyAgentStatus();
      }
      return this.getHookLeaseStatus();
    }

    const prevSeen = this.hookLease?.seenCursor || 0;
    const seenCursor =
      typeof input.seenCursor === 'number'
        ? Math.max(prevSeen, input.seenCursor)
        : prevSeen;

    if (input.event === 'Wait') {
      this.lastBackgroundWaiterPollAt = now;
      const effectiveSessionId =
        this.hookLease?.sessionId && this.hookLease.sessionId !== 'waiter' && this.hookLease.sessionId !== 'default'
          ? this.hookLease.sessionId
          : input.sessionId || 'waiter';
      this.hookLease = {
        harness: this.hookLease?.harness || input.harness || 'antigravity',
        sessionId: effectiveSessionId,
        agentState: 'listening',
        seenCursor,
        expiresAt: now + LEASE_TTL_MS,
      };
      this.notifyAgentStatus();
      return this.getHookLeaseStatus();
    }

    // Strict Session Affinity & Binding (artifact-studio model):
    // 1. Only PostToolUse (or Wait) can create a new lease. Stop / PreInvocation must NEVER claim an unbound lease.
    // 2. If an active lease is owned by another session, Stop / PreInvocation from a different session must not hijack it.
    if (input.event === 'Stop' || input.event === 'PreInvocation') {
      if (!this.hookLease || this.hookLease.expiresAt <= now) {
        return this.getHookLeaseStatus();
      }
      const currentOwner = this.hookLease.sessionId;
      const isWildcardOwner = !currentOwner || currentOwner === 'default' || currentOwner === 'waiter';
      if (!isWildcardOwner && currentOwner !== input.sessionId) {
        return this.getHookLeaseStatus();
      }
      this.hookLease = {
        harness: this.hookLease.harness || input.harness,
        sessionId: isWildcardOwner && input.sessionId ? input.sessionId : currentOwner,
        agentState: input.event === 'Stop' ? 'listening' : 'implementing',
        seenCursor,
        expiresAt: now + LEASE_TTL_MS,
      };
      this.notifyAgentStatus();
      return this.getHookLeaseStatus();
    }

    // PostToolUse: explicitly binds the lease to this harness & sessionId
    this.hookLease = {
      harness: input.harness,
      sessionId: input.sessionId,
      agentState: 'implementing',
      seenCursor,
      expiresAt: now + LEASE_TTL_MS,
    };

    this.notifyAgentStatus();
    return this.getHookLeaseStatus();
  }

  public endLiveReview(): void {
    this.hookLease = null;
    this.lastBackgroundWaiterPollAt = 0;
    this.endAllHookWaiters(true);
    this.notifyAgentStatus();
  }

  private wakeHookWaiters(): void {
    if (this.hookWaiters.size === 0) return;

    for (const waiter of Array.from(this.hookWaiters)) {
      const candidate = this.getSubmittedPendingReview({ afterCursor: waiter.afterCursor });
      if (candidate) {
        clearTimeout(waiter.timer);
        this.hookWaiters.delete(waiter);
        if (this.hookLease) {
          this.hookLease.seenCursor = candidate.latestCursor || this.currentCursor;
          this.hookLease.agentState = 'implementing';
          this.notifyAgentStatus();
        }
        waiter.resolve({
          batch: candidate,
          cursor: candidate.latestCursor || this.currentCursor,
          timedOut: false,
          ended: false,
        });
      }
    }
  }

  private endAllHookWaiters(ended: boolean): void {
    for (const waiter of Array.from(this.hookWaiters)) {
      clearTimeout(waiter.timer);
      this.hookWaiters.delete(waiter);
      waiter.resolve({
        batch: null,
        cursor: this.currentCursor,
        timedOut: false,
        ended,
      });
    }
  }

  public waitForFeedback(options?: {
    afterCursor?: number;
    timeoutMs?: number;
    waiterId?: string;
    source?: 'stop_hook' | 'background_waiter';
  }): Promise<{
    batch: VisualEditBatch | null;
    cursor: number;
    timedOut: boolean;
    ended: boolean;
    superseded?: boolean;
  }> {
    const afterCursor = options?.afterCursor ?? (this.hookLease?.seenCursor || 0);
    const timeoutMs = Math.max(100, Math.min(options?.timeoutMs ?? 25000, 60000));

    if (options?.source === 'background_waiter') {
      this.lastBackgroundWaiterPollAt = Date.now();
      if (options.waiterId) {
        for (const existing of Array.from(this.hookWaiters)) {
          if (
            existing.source === 'background_waiter' &&
            existing.waiterId &&
            existing.waiterId !== options.waiterId
          ) {
            clearTimeout(existing.timer);
            this.hookWaiters.delete(existing);
            existing.resolve({
              batch: null,
              cursor: this.currentCursor,
              timedOut: false,
              ended: true,
              superseded: true,
            });
          }
        }
      }
    }

    // Check immediately before queuing waiter
    const immediate = this.getSubmittedPendingReview({ afterCursor });
    if (immediate) {
      if (this.hookLease) {
        this.hookLease.seenCursor = immediate.latestCursor || this.currentCursor;
        this.hookLease.agentState = 'implementing';
        this.notifyAgentStatus();
      }
      return Promise.resolve({
        batch: immediate,
        cursor: immediate.latestCursor || this.currentCursor,
        timedOut: false,
        ended: false,
      });
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.hookWaiters.delete(waiter);
        if (options?.source === 'background_waiter') {
          this.lastBackgroundWaiterPollAt = Date.now();
        }
        resolve({
          batch: null,
          cursor: this.currentCursor,
          timedOut: true,
          ended: options?.source === 'background_waiter' ? false : !this.hookLease,
        });
      }, timeoutMs);

      const waiter: HookWaiter = {
        afterCursor,
        waiterId: options?.waiterId,
        source: options?.source,
        resolve,
        timer,
      };

      this.hookWaiters.add(waiter);
    });
  }
}
