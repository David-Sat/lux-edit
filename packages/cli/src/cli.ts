#!/usr/bin/env node
import { Command } from 'commander';
import { VisualEditServer } from '@visual-edit/server';
import { startMcpStdio } from '@visual-edit/mcp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { DEMO_HTML_TEMPLATE } from './demo-template.js';

declare const __PACKAGE_VERSION__: string;

import { DEFAULT_PORT } from '@visual-edit/core';

let cliVersion = '0.5.0';
try {
  cliVersion = typeof __PACKAGE_VERSION__ !== 'undefined' ? __PACKAGE_VERSION__ : JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
} catch (e) {}

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
      } catch {}
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
    } catch (err: any) {
      console.error('Failed to start lux server:', err.message);
      process.exit(1);
    }
  });

function openBrowser(url: string) {
  const plat = process.platform;
  const cmd = plat === 'darwin' ? `open "${url}"` : plat === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

program
  .command('demo')
  .description('Start interactive Lux demo playground to explore visual editing, comments, and agent handoff')
  .option('-p, --port <number>', 'Review server port', '4320')
  .option('-h, --host <address>', 'Bind address', '127.0.0.1')
  .option('-r, --root <path>', 'Project root directory for demo sandbox', process.cwd())
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    const rootDir = path.resolve(options.root);
    const demoDir = path.join(rootDir, 'lux-demo');
    const demoFile = path.join(demoDir, 'index.html');

    if (!fs.existsSync(demoDir)) {
      fs.mkdirSync(demoDir, { recursive: true });
    }

    if (!fs.existsSync(demoFile)) {
      fs.writeFileSync(demoFile, DEMO_HTML_TEMPLATE, 'utf-8');
      console.log(`[lux] Created interactive demo playground at: ${demoFile}`);
    }

    // Ensure /lux-demo/ is in .gitignore
    const gitignorePath = path.join(rootDir, '.gitignore');
    try {
      let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
      if (!gitignore.includes('/lux-demo')) {
        gitignore += (gitignore.endsWith('\n') || gitignore.length === 0 ? '' : '\n') + '/lux-demo/\n';
        fs.writeFileSync(gitignorePath, gitignore, 'utf-8');
      }
    } catch {}

    const port = parseInt(options.port, 10);
    const server = new VisualEditServer({
      target: demoFile,
      port,
      host: options.host,
      rootDir,
    });

    try {
      const reviewUrl = await server.listen();
      console.log('\n✦ Lux Interactive Playground');
      console.log(`Review URL:  ${reviewUrl}`);
      console.log(`Demo File:   ${demoFile}`);
      console.log(`\nFollow the instructions on the demo page to try:`);
      console.log(`  1. Direct Visual Editing (Press 'E' to fix the headline typo)`);
      console.log(`  2. Inline Text Selection (Press 'C' to highlight and comment on jargon)`);
      console.log(`  3. Multi-Element Pins    (Shift + Click to link the 3 cards)`);
      console.log(`\nWhen finished, run /lux in your AI coding assistant to apply your edits!`);
      console.log('\nPress Ctrl+C to stop.\n');

      if (options.open !== false) {
        openBrowser(reviewUrl);
      }
    } catch (err: any) {
      console.error('Failed to start lux demo server:', err.message);
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

import { runInit, runUninstall } from './init.js';

program
  .command('init')
  .alias('install')
  .description('Initialize lux agent plugin, MCP configuration, and skills')
  .option('-g, --global', 'Install globally for agents (Antigravity, Claude Code, and detected MCP clients)', false)
  .option('-y, --yes', 'Automatic non-interactive mode; use detected defaults', false)
  .option('--agent <name>', 'Target a specific agent (antigravity, claude, cursor, windsurf, desktop)')
  .option('--path <path>', 'Install to custom MCP JSON config file or directory')
  .option('--all', 'Configure all major agents regardless of whether they are detected on this machine', false)
  .option('--dry-run', 'Show planned changes without writing files', false)
  .action(async (options) => {
    await runInit({
      global: options.global,
      agent: options.agent,
      all: options.all,
      dryRun: options.dryRun,
      yes: options.yes,
      path: options.path,
    });
  });

program
  .command('uninstall')
  .alias('remove')
  .description('Remove lux MCP configuration and skills from agents or workspace')
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

