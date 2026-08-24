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

// Helper to safely merge lux into existing MCP JSON config
function mergeMcpConfig(filePath: string, dryRun: boolean): boolean {
  try {
    let config: any = { mcpServers: {} };
    if (fs.existsSync(filePath)) {
      try {
        config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!config.mcpServers) config.mcpServers = {};
      } catch (e) {
        config = { mcpServers: {} };
      }
    }

    config.mcpServers.lux = {
      command: 'npx',
      args: ['-y', 'lux-edit', 'mcp'],
    };

    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Command: Initialize Agent Plugins manifest, MCP config, and skills
program
  .command('init')
  .alias('install')
  .description('Initialize lux agent plugin, MCP configuration, and skills')
  .option('-g, --global', 'Install globally for all agents across all projects (~/.claude, Claude Desktop, Windsurf, Cursor)', false)
  .option('--dry-run', 'Show planned changes without writing files', false)
  .action(async (options) => {
    const home = os.homedir();
    const isGlobal = !!options.global;

    const skillContent = `---
name: lux
description: In-browser visual review and editing with lux. Use when the user asks to start visual editing, inspect UI, review in-browser comments, or runs /lux.
---

# lux Visual Review & UI Editing

lux injects an in-browser visual editing and annotation overlay into running web apps, dev servers, and static HTML files.

## Agent Workflow for \`/lux\`

When the user runs \`/lux\` (or asks to review / visually edit the UI):

### 1. Check for Pending Review
Call the instant MCP tool:
\`\`\`json
{
  "name": "lux_get_pending_review",
  "arguments": {}
}
\`\`\`

### 2. If Pending Comments or Edits Exist:
1. Read all returned annotations (pinned comments, element selectors, component names) and visual style mutations.
2. Locate the corresponding source files in the project (React/JSX/TSX components, HTML, Tailwind classes, CSS).
3. Apply the requested code edits directly to the codebase.
4. Saving the files automatically marks the feedback resolved and reloads the browser via lux's file watcher.

### 3. If No Pending Edits or Server Not Running:
1. Detect any running dev server (e.g. \`http://localhost:3000\`, \`http://localhost:5173\`) or static HTML file (e.g. \`./index.html\`).
2. Start the proxy in the background:
   \`\`\`bash
   lux <url-or-file> --port 4320
   \`\`\`
3. Share the review URL with the user: \`http://127.0.0.1:4320\`.
4. Inform the user: "Open \`http://127.0.0.1:4320\` in your browser. Press **C** to drop comment pins or **V** to adjust styles. When finished, run \`/lux\` again and I will apply your feedback directly to the code!"
`;

    if (isGlobal) {
      console.log('\nInstalling lux globally across user agent environments\n');

      // 1. Global Claude Code skill & config
      const claudeSkillDir = path.join(home, '.claude', 'skills', 'lux');
      const claudeSkillFile = path.join(claudeSkillDir, 'SKILL.md');
      if (!options.dryRun) {
        // Clean up legacy lux-review if present
        const legacyClaudeDir = path.join(home, '.claude', 'skills', 'lux-review');
        if (fs.existsSync(legacyClaudeDir)) {
          fs.rmSync(legacyClaudeDir, { recursive: true, force: true });
        }
        fs.mkdirSync(claudeSkillDir, { recursive: true });
        fs.writeFileSync(claudeSkillFile, skillContent);
      }
      console.log(`✓ Claude Code skill:     ${claudeSkillFile}`);

      const claudeMcpFile = path.join(home, '.claude', 'mcp.json');
      mergeMcpConfig(claudeMcpFile, options.dryRun);
      console.log(`✓ Claude Code MCP:       ${claudeMcpFile}`);

      // 2. Claude Desktop Config
      let claudeDesktopFile = '';
      if (process.platform === 'darwin') {
        claudeDesktopFile = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else if (process.platform === 'win32') {
        claudeDesktopFile = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      } else {
        claudeDesktopFile = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
      }

      if (mergeMcpConfig(claudeDesktopFile, options.dryRun)) {
        console.log(`✓ Claude Desktop MCP:   ${claudeDesktopFile}`);
      }

      // 3. Windsurf Config
      const windsurfMcpFile = path.join(home, '.codeium', 'windsurf', 'mcp_config.json');
      if (mergeMcpConfig(windsurfMcpFile, options.dryRun)) {
        console.log(`✓ Windsurf MCP:         ${windsurfMcpFile}`);
      }

      // 4. Cursor Config
      const cursorMcpFile = path.join(home, '.cursor', 'mcp.json');
      if (mergeMcpConfig(cursorMcpFile, options.dryRun)) {
        console.log(`✓ Cursor MCP:           ${cursorMcpFile}`);
      }

      console.log('\nGlobal initialization complete.');
      console.log('lux is now configured for your agents across all projects.\n');
    } else {
      const cwd = process.cwd();
      console.log('\nInitializing lux workspace configuration\n');

      // 1. Write standard mcp.json
      const mcpConfigPath = path.join(cwd, 'mcp.json');
      const mcpConfig = {
        mcpServers: {
          lux: {
            command: 'npx',
            args: ['-y', 'lux-edit', 'mcp'],
          },
        },
      };

      if (!options.dryRun) {
        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + '\n');
      }
      console.log(`✓ Created MCP config:    ${mcpConfigPath}`);

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
      console.log(`✓ Created plugin manifest: ${pluginManifestPath}`);

      // 3. Write standard skills/lux/SKILL.md
      const skillDir = path.join(cwd, 'skills', 'lux');
      const skillFile = path.join(skillDir, 'SKILL.md');

      if (!options.dryRun) {
        // Clean up legacy workspace lux-review if present
        const legacySkillDir = path.join(cwd, 'skills', 'lux-review');
        if (fs.existsSync(legacySkillDir)) {
          fs.rmSync(legacySkillDir, { recursive: true, force: true });
        }
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(skillFile, skillContent);
      }
      console.log(`✓ Created agent skill:   ${skillFile}`);

      // 4. Auto-detect and sync Claude Code ~/.claude/skills
      const claudeDir = path.join(home, '.claude', 'skills', 'lux');
      try {
        if (fs.existsSync(path.join(home, '.claude'))) {
          if (!options.dryRun) {
            const legacyClaudeDir = path.join(home, '.claude', 'skills', 'lux-review');
            if (fs.existsSync(legacyClaudeDir)) {
              fs.rmSync(legacyClaudeDir, { recursive: true, force: true });
            }
            fs.mkdirSync(claudeDir, { recursive: true });
            fs.writeFileSync(path.join(claudeDir, 'SKILL.md'), skillContent);
          }
          console.log(`✓ Synced Claude Code:    ${path.join(claudeDir, 'SKILL.md')}`);
        }
      } catch (e) {}

      console.log('\nWorkspace initialization complete.');
      console.log('Run `lux <url-or-file>` to start visual editing.\n');
    }
  });

program.parse(process.argv);
