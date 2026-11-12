import path from 'node:path';
import fs from 'node:fs';
import { EventStore } from '@visual-edit/server';
import {
  VisualEditBatch,
  LuxServerMetadata,
  HookLeaseStatus,
  ReviewMode,
  SessionSummary,
  SERVER_METADATA_DIR,
  SERVER_METADATA_FILE,
  DEFAULT_SERVER_URL,
  API_ROUTES,
  stripTrailingSlashes,
} from '@visual-edit/core';

export interface ServerStatusResponse {
  appId?: string;
  version?: string;
  reviewMode?: ReviewMode;
  latestCursor?: number;
  hookLease?: HookLeaseStatus;
  waiterConnected?: boolean;
  connectedClients?: number;
  hasPendingReview?: boolean;
  pendingSessionId?: string;
}

export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const WRITE_IDEMPOTENT_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export interface PendingBatchQuery {
  workspaceDir?: string;
  serverUrl?: string;
  afterCursor?: number;
  waitForFeedbackMs?: number;
  claim?: boolean;
}

export interface LuxServerBridge {
  resolvedRoot: string;
  defaultEventStore: EventStore;
  resolveEventStore: (workspaceDir?: string) => EventStore;
  resolveTargetServerUrl: (args?: { workspaceDir?: string; serverUrl?: string }) => string | null;
  resolvePendingBatch: (args?: PendingBatchQuery) => Promise<VisualEditBatch | null>;
}

/** Returns true if a batch contains any actionable mutations, comments, voice notes, variants, or prompt. */
export function hasPendingContent(batch: VisualEditBatch | null): batch is VisualEditBatch {
  if (!batch) return false;
  return Boolean(
    (batch.mutations && batch.mutations.length > 0) ||
      (batch.annotations && batch.annotations.length > 0) ||
      (batch.voiceReviews && batch.voiceReviews.length > 0) ||
      (batch.variantDecisions && batch.variantDecisions.length > 0) ||
      (batch.userPrompt && batch.userPrompt.trim().length > 0)
  );
}

/**
 * Extracts raw PNG image content blocks from annotation screenshots while redacting
 * base64 data URLs from the JSON payload to minimize MCP token bloat.
 */
export function extractBatchImagesAndSanitize<T extends VisualEditBatch>(batch: T): {
  imageItems: Array<{ type: 'image'; data: string; mimeType: 'image/png' }>;
  sanitizedBatch: T;
} {
  const imageItems: Array<{ type: 'image'; data: string; mimeType: 'image/png' }> = [];
  const sanitizedBatch: T = {
    ...batch,
    annotations: batch.annotations?.map((a) => {
      if (a.screenshot && typeof a.screenshot === 'string') {
        const clean = a.screenshot.replace(/^data:image\/\w+;base64,/, '');
        if (clean) {
          imageItems.push({
            type: 'image' as const,
            data: clean,
            mimeType: 'image/png' as const,
          });
        }
        const kb = Math.round((a.screenshot.length * 3) / 4 / 1024);
        return {
          ...a,
          screenshot: `[base64 image (${kb > 0 ? kb : 1}KB)]`,
        };
      }
      return a;
    }),
  };
  return { imageItems, sanitizedBatch };
}

/** Reads `.visual-edit/server.json` metadata and prunes stale entries whose PID no longer exists. */
export function readServerMetadata(rootDir: string): LuxServerMetadata | null {
  try {
    const metaPath = path.join(rootDir, SERVER_METADATA_DIR, SERVER_METADATA_FILE);
    if (!fs.existsSync(metaPath)) return null;
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const data = JSON.parse(raw) as LuxServerMetadata;
    if (data.pid && typeof data.pid === 'number') {
      try {
        process.kill(data.pid, 0);
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ESRCH') {
          try {
            fs.unlinkSync(metaPath);
          } catch {
            // Ignore race if lockfile was already removed by server shutdown.
          }
          return null;
        }
      }
    }
    return data;
  } catch {
    return null;
  }
}

async function probeRunningServer(
  serverUrl: string,
  options?: {
    autoResolve?: boolean;
    claim?: boolean;
    afterCursor?: number;
    waitMs?: number;
  }
): Promise<{ reachable: boolean; batch: VisualEditBatch | null }> {
  try {
    const params = new URLSearchParams();
    if (options?.autoResolve) params.set('resolve', 'true');
    if (options?.claim) params.set('claim', 'true');
    if (typeof options?.afterCursor === 'number') params.set('afterCursor', String(options.afterCursor));
    if (typeof options?.waitMs === 'number' && options.waitMs > 0) params.set('waitMs', String(options.waitMs));

    const qs = params.toString();
    const url = stripTrailingSlashes(serverUrl) + `${API_ROUTES.PENDING}${qs ? `?${qs}` : ''}`;
    const timeoutMs = (options?.waitMs || 0) + 1200;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      const data = (await res.json()) as VisualEditBatch | null;
      return { reachable: true, batch: hasPendingContent(data) ? data : null };
    }
  } catch {
    // Live HTTP server unreachable; callers fall back to disk EventStore.
  }
  return { reachable: false, batch: null };
}

