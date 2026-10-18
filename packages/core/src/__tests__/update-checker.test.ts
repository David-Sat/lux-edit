import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  isNewerVersion,
  checkForUpdates,
  DEFAULT_UPDATE_TTL_MS,
} from '../update-checker.js';

describe('update-checker', () => {
  const testDir = path.join(os.tmpdir(), `lux-update-test-${Date.now()}`);
  const cacheFile = path.join(testDir, 'cache.json');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('isNewerVersion', () => {
    it('correctly compares patch versions', () => {
      expect(isNewerVersion('0.12.0', '0.12.1')).toBe(true);
      expect(isNewerVersion('0.12.1', '0.12.0')).toBe(false);
      expect(isNewerVersion('0.12.0', '0.12.0')).toBe(false);
    });

    it('correctly compares minor versions', () => {
      expect(isNewerVersion('0.12.0', '0.13.0')).toBe(true);
      expect(isNewerVersion('0.13.0', '0.12.9')).toBe(false);
    });

    it('correctly compares major versions', () => {
      expect(isNewerVersion('0.9.9', '1.0.0')).toBe(true);
      expect(isNewerVersion('1.0.0', '0.9.9')).toBe(false);
    });

    it('handles numeric sorting (e.g. 10 > 2)', () => {
      expect(isNewerVersion('0.1.2', '0.1.10')).toBe(true);
      expect(isNewerVersion('0.1.10', '0.1.2')).toBe(false);
    });

    it('handles leading v and tags', () => {
      expect(isNewerVersion('v0.12.0', 'v0.13.0')).toBe(true);
      expect(isNewerVersion('0.12.0-beta.1', '0.13.0')).toBe(true);
    });
  });

  describe('checkForUpdates', () => {
    it('returns cached result when cache is fresh', async () => {
      const now = Date.now();
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({
          latestVersion: '0.14.0',
          currentVersion: '0.13.0',
          checkedAt: now - 1000, // 1 second ago
        })
      );

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const res = await checkForUpdates('0.13.0', {
        cacheFilePath: cacheFile,
        ttlMs: DEFAULT_UPDATE_TTL_MS,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.updateAvailable).toBe(true);
      expect(res.latestVersion).toBe('0.14.0');
      expect(res.currentVersion).toBe('0.13.0');
    });

    it('fetches from registry and writes cache when cache is missing or stale', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '0.15.0' }),
      } as any);

      const res = await checkForUpdates('0.13.0', {
        cacheFilePath: cacheFile,
        ttlMs: DEFAULT_UPDATE_TTL_MS,
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(res.updateAvailable).toBe(true);
      expect(res.latestVersion).toBe('0.15.0');
      expect(res.currentVersion).toBe('0.13.0');

      expect(fs.existsSync(cacheFile)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      expect(saved.latestVersion).toBe('0.15.0');
    });

    it('gracefully handles offline or network timeout without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error (offline)'));

      const res = await checkForUpdates('0.13.0', {
        cacheFilePath: cacheFile,
        timeoutMs: 100,
      });

      expect(res.updateAvailable).toBe(false);
      expect(res.latestVersion).toBe('0.13.0');
      expect(res.currentVersion).toBe('0.13.0');
    });
  });
});
