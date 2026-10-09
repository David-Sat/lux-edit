#!/usr/bin/env node
import { Command } from 'commander';
import { VisualEditServer } from '@visual-edit/server';
import { startMcpStdio } from '@visual-edit/mcp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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

