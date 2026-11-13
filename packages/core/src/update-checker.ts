import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  changelogUrl: string;
  checkedAt?: number;
}

export interface UpdateCheckOptions {
  packageName?: string;
  cacheFilePath?: string;
  ttlMs?: number;
  timeoutMs?: number;
  force?: boolean;
  registryUrl?: string;
}

export const DEFAULT_UPDATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_UPDATE_TIMEOUT_MS = 1500; // 1.5 seconds

/**
 * Compare two semver version strings (e.g. "0.12.0" and "0.13.0").
 * Returns true if latest is strictly newer than current.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  if (!current || !latest) return false;
  if (current === latest) return false;

  const parseParts = (v: string): number[] => {
    const clean = v.replace(/^v/, '').split('-')[0];
    return clean.split('.').map((p) => {
      const num = parseInt(p, 10);
      return isNaN(num) ? 0 : num;
    });
  };

  const currParts = parseParts(current);
  const lateParts = parseParts(latest);

  const len = Math.max(currParts.length, lateParts.length, 3);
  for (let i = 0; i < len; i++) {
    const c = currParts[i] || 0;
    const l = lateParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}

/**
 * Safely strips trailing slashes from a URL or path without regular expressions,
 * preventing polynomial regular expression denial-of-service (ReDoS) vulnerabilities.
 */
export function stripTrailingSlashes(input: string): string {
  let end = input.length;
  while (end > 0 && input.charCodeAt(end - 1) === 47 /* '/' */) {
    end--;
  }
  return input.slice(0, end);
}

export function getDefaultUpdateCachePath(): string {
  try {
    const home = os.homedir();
    if (home) {
      return path.join(home, '.lux', 'update-cache.json');
    }
  } catch {
    // Fall back to system tmpdir when user home directory is unavailable.
  }
  return path.join(os.tmpdir(), '.lux-update-cache.json');
}

interface CachedUpdateFile {
  latestVersion?: unknown;
  checkedAt?: unknown;
}

function readCachedUpdate(
  cacheFilePath: string,
  currentVersion: string,
  maxAgeMs?: number
): UpdateCheckResult | null {
  if (!fs.existsSync(cacheFilePath)) return null;
  try {
    const raw = fs.readFileSync(cacheFilePath, 'utf-8');
    const cached = JSON.parse(raw) as CachedUpdateFile;
    if (!cached || typeof cached.latestVersion !== 'string') {
      return null;
    }
    const checkedAt = typeof cached.checkedAt === 'number' ? cached.checkedAt : undefined;
    if (maxAgeMs !== undefined && (checkedAt === undefined || Date.now() - checkedAt >= maxAgeMs)) {
      return null;
    }
    return {
      updateAvailable: isNewerVersion(currentVersion, cached.latestVersion),
      currentVersion,
      latestVersion: cached.latestVersion,
      changelogUrl: `https://github.com/David-Sat/lux-edit/releases/tag/lux-edit-v${cached.latestVersion}`,
      checkedAt,
    };
  } catch {
    // Ignore corrupt or unreadable cache files and re-fetch when online.
    return null;
  }
}

/**
 * Checks the npm registry for the latest version of lux-edit.
 * Uses a non-blocking 24-hour cache and strict timeout so it never degrades performance or blocks offline use.
 */
export async function checkForUpdates(
  currentVersion: string,
  options: UpdateCheckOptions = {}
): Promise<UpdateCheckResult> {
  const packageName = options.packageName || 'lux-edit';
  const cacheFilePath = options.cacheFilePath || getDefaultUpdateCachePath();
  const ttlMs = options.ttlMs ?? DEFAULT_UPDATE_TTL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_UPDATE_TIMEOUT_MS;
  const registryUrl = options.registryUrl || 'https://registry.npmjs.org';

  const defaultResult: UpdateCheckResult = {
    updateAvailable: false,
    currentVersion,
    latestVersion: currentVersion,
    changelogUrl: `https://github.com/David-Sat/lux-edit/releases`,
  };

  // 1. Try reading valid unexpired cache
  if (!options.force) {
    const freshCache = readCachedUpdate(cacheFilePath, currentVersion, ttlMs);
    if (freshCache) return freshCache;
  }

  // 2. Query registry with timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const cleanRegistry = stripTrailingSlashes(registryUrl);
    const res = await fetch(`${cleanRegistry}/${packageName}/latest`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as { version?: unknown };
      const latestVersion = data?.version;

      if (latestVersion && typeof latestVersion === 'string') {
        const updateAvailable = isNewerVersion(currentVersion, latestVersion);
        const result: UpdateCheckResult = {
          updateAvailable,
          currentVersion,
          latestVersion,
          changelogUrl: `https://github.com/David-Sat/lux-edit/releases/tag/lux-edit-v${latestVersion}`,
          checkedAt: Date.now(),
        };

        // Cache result to disk
        try {
          fs.mkdirSync(path.dirname(cacheFilePath), { recursive: true });
          fs.writeFileSync(
            cacheFilePath,
            JSON.stringify(
              {
                latestVersion,
                currentVersion,
                checkedAt: Date.now(),
              },
              null,
              2
            ) + '\n'
          );
        } catch {
          // Cache write failure is non-fatal (e.g., read-only filesystem).
        }

        return result;
      }
    }
  } catch {
    // Offline, timeout, or network issue - try fallback to cached version even if expired
    const staleCache = readCachedUpdate(cacheFilePath, currentVersion);
    if (staleCache) return staleCache;
  }

  return defaultResult;
}
