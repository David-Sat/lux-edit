import {
  VisualEditBatch,
  HookLeaseStatus,
  ReviewMode,
} from '@visual-edit/core';

export interface HookWaiter {
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

export const LEASE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface LeaseManagerContext {
  getReviewMode: () => ReviewMode;
  getCurrentCursor: () => number;
  getSubmittedPendingReview: (options?: { afterCursor?: number }) => VisualEditBatch | null;
  notify: (type: string, id: string, payload: any) => void;
}

export class LeaseManager {
  private hookWaiters = new Set<HookWaiter>();
  private lastBackgroundWaiterPollAt = 0;
  private hookLease: {
    harness?: string;
    sessionId?: string;
    agentState: 'idle' | 'listening' | 'implementing';
    seenCursor: number;
    expiresAt: number;
  } | null = null;
  private ctx: LeaseManagerContext;

  constructor(ctx: LeaseManagerContext) {
    this.ctx = ctx;
  }

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
      latestCursor: this.ctx.getCurrentCursor(),
      expiresAt: this.hookLease?.expiresAt,
      reviewMode: this.ctx.getReviewMode(),
      waiterConnected,
    };
  }

  public notifyAgentStatus(): void {
    const status = this.getHookLeaseStatus();
    this.ctx.notify('AGENT_STATUS', 'global', status);
  }

  public getHarness(): string | undefined {
    return this.hookLease?.harness;
  }

  public setAgentState(state: 'idle' | 'listening' | 'implementing'): void {
    if (this.hookLease) {
      this.hookLease.agentState = state;
    }
  }

  public getAgentState(): 'idle' | 'listening' | 'implementing' | undefined {
    return this.hookLease?.agentState;
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

    // Strict Session Affinity & Binding:
    // Only PostToolUse (or Wait) can create a new lease. Stop / PreInvocation must NEVER claim an unbound lease.
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

  public wakeHookWaiters(): void {
    if (this.hookWaiters.size === 0) return;

    for (const waiter of Array.from(this.hookWaiters)) {
      const candidate = this.ctx.getSubmittedPendingReview({ afterCursor: waiter.afterCursor });
      if (candidate) {
        clearTimeout(waiter.timer);
        this.hookWaiters.delete(waiter);
        if (this.hookLease) {
          this.hookLease.seenCursor = candidate.latestCursor || this.ctx.getCurrentCursor();
          this.hookLease.agentState = 'implementing';
          this.notifyAgentStatus();
        }
        waiter.resolve({
          batch: candidate,
          cursor: candidate.latestCursor || this.ctx.getCurrentCursor(),
          timedOut: false,
          ended: false,
        });
      }
    }
  }

  public endAllHookWaiters(ended: boolean): void {
    for (const waiter of Array.from(this.hookWaiters)) {
      clearTimeout(waiter.timer);
      this.hookWaiters.delete(waiter);
      waiter.resolve({
        batch: null,
        cursor: this.ctx.getCurrentCursor(),
        timedOut: false,
        ended,
      });
    }
  }

  public clearWaiters(): void {
    this.endAllHookWaiters(true);
  }

  public onSessionImplemented(): void {
    if (this.hookLease && this.hookLease.agentState === 'implementing') {
      this.hookLease.agentState = 'listening';
      this.notifyAgentStatus();
    }
  }

  public updateSeenCursor(cursor: number): void {
    if (this.hookLease) {
      this.hookLease.seenCursor = Math.max(this.hookLease.seenCursor || 0, cursor);
      this.hookLease.agentState = 'listening';
      this.notifyAgentStatus();
    }
  }

  public getRawLease(): { harness?: string; sessionId?: string; agentState: 'idle' | 'listening' | 'implementing'; seenCursor: number; expiresAt: number } | null {
    return this.hookLease;
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
    const afterCursor = typeof options?.afterCursor === 'number' && Number.isFinite(options.afterCursor)
      ? Math.max(0, Math.floor(options.afterCursor))
      : (this.hookLease?.seenCursor || 0);
    const rawTimeout = typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
      ? Math.floor(options.timeoutMs)
      : 25000;
    const clampedTimeout = rawTimeout < 100 ? 100 : rawTimeout > 60000 ? 60000 : rawTimeout;
    const timeoutMs = clampedTimeout >= 100 && clampedTimeout <= 60000 ? clampedTimeout : 25000;

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
              cursor: this.ctx.getCurrentCursor(),
              timedOut: false,
              ended: true,
              superseded: true,
            });
          }
        }
      }
    }

    // Check immediately before queuing waiter
    const immediate = this.ctx.getSubmittedPendingReview({ afterCursor });
    if (immediate) {
      if (this.hookLease) {
        this.hookLease.seenCursor = immediate.latestCursor || this.ctx.getCurrentCursor();
        this.hookLease.agentState = 'implementing';
        this.notifyAgentStatus();
      }
      return Promise.resolve({
        batch: immediate,
        cursor: immediate.latestCursor || this.ctx.getCurrentCursor(),
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
          cursor: this.ctx.getCurrentCursor(),
          timedOut: true,
          ended: options?.source === 'background_waiter' ? false : !this.hookLease,
        });
      }, timeoutMs <= 60000 ? timeoutMs : 60000);

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
