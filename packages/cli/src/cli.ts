#!/usr/bin/env node
import { Command } from 'commander';
import { VisualEditServer } from '@visual-edit/server';
import { startMcpStdio } from '@visual-edit/mcp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

declare const __PACKAGE_VERSION__: string;

import { DEFAULT_PORT, checkForUpdates } from '@visual-edit/core';
import { runUpdate } from './update.js';
import { runInit, runUninstall } from './init.js';
import {
  handleHookEvent,
  handleHookWait,
  readStdinJson,
  mergeHarnessHooksConfig,
  removeHarnessHooksConfig,
  getAntigravityHooksContent,
  HookHarness,
  HookEventName,
} from './hooks.js';

let cliVersion = '0.13.0';
try {
  cliVersion = typeof __PACKAGE_VERSION__ !== 'undefined' ? __PACKAGE_VERSION__ : JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
} catch {
  // Fall back to default version when package.json cannot be read.
}

const program = new Command();

program
  .name('lux')
  .alias('lux-edit')
  .description('In-browser visual editing overlay for web apps and AI coding agents')
  .version(cliVersion);

program
  .argument('[target]', 'Upstream dev server URL (e.g. http://localhost:5173) or static file/directory path', '.')
  .option('-p, --port <number>', 'Review server port', String(DEFAULT_PORT))
  .option('-h, --host <address>', 'Bind address', '127.0.0.1')
  .option('-r, --root <path>', 'Project root directory for .visual-edit data', process.cwd())
  .option('-b, --base-path <prefix>', 'Path prefix if running behind a reverse proxy (e.g. /codeeditor/default/ports/4401)', process.env.LUX_BASE_PATH || '')
  .action(async (target, options) => {
    let normalizedTarget = target;
    if (!isNaN(Number(target))) {
      normalizedTarget = `http://127.0.0.1:${target}`;
    }

    const port = parseInt(options.port, 10);
    const server = new VisualEditServer({
      target: normalizedTarget,
      port,
      host: options.host,
      rootDir: options.root,
      basePath: options.basePath,
    });

    const cleanup = async () => {
      const forceTimer = setTimeout(() => process.exit(0), 1000);
      forceTimer.unref();
      try {
        await server.close();
      } catch {
        // Ignore shutdown errors so signal handler exits cleanly.
      }
      process.exit(0);
    };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);

    try {
      const reviewUrl = await server.listen();
      console.log('\nlux-edit');
      console.log(`Review URL:  ${reviewUrl}`);
      console.log(`Target:      ${normalizedTarget}`);
      if (options.basePath) {
        console.log(`Base Path:   ${options.basePath}`);
      }
      console.log(`MCP server:  npx lux-edit mcp`);
      console.log('\nPress Ctrl+C to stop.\n');

      // Non-blocking update check (cached 24h)
      checkForUpdates(cliVersion)
        .then((update) => {
          if (update.updateAvailable) {
            console.log('┌─────────────────────────────────────────────────────────────┐');
            console.log(`│  Update available: v${cliVersion} → v${update.latestVersion}`.padEnd(62) + '│');
            console.log(`│  Changelog: https://github.com/David-Sat/lux-edit/releases`.padEnd(62) + '│');
            console.log(`│  Run 'lux update' to upgrade automatically`.padEnd(62) + '│');
            console.log('└─────────────────────────────────────────────────────────────┘\n');
          }
        })
        .catch(() => {});
    } catch (err: unknown) {
      console.error('Failed to start lux server:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command('mcp')
  .description('Start Model Context Protocol (MCP) server over stdio for coding agents')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    await startMcpStdio(options.root);
  });

const hookCmd = program
  .command('hook')
  .description('Lifecycle hook handler and configurator for Antigravity, Claude Code, and Codex');

hookCmd
  .command('event')
  .description('Process a lifecycle hook event from stdin and write decision to stdout')
  .option('--harness <name>', 'Agent harness (antigravity, claude-code, codex, auto)', 'auto')
  .option('--event <name>', 'Hook event name (PostToolUse, PreInvocation, Stop, SessionEnd, Interrupt)', 'Stop')
  .option('--url <serverUrl>', 'Optional explicit lux review server URL')
  .action(async (options) => {
    const rawPayload = await readStdinJson();
    const out = await handleHookEvent(rawPayload, {
      harness: options.harness as HookHarness,
      event: options.event as HookEventName,
      serverUrl: options.url,
    });
    process.stdout.write(JSON.stringify(out) + '\n');
  });

hookCmd
  .command('wait')
  .description('Wait in the background for live or batch visual feedback and wake the agent on completion')
  .option('--harness <name>', 'Agent harness (antigravity, claude-code, codex, auto)', 'antigravity')
  .option('--session <id>', 'Optional session identifier', 'waiter')
  .option('--url <serverUrl>', 'Optional explicit lux review server URL')
  .option('--timeout <seconds>', 'Maximum wait time in seconds', '3600')
  .action(async (options) => {
    const maxWaitMs = Math.max(1, parseInt(options.timeout, 10) || 3600) * 1000;
    const out = await handleHookWait({
      harness: options.harness as HookHarness,
      sessionId: options.session,
      serverUrl: options.url,
      maxWaitMs,
    });
    if (out.feedbackAvailable && out.reason) {
      process.stdout.write(out.reason + '\n');
    }
  });

function resolveHookTarget(
  harness: string,
  isGlobal: boolean,
  project: string
): { isAgy: boolean; normHarness: 'antigravity' | 'codex' | 'claude-code'; targetPath: string } {
  const home = os.homedir();
  const projectDir = path.resolve(project || process.cwd());
  const norm = String(harness || 'antigravity').toLowerCase();
  const isAgy = norm === 'antigravity' || norm === 'gemini';

  if (isAgy) {
    return {
      isAgy: true,
      normHarness: 'antigravity',
      targetPath: isGlobal
        ? path.join(home, '.gemini', 'config', 'plugins', 'lux-edit', 'hooks.json')
        : path.join(projectDir, '.agents', 'hooks.json'),
    };
  }
  const normHarness: 'codex' | 'claude-code' = norm === 'codex' ? 'codex' : 'claude-code';
  return {
    isAgy: false,
    normHarness,
    targetPath: isGlobal
      ? path.join(home, normHarness === 'codex' ? '.codex/hooks.json' : '.claude/settings.json')
      : path.join(projectDir, normHarness === 'codex' ? '.codex/hooks.json' : '.claude/settings.local.json'),
  };
}

hookCmd
  .command('configure')
  .alias('install')
  .description('Configure lifecycle hooks for Antigravity, Claude Code, or Codex')
  .option('--harness <name>', 'Target harness (antigravity, claude-code, codex)', 'antigravity')
  .option('-g, --global', 'Configure user-level global hooks', false)
  .option('--project <path>', 'Project directory for workspace hooks', process.cwd())
  .option('--auto-update', 'Use lux-edit@latest in hook commands', false)
  .option('--dry-run', 'Preview hook configuration without saving', false)
  .action((options) => {
    const { isAgy, normHarness, targetPath } = resolveHookTarget(options.harness, options.global, options.project);

    if (isAgy) {
      const content = JSON.stringify(getAntigravityHooksContent(options.autoUpdate), null, 2) + '\n';
      if (options.dryRun) {
        console.log(`${targetPath}\n${content}`);
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf-8');
        console.log(`[ok] Configured Antigravity hooks at ${targetPath}`);
      }
      return;
    }

    const ok = mergeHarnessHooksConfig(targetPath, normHarness, options.dryRun, options.autoUpdate);
    if (ok) {
      console.log(`[ok] Configured ${normHarness} hooks at ${targetPath}`);
    } else {
      console.error(`[error] Failed to configure ${normHarness} hooks at ${targetPath}`);
      process.exit(1);
    }
  });

hookCmd
  .command('remove')
  .alias('uninstall')
  .description('Remove lifecycle hooks from Antigravity, Claude Code, or Codex')
  .option('--harness <name>', 'Target harness (antigravity, claude-code, codex)', 'antigravity')
  .option('-g, --global', 'Remove user-level global hooks', false)
  .option('--project <path>', 'Project directory for workspace hooks', process.cwd())
  .option('--dry-run', 'Preview removal without modifying files', false)
  .action((options) => {
    const { isAgy, normHarness, targetPath } = resolveHookTarget(options.harness, options.global, options.project);

    if (isAgy) {
      if (fs.existsSync(targetPath) && !options.dryRun) {
        fs.rmSync(targetPath, { force: true });
      }
      console.log(`[ok] Removed Antigravity hooks from ${targetPath}`);
      return;
    }

    removeHarnessHooksConfig(targetPath, options.dryRun);
    console.log(`[ok] Removed ${normHarness} hooks from ${targetPath}`);
  });

program
  .command('init')
  .alias('install')
  .description('Initialize lux agent plugin, MCP configuration, lifecycle hooks, and skills')
  .option('-g, --global', 'Install globally for agents (Antigravity, Claude Code, and detected MCP clients)', false)
  .option('-y, --yes', 'Automatic non-interactive mode; use detected defaults', false)
  .option('--agent <name>', 'Target a specific agent (antigravity, claude, codex, cursor, windsurf, desktop)')
  .option('--path <path>', 'Install to custom MCP JSON config file or directory')
  .option('--all', 'Configure all major agents regardless of whether they are detected on this machine', false)
  .option('--auto-update', 'Configure MCP clients to run lux-edit@latest automatically on startup (opt-in auto-updates)', false)
  .option('--dry-run', 'Show planned changes without writing files', false)
  .action(async (options) => {
    await runInit({
      global: options.global,
      agent: options.agent,
      all: options.all,
      dryRun: options.dryRun,
      yes: options.yes,
      path: options.path,
      autoUpdate: options.autoUpdate,
    });
  });

program
  .command('update')
  .alias('upgrade')
  .description('Check for updates, upgrade lux-edit, and re-sync agent skills')
  .option('-c, --check', 'Check for updates without installing', false)
  .option('-f, --force', 'Force re-sync even if version matches', false)
  .option('--auto-update', 'Also configure MCP clients for auto-updating (@latest)', false)
  .action(async (options) => {
    await runUpdate({
      check: options.check,
      force: options.force,
      autoUpdate: options.autoUpdate,
    });
  });

program
  .command('uninstall')
  .alias('remove')
  .description('Remove lux MCP configuration, hooks, and skills from agents or workspace')
  .option('-g, --global', 'Remove globally from all user agents', false)
  .option('--agent <name>', 'Target a specific agent to uninstall from')
  .option('--path <path>', 'Remove from custom MCP JSON config file or directory')
  .option('--dry-run', 'Show planned changes without deleting files', false)
  .action(async (options) => {
    await runUninstall({
      global: options.global,
      agent: options.agent,
      dryRun: options.dryRun,
      path: options.path,
    });
  });

program.parse(process.argv);
