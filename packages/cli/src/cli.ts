#!/usr/bin/env node
import { Command } from 'commander';
import { VisualEditServer } from '@visual-edit/server';
import { startMcpStdio } from '@visual-edit/mcp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const program = new Command();

program
  .name('lux')
  .alias('lux-edit')
  .description('In-browser visual editing overlay for web apps and AI coding agents')
  .version('0.2.0');

// Command: Run Server / Proxy (default)
program
  .argument('[target]', 'Upstream dev server URL (e.g. http://localhost:5173) or static file/directory path', '.')
  .option('-p, --port <number>', 'Review server port', '4320')
  .option('-h, --host <address>', 'Bind address', '127.0.0.1')
  .option('-r, --root <path>', 'Project root directory for .visual-edit data', process.cwd())
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
    });

    try {
      const reviewUrl = await server.listen();
      console.log('\nlux-edit');
      console.log(`Review URL:  ${reviewUrl}`);
      console.log(`Target:      ${normalizedTarget}`);
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

// Command: Initialize Agent Plugins manifest, MCP config, and skills
program
  .command('init')
  .alias('install')
  .description('Initialize lux agent plugin, MCP configuration, and skills in the current workspace')
  .option('--dry-run', 'Show planned changes without writing files', false)
  .action(async (options) => {
    const cwd = process.cwd();
    console.log('\nInitializing lux workspace configuration\n');

    // 1. Write standard mcp.json
    const mcpConfigPath = path.join(cwd, 'mcp.json');
    const mcpConfig = {
      mcpServers: {
        lux: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', 'lux-edit', 'mcp'],
        },
      },
    };

    if (!options.dryRun) {
      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + '\n');
    }
    console.log(`Created MCP config: ${mcpConfigPath}`);

    // 2. Write standard plugin.json
    const pluginManifestPath = path.join(cwd, 'plugin.json');
    const pluginManifest = {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'lux-edit',
      description: 'Live in-browser visual editing overlay for web apps and AI coding agents',
      version: '0.2.0',
    };

    if (!options.dryRun) {
      fs.writeFileSync(pluginManifestPath, JSON.stringify(pluginManifest, null, 2) + '\n');
    }
    console.log(`Created plugin manifest: ${pluginManifestPath}`);

    // 3. Write standard skills/lux-review/SKILL.md
    const skillDir = path.join(cwd, 'skills', 'lux-review');
    const skillFile = path.join(skillDir, 'SKILL.md');
    const skillContent = `---
name: lux-review
description: In-browser visual review and editing with lux. Use when reviewing web pages, inspecting HTML or React apps, waiting for visual feedback, and applying DOM or style diffs.
---

# lux-edit Visual Review & UI Editing

lux-edit injects a visual overlay into local web apps, dev servers, and static HTML files. Reviewers can edit styles, typography, colors, layout, and pin comments, producing structured diffs for agents to apply.

## Instructions for Agents

1. Start review server on user command (/lux-start): \`lux <url-or-file> --port 4320\`
2. When asked to review (/lux-review): Call \`lux_get_pending_review\` to retrieve comments & diffs.
3. Apply changes to source code. File watcher auto-resolves feedback and reloads browser upon save.
`;

    if (!options.dryRun) {
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(skillFile, skillContent);
    }
    console.log(`Created agent skill: ${skillFile}`);

    // 4. Auto-detect Claude Code ~/.claude/skills
    const claudeDir = path.join(os.homedir(), '.claude', 'skills', 'lux-review');
    try {
      if (fs.existsSync(path.join(os.homedir(), '.claude'))) {
        if (!options.dryRun) {
          fs.mkdirSync(claudeDir, { recursive: true });
          fs.writeFileSync(path.join(claudeDir, 'SKILL.md'), skillContent);
        }
        console.log(`Synced Claude Code skill: ${path.join(claudeDir, 'SKILL.md')}`);
      }
    } catch (e) {}

    console.log('\nInitialization complete.');
    console.log('Run `lux <url-or-file>` to start visual editing.\n');
  });

program.parse(process.argv);
