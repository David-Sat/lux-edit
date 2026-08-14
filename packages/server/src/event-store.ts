import fs from 'node:fs';
import path from 'node:path';
import { VisualEditBatch, SessionStatus, SessionSummary, AgentReply } from '@visual-edit/core';

export class EventStore {
  private static instance: EventStore;
  private filePath: string;
  private sessions = new Map<string, VisualEditBatch>();

  constructor(rootDir: string = process.cwd()) {
    const dataDir = path.join(rootDir, '.visual-edit');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'sessions.jsonl');
    this.loadFromDisk();
  }

  public static getInstance(rootDir?: string): EventStore {
    if (!EventStore.instance) {
      EventStore.instance = new EventStore(rootDir);
    }
    return EventStore.instance;
  }

  private loadFromDisk(): void {
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
      const lines = Array.from(this.sessions.values()).map((b) => JSON.stringify(b));
      fs.writeFileSync(this.filePath, lines.join('\n') + '\n', 'utf-8');
    } catch (err) {
      console.error('[visual-edit] Failed to save sessions to disk:', err);
    }
  }

  public saveBatch(batch: VisualEditBatch): void {
    this.sessions.set(batch.id, batch);
    this.saveToDisk();
  }

  public getSession(id: string): VisualEditBatch | undefined {
    return this.sessions.get(id);
  }

  public listSessions(): SessionSummary[] {
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
    return { success: true };
  }

  public releaseSession(sessionId: string, agentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.claim) return false;

    if (session.claim.agentId === agentId) {
      delete session.claim;
      this.saveToDisk();
      return true;
    }
    return false;
  }

  private listeners = new Set<(event: { type: string; sessionId: string; payload: any }) => void>();

  public subscribe(fn: (event: { type: string; sessionId: string; payload: any }) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(type: string, sessionId: string, payload: any): void {
    this.listeners.forEach((fn) => fn({ type, sessionId, payload }));
  }

  public updateStatus(
    sessionId: string,
    status: SessionStatus,
    reply?: { agentId: string; message: string }
  ): boolean {
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
}
