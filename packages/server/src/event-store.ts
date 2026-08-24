import fs from 'node:fs';
import path from 'node:path';
import { VisualEditBatch, SessionStatus, SessionSummary, AgentReply } from '@visual-edit/core';

interface SubmissionWaiter {
  sessionId?: string;
  resolve: (batch: VisualEditBatch) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class EventStore {
  private static instance: EventStore;
  private rootDir: string;
  private filePath: string;
  private sessions = new Map<string, VisualEditBatch>();
  private listeners = new Set<(event: { type: string; sessionId: string; payload: any }) => void>();
  private waiters = new Set<SubmissionWaiter>();

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    const dataDir = path.join(this.rootDir, '.visual-edit');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'sessions.jsonl');
    this.ensureGitignored(this.rootDir);
    this.loadFromDisk();
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
    } catch (e) {
      // Ignore write errors to .gitignore
    }
  }

  public static getInstance(rootDir?: string): EventStore {
    const resolvedRoot = rootDir ? path.resolve(rootDir) : process.cwd();
    if (!EventStore.instance || (rootDir && EventStore.instance.rootDir !== resolvedRoot)) {
      EventStore.instance = new EventStore(resolvedRoot);
    }
    return EventStore.instance;
  }

  public hasActiveWaiters(): boolean {
    return this.waiters.size > 0;
  }

  public loadFromDisk(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        const batch: VisualEditBatch = JSON.parse(line);
        this.sessions.set(batch.id, batch);
      }
    } catch (err) {
      console.error('[visual-edit] Failed to load sessions from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const lines = Array.from(this.sessions.values()).map((b) => JSON.stringify(b));
      fs.writeFileSync(this.filePath, lines.join('\n') + '\n', 'utf-8');
    } catch (err) {
      console.error('[visual-edit] Failed to save sessions to disk:', err);
    }
  }

  public subscribe(fn: (event: { type: string; sessionId: string; payload: any }) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public notify(type: string, sessionId: string, payload: any): void {
    this.listeners.forEach((fn) => fn({ type, sessionId, payload }));
  }

  public saveBatch(batch: VisualEditBatch): void {
    this.sessions.set(batch.id, batch);
    this.saveToDisk();
    this.notify('SAVE_BATCH', batch.id, batch);

    // If batch is submitted or has active edits/pins, check any awaiting agents
    if (batch.status === 'submitted' || (batch.mutations && batch.mutations.length > 0) || (batch.annotations && batch.annotations.length > 0)) {
      this.resolveWaiters(batch);
    }
  }

  private resolveWaiters(batch: VisualEditBatch): void {
    for (const waiter of Array.from(this.waiters)) {
      if (!waiter.sessionId || waiter.sessionId === batch.id) {
        clearTimeout(waiter.timer);
        this.waiters.delete(waiter);
        waiter.resolve(batch);
      }
    }
    if (this.waiters.size === 0) {
      this.notify('AGENT_LISTENING', '', { listening: false });
    }
  }

  public waitForSubmission(sessionId?: string, timeoutMs: number = 300000): Promise<VisualEditBatch> {
    const startTime = Date.now();
    this.loadFromDisk();

    // If explicit sessionId is requested, check if it is already submitted and not claimed
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing && existing.status === 'submitted' && !existing.claim) {
        return Promise.resolve(existing);
      }
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      const checkDisk = () => {
        if (resolved) return;
        this.loadFromDisk();
        for (const s of this.sessions.values()) {
          if (s.status === 'submitted' && (!sessionId || s.id === sessionId) && s.timestamp > startTime && !s.claim) {
            cleanup();
            resolved = true;
            resolve(s);
            return;
          }
        }
      };

      // Poll disk file every 250ms for cross-process IPC synchronization
      const pollTimer = setInterval(checkDisk, 250);

      let fileWatcher: fs.FSWatcher | null = null;
      try {
        if (fs.existsSync(this.filePath)) {
          fileWatcher = fs.watch(this.filePath, checkDisk);
        }
      } catch (e) {}

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for visual edit review submission (${Math.round(timeoutMs / 1000)}s)`));
      }, timeoutMs);

      const cleanup = () => {
        clearInterval(pollTimer);
        clearTimeout(timer);
        if (fileWatcher) {
          try {
            fileWatcher.close();
          } catch (e) {}
        }
        this.waiters.delete(waiter);
        if (this.waiters.size === 0) {
          this.notify('AGENT_LISTENING', '', { listening: false });
        }
      };

      const waiter: SubmissionWaiter = {
        sessionId,
        resolve: (b) => {
          cleanup();
          resolved = true;
          resolve(b);
        },
        reject: (err) => {
          cleanup();
          reject(err);
        },
        timer,
      };

      this.waiters.add(waiter);
      this.notify('AGENT_LISTENING', '', { listening: true });
    });
  }

  public getSession(id: string): VisualEditBatch | undefined {
    this.loadFromDisk();
    return this.sessions.get(id);
  }

  public listSessions(): SessionSummary[] {
    this.loadFromDisk();
    const now = Date.now();
    return Array.from(this.sessions.values()).map((b) => {
      const hasClaim = !!(b.claim && b.claim.expiresAt > now);
      const primaryTarget = b.primarySource?.fileName
        ? `${b.primarySource.fileName}:${b.primarySource.lineNumber || 1}`
        : b.primarySource?.selector || b.mutations[0]?.targetSelector;

      return {
        id: b.id,
        timestamp: b.timestamp,
        route: b.route,
        status: b.status,
        mutationCount: b.mutations.length,
        annotationCount: b.annotations?.length || 0,
        userPrompt: b.userPrompt,
        primaryTarget,
        hasClaim,
      };
    });
  }

  public claimSession(
    sessionId: string,
    agentId: string,
    durationMs: number = 30 * 60 * 1000
  ): { success: boolean; error?: string } {
    this.loadFromDisk();
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: `Session ${sessionId} not found` };

    const now = Date.now();
    if (session.claim && session.claim.expiresAt > now && session.claim.agentId !== agentId) {
      return {
        success: false,
        error: `Session already claimed by another agent (${session.claim.agentId})`,
      };
    }

    session.claim = {
      agentId,
      leasedAt: now,
      expiresAt: now + durationMs,
    };
    session.status = 'in_progress';
    this.saveToDisk();
    this.notify('STATUS_CHANGE', sessionId, { status: 'in_progress' });
    return { success: true };
  }

  public releaseSession(sessionId: string, agentId: string): boolean {
    this.loadFromDisk();
    const session = this.sessions.get(sessionId);
    if (!session || !session.claim) return false;

    if (session.claim.agentId === agentId) {
      delete session.claim;
      this.saveToDisk();
      this.notify('STATUS_CHANGE', sessionId, { status: 'draft' });
      return true;
    }
    return false;
  }

  public updateStatus(
    sessionId: string,
    status: SessionStatus,
    reply?: { agentId: string; message: string }
  ): boolean {
    this.loadFromDisk();
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = status;
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

    this.saveToDisk();
    this.notify('STATUS_CHANGE', sessionId, { status, replies: session.replies });
    return true;
  }

  public getPendingReview(): VisualEditBatch | null {
    this.loadFromDisk();
    const sessions = Array.from(this.sessions.values()).reverse();

    // 1. Look for submitted or in-progress sessions with active edits or comments
    for (const session of sessions) {
      if (
        (session.status === 'submitted' || session.status === 'in_progress') &&
        ((session.annotations && session.annotations.length > 0) || (session.mutations && session.mutations.length > 0))
      ) {
        return session;
      }
    }

    // 2. Look for active draft sessions with edits or annotations
    for (const session of sessions) {
      if (
        session.status === 'draft' &&
        ((session.annotations && session.annotations.length > 0) || (session.mutations && session.mutations.length > 0))
      ) {
        return session;
      }
    }

    // 3. Return latest session or null
    return sessions[0] || null;
  }

  public markPendingSessionsImplemented(): void {
    this.loadFromDisk();
    let changed = false;
    for (const session of this.sessions.values()) {
      if (
        session.status === 'submitted' ||
        session.status === 'in_progress' ||
        (session.status === 'draft' && ((session.annotations && session.annotations.length > 0) || (session.mutations && session.mutations.length > 0)))
      ) {
        session.status = 'implemented';
        changed = true;
        this.notify('STATUS_CHANGE', session.id, { status: 'implemented', replies: session.replies || [] });
      }
    }
    if (changed) {
      this.saveToDisk();
    }
  }
}
