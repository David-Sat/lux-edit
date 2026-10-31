import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { checkForUpdates, UpdateCheckResult } from '@visual-edit/core';
import { runInit } from './init.js';

export interface UpdateOptions {
  check?: boolean;
  force?: boolean;
  autoUpdate?: boolean;
  logger?: (msg: string) => void;
  currentVersion?: string;
}

export async function runUpdate(options: UpdateOptions = {}): Promise<UpdateCheckResult> {
  const log = options.logger || console.log;

  let currentVersion = options.currentVersion || '0.13.0';
  if (!options.currentVersion) {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
      );
      currentVersion = pkg.version || currentVersion;
    } catch {}
  }

  log('\nChecking for updates to lux-edit...');
  const result = await checkForUpdates(currentVersion, { force: true });
  const displayCurrent = result.currentVersion || currentVersion;

  if (options.check) {
    if (result.updateAvailable) {
      log(`\nUpdate available: v${displayCurrent} → v${result.latestVersion}`);
      log(`Changelog:        ${result.changelogUrl}`);
      log(`Run 'lux update' to upgrade automatically.\n`);
    } else {
      log(`\n✓ lux-edit is up to date (v${displayCurrent})\n`);
    }
    return result;
  }

  if (!result.updateAvailable && !options.force) {
    log(`\n✓ lux-edit is already up to date (v${displayCurrent})`);
    log('\nRefreshing agent skills and MCP settings to ensure latest configs...');
    try {
      await runInit({ yes: true, global: true, autoUpdate: options.autoUpdate, logger: log });
      log('✓ Agent skills and MCP settings are up to date.\n');
    } catch (err: any) {
      log(`Note: Skill refresh skipped: ${err.message}\n`);
    }
    return result;
  }

  log(`\nFound newer version: v${result.latestVersion} (currently installed: v${displayCurrent})`);
  log(`Changelog: ${result.changelogUrl}\n`);

  // 1. Try upgrading the global package
  try {
    log('Upgrading lux-edit via npm...');
    execSync('npm install -g lux-edit@latest', { stdio: 'inherit' });
    log('✓ Successfully upgraded global lux-edit package');
  } catch (err: any) {
    log(`Note: Global npm install skipped or not run as root (${err.message})`);
    log('If you run lux via npx, the new version will be used automatically on next run.');
  }

  // 2. Re-sync agent skills and MCP configurations with updated templates
  log('\nRe-syncing agent skills and MCP configurations with latest templates...');
  try {
    await runInit({ yes: true, global: true, autoUpdate: options.autoUpdate, logger: log });
    log('✓ Refreshed agent skills and MCP settings');
  } catch (err: any) {
    log(`Warning: Failed to refresh agent skills: ${err.message}`);
  }

  log('\n✓ Update complete! Run `lux` to start visual editing.\n');
  return result;
}
