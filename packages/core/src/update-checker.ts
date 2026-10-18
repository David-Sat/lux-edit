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

export function getDefaultUpdateCachePath(): string {
  try {
    const home = os.homedir();
    if (home) {
      return path.join(home, '.lux', 'update-cache.json');
    }
  } catch {}
  return path.join(os.tmpdir(), '.lux-update-cache.json');
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
  if (!options.force && fs.existsSync(cacheFilePath)) {
    try {
      const raw = fs.readFileSync(cacheFilePath, 'utf-8');
      const cached = JSON.parse(raw);
      if (
        cached &&
        typeof cached.latestVersion === 'string' &&
        typeof cached.checkedAt === 'number' &&
        Date.now() - cached.checkedAt < ttlMs
      ) {
        const updateAvailable = isNewerVersion(currentVersion, cached.latestVersion);
        return {
          updateAvailable,
          currentVersion,
          latestVersion: cached.latestVersion,
          changelogUrl: `https://github.com/David-Sat/lux-edit/releases/tag/lux-edit-v${cached.latestVersion}`,
          checkedAt: cached.checkedAt,
        };
      }
    } catch {}
  }

  // 2. Query registry with timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${registryUrl.replace(/\/+$/, '')}/${packageName}/latest`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
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
        } catch {}

        return result;
      }
    }
  } catch (err) {
    // Offline, timeout, or network issue - try fallback to cached version even if expired
    if (fs.existsSync(cacheFilePath)) {
      try {
        const raw = fs.readFileSync(cacheFilePath, 'utf-8');
        const cached = JSON.parse(raw);
        if (cached && typeof cached.latestVersion === 'string') {
          return {
            updateAvailable: isNewerVersion(currentVersion, cached.latestVersion),
            currentVersion,
            latestVersion: cached.latestVersion,
            changelogUrl: `https://github.com/David-Sat/lux-edit/releases/tag/lux-edit-v${cached.latestVersion}`,
            checkedAt: cached.checkedAt,
          };
        }
      } catch {}
    }
  }

  return defaultResult;
}
