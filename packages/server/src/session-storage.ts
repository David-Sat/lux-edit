import fs from 'node:fs';
import path from 'node:path';
import {
  VisualEditBatch,
  ReviewMode,
  VerificationTarget,
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
      if (!parsed.port && ((parsed.protocol === 'http:' && port === 80) || (parsed.protocol === 'https:' && port === 443))) {
        return true;
      }
      return false;
    }
    if (serverUrl) {
      const targetParsed = new URL(serverUrl);
      return parsed.host === targetParsed.host;
    }
  } catch {
    if (port && sessionUrl.includes(`:${port}`)) return true;
    if (serverUrl && sessionUrl.startsWith(serverUrl)) return true;
  }
  return false;
}

export function hasSessionContent(batch: VisualEditBatch): boolean {
  return Boolean(
    (batch.mutations && batch.mutations.length > 0) ||
      (batch.annotations && batch.annotations.length > 0) ||
      (batch.voiceReviews && batch.voiceReviews.length > 0) ||
      (batch.variantDecisions && batch.variantDecisions.length > 0) ||
      (batch.userPrompt && batch.userPrompt.trim().length > 0)
  );
}

export function extractVerificationTargetsFromSession(
  session: VisualEditBatch,
  extraSelectors?: string[]
): VerificationTarget[] {
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

export function pruneSessionsMap(sessions: Map<string, VisualEditBatch>): void {
  const STALE_TTL = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const [id, s] of sessions.entries()) {
    if (now - s.timestamp > STALE_TTL) {
      sessions.delete(id);
    }
  }

  const MAX_SESSIONS = 50;
  if (sessions.size <= MAX_SESSIONS) return;

  const sorted = Array.from(sessions.values()).sort((a, b) => a.timestamp - b.timestamp);
  for (const s of sorted) {
    if (sessions.size <= MAX_SESSIONS) break;
    if (s.status === 'implemented' || s.status === 'resolved') {
      sessions.delete(s.id);
    }
  }

  if (sessions.size > MAX_SESSIONS) {
    const remaining = Array.from(sessions.values()).sort((a, b) => a.timestamp - b.timestamp);
    for (const s of remaining) {
      if (sessions.size <= MAX_SESSIONS) break;
      if (s.status !== 'in_progress' && s.status !== 'submitted') {
        sessions.delete(s.id);
      }
    }
  }
}

export function loadSessionsFromJsonl(
  filePath: string,
  currentCursor: number
): { sessions: Map<string, VisualEditBatch>; maxSeenCursor: number; needsSave: boolean } | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  let prunedAny = false;
  const loadedSessions = new Map<string, VisualEditBatch>();
  let maxSeenCursor = currentCursor;

  for (const line of lines) {
    try {
      const batch: VisualEditBatch = JSON.parse(line);
      if (!hasSessionContent(batch)) {
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

  const initialSize = loadedSessions.size;
  pruneSessionsMap(loadedSessions);
  return {
    sessions: loadedSessions,
    maxSeenCursor,
    needsSave: prunedAny || loadedSessions.size < initialSize,
  };
}

export function saveSessionsToJsonl(filePath: string, sessions: Map<string, VisualEditBatch>): void {
  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const lines = Array.from(sessions.values()).map((b) => JSON.stringify(b));
  const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, filePath);
}

export function loadReviewModeFromFile(filePath: string): ReviewMode | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (raw?.reviewMode === 'live' || raw?.reviewMode === 'batch') {
        return raw.reviewMode;
      }
    }
  } catch (err) {
    console.debug('[lux] Failed to load review mode from file:', err);
  }
  return null;
}

export function saveReviewModeToFile(filePath: string, mode: ReviewMode): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify({ reviewMode: mode }) + '\n', 'utf-8');
  } catch (err) {
    console.debug('[lux] Failed to save review mode to file:', err);
  }
}

export function ensureVisualEditGitignored(rootDir: string): void {
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
