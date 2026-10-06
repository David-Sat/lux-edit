import fs from 'node:fs';
import path from 'node:path';
import {
  VisualEditBatch,
  SessionStatus,
  SessionSummary,
  AgentReply,
  SERVER_METADATA_DIR,
} from '@visual-edit/core';

export interface GetPendingReviewOptions {
  port?: number;
  serverUrl?: string;
  appId?: string;
  activeSessionIds?: string[];
  maxAgeMs?: number; // Defaults to 7 days (168h)
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

export class EventStore {
  private static instance: EventStore;
  private rootDir: string;
  private filePath: string;
  private sessions = new Map<string, VisualEditBatch>();
  private listeners = new Set<(event: { type: string; sessionId: string; payload: any }) => void>();

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    const dataDir = path.join(this.rootDir, SERVER_METADATA_DIR);
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

  public hasSessionContent(batch: VisualEditBatch): boolean {
    return Boolean(
      (batch.mutations && batch.mutations.length > 0) ||
      (batch.annotations && batch.annotations.length > 0) ||
      (batch.voiceReviews && batch.voiceReviews.length > 0) ||
      (batch.userPrompt && batch.userPrompt.trim().length > 0)
    );
  }

  private pruneOldSessions(): void {
    const STALE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    // 1. Purge any stale sessions older than 7 days from disk
    for (const [id, s] of this.sessions.entries()) {
      if (now - s.timestamp > STALE_TTL) {
        this.sessions.delete(id);
      }
    }

    const MAX_SESSIONS = 50;
    if (this.sessions.size <= MAX_SESSIONS) return;

    // First prune oldest implemented or resolved sessions
    const sorted = Array.from(this.sessions.values()).sort((a, b) => a.timestamp - b.timestamp);
    for (const s of sorted) {
      if (this.sessions.size <= MAX_SESSIONS) break;
      if (s.status === 'implemented' || s.status === 'resolved') {
        this.sessions.delete(s.id);
      }
    }

    // If still over MAX_SESSIONS, prune oldest non-active sessions
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
      for (const line of lines) {
        const batch: VisualEditBatch = JSON.parse(line);
        // Filter out empty sessions with no mutations, annotations, voice reviews, or prompts
        if (!this.hasSessionContent(batch)) {
          prunedAny = true;
          continue;
        }
        this.sessions.set(batch.id, batch);
      }
      const initialSize = this.sessions.size;
      this.pruneOldSessions();
      if (prunedAny || this.sessions.size < initialSize) {
        this.saveToDisk();
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
      const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, this.filePath);
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
    const hasContent = this.hasSessionContent(batch);

    // If an empty session is sent, do not store it on disk.
    // If it was previously stored, clean it up.
    if (!hasContent) {
      if (this.sessions.has(batch.id)) {
        this.sessions.delete(batch.id);
        this.saveToDisk();
        this.notify('SAVE_BATCH', batch.id, batch);
      }
      return;
    }

    this.sessions.set(batch.id, batch);
    this.pruneOldSessions();
    this.saveToDisk();
    this.notify('SAVE_BATCH', batch.id, batch);
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
        : b.primarySource?.selector || b.mutations[0]?.targetSelector;

      return {
        id: b.id,
        timestamp: b.timestamp,
        route: b.route,
        status: b.status,
        mutationCount: b.mutations.length,
        annotationCount: b.annotations?.length || 0,
        voiceReviewCount: b.voiceReviews?.length || 0,
        userPrompt: b.userPrompt,
        primaryTarget,
        hasClaim: false,
      };
    });
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

  public getPendingReview(options?: GetPendingReviewOptions): VisualEditBatch | null {
    this.loadFromDisk();
    // 7 days default TTL
    const maxAge = options?.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const sessions = Array.from(this.sessions.values()).sort((a, b) => b.timestamp - a.timestamp);

    const isCandidate = (s: VisualEditBatch): boolean => {
      if (s.status === 'implemented' || s.status === 'resolved') return false;
      if (now - s.timestamp > maxAge) return false;
      if (options?.appId && s.appId && s.appId !== options.appId) return false;
      if (!sessionMatchesTarget(s.url, options?.port, options?.serverUrl)) return false;
      return this.hasSessionContent(s);
    };

    // 1. If activeSessionIds are provided (live connected WebSocket tabs on this server), prioritize them
    if (options?.activeSessionIds && options.activeSessionIds.length > 0) {
      const activeSet = new Set(options.activeSessionIds);
      for (const s of sessions) {
        if (activeSet.has(s.id) && isCandidate(s)) {
          return s;
        }
      }
    }

    // 2. Return latest matching candidate session
    for (const s of sessions) {
      if (isCandidate(s)) {
        return s;
      }
    }

    return null;
  }

  public markPendingSessionsImplemented(options?: { port?: number; serverUrl?: string; sessionId?: string; appId?: string }): void {
    this.loadFromDisk();
    let changed = false;
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
          session.status = 'implemented';
          changed = true;
          this.notify('STATUS_CHANGE', session.id, { status: 'implemented', replies: session.replies || [] });
        }
      }
    }
    if (changed) {
      this.pruneOldSessions();
      this.saveToDisk();
    }
  }
}
