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
  .description('LUX: Live User eXperience Overlay for Visual UI Editing & AI Coding Agents')
  .version('0.1.0');

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
      console.log('\n✨  \x1b[1m\x1b[35mLUX\x1b[0m \x1b[90m— Live User eXperience Overlay\x1b[0m');
      console.log(`👉  \x1b[1mReview URL:\x1b[0m  \x1b[1m\x1b[36m${reviewUrl}\x1b[0m`);
      console.log(`📦  \x1b[1mTarget:\x1b[0m      \x1b[90m${normalizedTarget}\x1b[0m`);
      console.log(`⚡  \x1b[1mMCP Server:\x1b[0m  \x1b[90mRun 'npx lux-edit mcp' in your agent\x1b[0m`);
      console.log('\n\x1b[90mPress Ctrl+C to stop.\x1b[0m\n');
    } catch (err: any) {
      console.error('\x1b[31mFailed to start LUX server:\x1b[0m', err.message);
      process.exit(1);
    }
  });

// Command: Run MCP stdio server
program
  .command('mcp')
  .description('Start the Model Context Protocol (MCP) server over stdio for coding agents')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(async (options) => {
    await startMcpStdio(options.root);
  });

// Command: Initialize Agent Plugins manifest, MCP config, and skills
program
  .command('init')
  .alias('install')
  .description('Initialize LUX Agent Plugin, MCP configuration, and skills in the current workspace')
  .option('--dry-run', 'Show planned changes without writing files', false)
  .action(async (options) => {
    const cwd = process.cwd();
    console.log('\n✨  \x1b[1m\x1b[35mInitializing LUX for AI Agents\x1b[0m\n');

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
    console.log(`✓ \x1b[32mStandard MCP Config:\x1b[0m ${mcpConfigPath}`);

    // 2. Write standard plugin.json
    const pluginManifestPath = path.join(cwd, 'plugin.json');
    const pluginManifest = {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'lux-edit',
      description: 'Live User eXperience overlay for visual UI editing and multi-agent feedback',
      version: '0.1.0',
    };

    if (!options.dryRun) {
      fs.writeFileSync(pluginManifestPath, JSON.stringify(pluginManifest, null, 2) + '\n');
    }
    console.log(`✓ \x1b[32mAgent Plugin Manifest:\x1b[0m ${pluginManifestPath}`);

    // 3. Write standard skills/lux-review/SKILL.md
    const skillDir = path.join(cwd, 'skills', 'lux-review');
    const skillFile = path.join(skillDir, 'SKILL.md');
    const skillContent = `---
name: lux-review
description: Live visual UI review and in-browser draft editing with LUX. Use when reviewing web pages, inspecting HTML/React apps, waiting for human visual feedback, and applying DOM/style diffs.
---

# LUX Live Visual Review & UI Editing

LUX injects a visual overlay into local web apps and dev servers. When the user requests a review:
1. Start the LUX server: \`lux <url-or-file> --port 4320\`
2. Call \`lux_wait_for_review\` to wait for the user to submit their edits.
3. Apply the returned diffs and component modifications to the codebase.
4. Mark the review as implemented with \`lux_update_status\`.
`;

    if (!options.dryRun) {
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(skillFile, skillContent);
    }
    console.log(`✓ \x1b[32mPortable Agent Skill:\x1b[0m ${skillFile}`);

    // 4. Auto-detect Claude Code ~/.claude/skills
    const claudeDir = path.join(os.homedir(), '.claude', 'skills', 'lux-review');
    try {
      if (fs.existsSync(path.join(os.homedir(), '.claude'))) {
        if (!options.dryRun) {
          fs.mkdirSync(claudeDir, { recursive: true });
          fs.writeFileSync(path.join(claudeDir, 'SKILL.md'), skillContent);
        }
        console.log(`✓ \x1b[32mClaude Code Skill Synced:\x1b[0m ${path.join(claudeDir, 'SKILL.md')}`);
      }
    } catch (e) {}

    console.log('\n\x1b[1m\x1b[32mAll done!\x1b[0m Any compatible agent (Antigravity, Claude, Cursor, Codex) can now use LUX.');
    console.log('Run \x1b[36mlux <url-or-file>\x1b[0m to start visual editing.\n');
  });

program.parse(process.argv);
