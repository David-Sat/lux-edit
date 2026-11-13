import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventStore } from '../event-store.js';

describe('EventStore: Cursors, Live/Batch Mode, Variants, Hooks, and Stale Guards', () => {
  let testDir: string;
  let store: EventStore;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `lux-eventstore-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });
    store = EventStore.getInstance(testDir);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('assigns monotonic cursors and filters getPendingReview by afterCursor and reviewMode', () => {
    store.setReviewMode('batch');
    expect(store.getReviewMode()).toBe('batch');

    // In batch mode, a draft is not returned by getPendingReview
    store.saveBatch({
      id: 'b_draft',
      timestamp: Date.now(),
      route: '/',
      status: 'draft',
      mutations: [{ id: 'm1', type: 'TEXT_EDIT', targetSelector: 'h1', before: 'A', after: 'B' }],
    });
    const draft = store.getSession('b_draft')!;
    expect(draft.latestCursor).toBeGreaterThan(0);
    expect(store.getSubmittedPendingReview({ afterCursor: 0 })).toBeNull();

    // Once submitted, getPendingReview returns it
    store.saveBatch({
      ...draft,
      status: 'submitted',
    });
    const submitted = store.getSession('b_draft')!;
    expect(store.getSubmittedPendingReview({ afterCursor: 0 })?.id).toBe('b_draft');
    expect(store.getSubmittedPendingReview({ afterCursor: submitted.latestCursor! })).toBeNull();

    // In live mode, even draft status is returned when it has content and newer cursor
    store.setReviewMode('live');
    store.saveBatch({
      id: 'b_live',
      timestamp: Date.now(),
      route: '/',
      status: 'draft',
      mutations: [],
      annotations: [{ id: 'a1', timestamp: Date.now(), type: 'element', comment: 'Live pin' }],
    });
    expect(store.getSubmittedPendingReview({ afterCursor: submitted.latestCursor! })?.id).toBe('b_live');
  });

  it('wakes up waitForFeedback long-poll waiters when new feedback arrives', async () => {
    store.setReviewMode('live');
    const initialCursor = store.getLatestCursor();

    const waitPromise = store.waitForFeedback({ afterCursor: initialCursor, timeoutMs: 5000 });

    setTimeout(() => {
      store.saveBatch({
        id: 'b_wake',
        timestamp: Date.now(),
        route: '/',
        status: 'submitted',
        mutations: [],
        annotations: [{ id: 'a_wake', timestamp: Date.now(), type: 'element', comment: 'Wake up agent!' }],
      });
    }, 30);

    const result = await waitPromise;
    expect(result.batch).toBeDefined();
    expect(result.batch?.id).toBe('b_wake');
    expect(result.cursor).toBeGreaterThan(initialCursor);
  });

  it('manages component variant sets and records user variant decisions', () => {
    const vSet = store.proposeVariants({
      targetSelector: '.hero-btn',
      variants: [
        { id: 'v1', name: 'Solid Indigo', rationale: 'Solid color', styles: { 'background-color': '#4f46e5' } },
        { id: 'v2', name: 'Outline Glass', rationale: 'Glassmorphic', styles: { border: '1px solid #fff' } },
      ],
    });

    expect(vSet.id).toContain('varset_');
    expect(store.getVariantSets()).toHaveLength(1);

    const decision = store.recordVariantDecision({
      setId: vSet.id,
      selectedVariantId: 'v2',
      userNote: 'Love the blur effect',
    });

    expect(decision).toBeDefined();
    expect(decision?.selectedVariantId).toBe('v2');
    expect(store.getVariantSets()[0].selectedVariantId).toBe('v2');
    expect(store.getVariantSets()[0].status).toBe('decided');
  });

  it('tracks hook lease status and detects expectedHash stale conflicts on updateStatus', () => {
    const lease = store.registerHookEvent({
      harness: 'antigravity',
      event: 'PostToolUse',
      sessionId: 'conv_123',
      seenCursor: 0,
    });
    expect(lease.connected).toBe(true);
    expect(lease.harness).toBe('antigravity');

    store.saveBatch({
      id: 'b_hash_test',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      mutations: [{ id: 'm1', type: 'TEXT_EDIT', targetSelector: 'h1', before: 'Old', after: 'New' }],
    });
    const saved = store.getSession('b_hash_test')!;

    // Passing a mismatched expectedHash should return staleConflict: true
    const conflictRes = store.updateStatus('b_hash_test', 'implemented', undefined, {
      expectedHash: '00000000deadbeef',
    });
    expect(conflictRes.staleConflict).toBe(true);
    expect(store.getSession('b_hash_test')?.status).toBe('submitted');

    // Passing matching expectedHash succeeds and extracts verificationTargets
    const okRes = store.updateStatus('b_hash_test', 'implemented', undefined, {
      expectedHash: saved.revisionHash,
      modifiedSelectors: ['h1', '.extra-selector'],
    });
    expect(okRes.staleConflict).toBeFalsy();
    expect(okRes.updated).toBe(true);
    expect(store.getSession('b_hash_test')?.status).toBe('implemented');
    expect(okRes.verificationTargets?.map((t) => t.selector)).toContain('h1');
    expect(okRes.verificationTargets?.map((t) => t.selector)).toContain('.extra-selector');

    // End live review
    store.endLiveReview();
    const leaseStatus = store.getHookLeaseStatus();
    expect(leaseStatus.connected).toBe(false);
  });

  it('enforces strict session affinity so unrelated sessions cannot hijack the lease on Stop', () => {
    // Session A claims the lease via PostToolUse
    const leaseA = store.registerHookEvent({
      harness: 'antigravity',
      event: 'PostToolUse',
      sessionId: 'agent_session_A',
      seenCursor: 1,
    });
    expect(leaseA.connected).toBe(true);
    expect(leaseA.sessionId).toBe('agent_session_A');

    // Unrelated Session B finishes a turn and fires Stop
    const leaseB = store.registerHookEvent({
      harness: 'antigravity',
      event: 'Stop',
      sessionId: 'agent_session_B',
      seenCursor: 1,
    });

    // Session A's lease must remain intact and must NOT be hijacked by Session B
    expect(leaseB.sessionId).toBe('agent_session_A');
    expect(store.getHookLeaseStatus().sessionId).toBe('agent_session_A');

    // When Session A fires Stop, its own lease updates normally
    const leaseAStop = store.registerHookEvent({
      harness: 'antigravity',
      event: 'Stop',
      sessionId: 'agent_session_A',
      seenCursor: 2,
    });
    expect(leaseAStop.sessionId).toBe('agent_session_A');
    expect(leaseAStop.seenCursor).toBe(2);
  });

  it('auto-promotes drafted batch changes and wakes waiters when toggling from batch to live mode', async () => {
    store.setReviewMode('batch');
    store.saveBatch({
      id: 'b_toggle_live',
      timestamp: Date.now(),
      route: '/',
      status: 'draft',
      mutations: [{ id: 'm_toggle', type: 'TEXT_EDIT', targetSelector: '.title', before: 'Draft', after: 'Live' }],
    });

    const beforeCursor = store.getLatestCursor();
    expect(store.getSubmittedPendingReview({ afterCursor: 0 })).toBeNull();

    const waitPromise = store.waitForFeedback({ afterCursor: beforeCursor, timeoutMs: 2000 });

    setTimeout(() => {
      store.setReviewMode('live');
    }, 20);

    const woken = await waitPromise;
    expect(woken.batch?.id).toBe('b_toggle_live');
    expect(woken.batch?.status).toBe('submitted');
    expect(woken.cursor).toBeGreaterThan(beforeCursor);
  });

  it('supersedes older background waiters when a newer background waiter connects', async () => {
    const cursor = store.getLatestCursor();
    const waiter1Promise = store.waitForFeedback({
      afterCursor: cursor,
      timeoutMs: 5000,
      waiterId: 'waiter_1',
      source: 'background_waiter',
    });

    setTimeout(() => {
      void store.waitForFeedback({
        afterCursor: cursor,
        timeoutMs: 100,
        waiterId: 'waiter_2',
        source: 'background_waiter',
      });
    }, 20);

    const res1 = await waiter1Promise;
    expect(res1.superseded).toBe(true);
    expect(res1.batch).toBeNull();
  });
});
