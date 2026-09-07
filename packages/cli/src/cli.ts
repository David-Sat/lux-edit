#!/usr/bin/env node
import { Command } from 'commander';
import { VisualEditServer } from '@visual-edit/server';
import { startMcpStdio } from '@visual-edit/mcp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

declare const __PACKAGE_VERSION__: string;

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

// Command: Run Server / Proxy (default)
program
  .argument('[target]', 'Upstream dev server URL (e.g. http://localhost:5173) or static file/directory path', '.')
  .option('-p, --port <number>', 'Review server port', '4320')
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

// Command: Run MCP stdio server
program
  .command('mcp')
  .description('Start Model Context Protocol (MCP) server over stdio for coding agents')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    await startMcpStdio(options.root);
  });

import { runInit, runUninstall } from './init.js';

// Command: Initialize Agent Plugins manifest, MCP config, and skills
program
  .command('init')
  .alias('install')
  .description('Initialize lux agent plugin, MCP configuration, and skills')
  .option('-g, --global', 'Install globally for all agents across all projects (Antigravity, Claude, Cursor, Windsurf, Cline, Roo Code)', false)
  .option('--dry-run', 'Show planned changes without writing files', false)
  .action(async (options) => {
    runInit({
      global: options.global,
      dryRun: options.dryRun,
    });
  });

// Command: Remove Agent MCP config, plugin manifest, and skills
program
  .command('uninstall')
  .alias('remove')
  .description('Remove lux MCP configuration and skills from agents or workspace')
  .option('-g, --global', 'Remove globally from all user agents (Antigravity, Claude, Cursor, Windsurf, Cline, Roo Code)', false)
  .option('--dry-run', 'Show planned changes without deleting files', false)
  .action(async (options) => {
    runUninstall({
      global: options.global,
      dryRun: options.dryRun,
    });
  });

program.parse(process.argv);

