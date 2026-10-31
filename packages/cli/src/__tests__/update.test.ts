import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@visual-edit/core';
import * as init from '../init.js';
import { runUpdate } from '../update.js';

describe('lux update command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs update check without modifying anything when check: true', async () => {
    vi.spyOn(core, 'checkForUpdates').mockResolvedValueOnce({
      updateAvailable: true,
      currentVersion: '0.13.0',
      latestVersion: '0.14.0',
      changelogUrl: 'https://github.com/David-Sat/lux-edit/releases/tag/lux-edit-v0.14.0',
    });

    const initSpy = vi.spyOn(init, 'runInit');
    const logs: string[] = [];

    const res = await runUpdate({
      check: true,
      currentVersion: '0.13.0',
      logger: (msg) => logs.push(msg),
    });

    expect(res.updateAvailable).toBe(true);
    expect(res.latestVersion).toBe('0.14.0');
    expect(initSpy).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes('Update available: v0.13.0 → v0.14.0'))).toBe(true);
  });

  it('reports when already up to date and refreshes agent skills', async () => {
    vi.spyOn(core, 'checkForUpdates').mockResolvedValueOnce({
      updateAvailable: false,
      currentVersion: '0.13.0',
      latestVersion: '0.13.0',
      changelogUrl: 'https://github.com/David-Sat/lux-edit/releases',
    });

    const initSpy = vi.spyOn(init, 'runInit').mockResolvedValueOnce(undefined as any);
    const logs: string[] = [];

    const res = await runUpdate({
      check: false,
      logger: (msg) => logs.push(msg),
    });

    expect(res.updateAvailable).toBe(false);
    expect(initSpy).toHaveBeenCalled();
    expect(logs.some((l) => l.includes('already up to date'))).toBe(true);
  });
});