export async function fetchFromRunningServer(
  serverUrl: string,
  options?: {
    autoResolve?: boolean;
    claim?: boolean;
    afterCursor?: number;
    waitMs?: number;
  }
): Promise<VisualEditBatch | null> {
  const { batch } = await probeRunningServer(serverUrl, options);
  return batch;
}

export async function fetchServerStatus(serverUrl: string): Promise<ServerStatusResponse | null> {
  try {
    const url = stripTrailingSlashes(serverUrl) + API_ROUTES.STATUS;
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      return (await res.json()) as ServerStatusResponse;
    }
  } catch {
    // Live server status is optional; return null when server is not running.
  }
  return null;
}

export async function fetchSessionsFromRunningServer(serverUrl: string): Promise<SessionSummary[] | null> {
  try {
    const url = stripTrailingSlashes(serverUrl) + API_ROUTES.SESSIONS;
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      return (await res.json()) as SessionSummary[];
    }
  } catch {
    // Live server unreachable; return null to use disk EventStore sessions.
  }
  return null;
}

/** Creates a bridge encapsulating EventStore and live lux HTTP server discovery/fallback. */
export function createLuxServerBridge(resolvedRoot: string): LuxServerBridge {
  const defaultEventStore = EventStore.getInstance(resolvedRoot);

  const resolveEventStore = (workspaceDir?: string) => {
    if (workspaceDir && workspaceDir.trim()) {
      return EventStore.getInstance(path.resolve(workspaceDir.trim()));
    }
    return defaultEventStore;
  };

  const resolveTargetServerUrl = (args?: { workspaceDir?: string; serverUrl?: string }): string | null => {
    if (args?.serverUrl && args.serverUrl.trim()) {
      return stripTrailingSlashes(args.serverUrl.trim());
    }
    const targetRootDir = args?.workspaceDir ? path.resolve(args.workspaceDir.trim()) : resolvedRoot;
    const meta = readServerMetadata(targetRootDir);
    if (meta && meta.url) {
      return stripTrailingSlashes(meta.url);
    }
    if (!args?.workspaceDir) {
      return DEFAULT_SERVER_URL;
    }
    return null;
  };

  const resolvePendingBatch = async (args?: PendingBatchQuery): Promise<VisualEditBatch | null> => {
    const targetRootDir = args?.workspaceDir ? path.resolve(args.workspaceDir.trim()) : resolvedRoot;
    const fetchOpts = {
      autoResolve: false,
      claim: args?.claim ?? true,
      afterCursor: args?.afterCursor,
      waitMs: args?.waitForFeedbackMs,
    };

    const triedUrls = new Set<string>();
    const candidateUrls: string[] = [];
    if (args?.serverUrl && args.serverUrl.trim()) {
      candidateUrls.push(stripTrailingSlashes(args.serverUrl.trim()));
    }

    const serverMeta =
      readServerMetadata(targetRootDir) || (targetRootDir !== resolvedRoot ? readServerMetadata(resolvedRoot) : null);
    if (serverMeta && serverMeta.url) {
      candidateUrls.push(stripTrailingSlashes(serverMeta.url));
    }

    for (const url of candidateUrls) {
      if (triedUrls.has(url)) continue;
      triedUrls.add(url);
      const probed = await probeRunningServer(url, fetchOpts);
      if (probed.reachable) {
        return probed.batch;
      }
    }

    if (args?.workspaceDir && args.workspaceDir.trim()) {
      const store = resolveEventStore(args.workspaceDir);
      const batch = store.getPendingReview({
        serverUrl: args?.serverUrl,
        afterCursor: args?.afterCursor,
      });
      if (hasPendingContent(batch)) {
        if (args?.claim) {
          store.updateStatus(batch.id, 'in_progress');
        }
        return batch;
      }
    }

    const localBatch = defaultEventStore.getPendingReview({
      serverUrl: args?.serverUrl,
      afterCursor: args?.afterCursor,
    });
    if (hasPendingContent(localBatch)) {
      if (args?.claim) {
        defaultEventStore.updateStatus(localBatch.id, 'in_progress');
      }
      return localBatch;
    }

    if (!args?.workspaceDir) {
      const live = await fetchFromRunningServer(DEFAULT_SERVER_URL, fetchOpts);
      if (live) return live;
    }

    return localBatch || null;
  };

  return {
    resolvedRoot,
    defaultEventStore,
    resolveEventStore,
    resolveTargetServerUrl,
    resolvePendingBatch,
  };
}
