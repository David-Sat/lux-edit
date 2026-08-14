#!/usr/bin/env node
import { Command } from 'commander';
import { VisualEditServer } from '@visual-edit/server';
import { startMcpStdio } from '@visual-edit/mcp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const program = new Command();

program
  .name('visual-edit')
  .description('Live Visual Edit Overlay for Web Apps & AI Coding Agents (MCP)')
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
      console.log('\n🚀  \x1b[1m\x1b[36mLive Visual Edit Overlay Server\x1b[0m');
      console.log(`👉  Review URL: \x1b[1m\x1b[32m${reviewUrl}\x1b[0m`);
      console.log(`📦  Target:     \x1b[90m${normalizedTarget}\x1b[0m`);
      console.log(`⚡  MCP Server: \x1b[90mRun 'visual-edit mcp' in your agent\x1b[0m`);
      console.log('\n\x1b[90mPress Ctrl+C to stop.\x1b[0m\n');
    } catch (err: any) {
      console.error('\x1b[31mFailed to start visual-edit server:\x1b[0m', err.message);
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

// Command: Install agent skills & MCP config
program
  .command('install')
  .description('Install agent skills and MCP server configuration')
  .option('--mcp-json', 'Create local .mcp.json file', true)
  .action(async () => {
    const cwd = process.cwd();
    const mcpConfigPath = path.join(cwd, '.mcp.json');

    const mcpConfig = {
      mcpServers: {
        'visual-edit': {
          command: 'npx',
          args: ['-y', 'visual-edit', 'mcp'],
        },
      },
    };

    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + '\n');
    console.log(`✓ Created project MCP configuration: ${mcpConfigPath}`);

    // Install Claude Code skill if ~/.claude exists
    const claudeDir = path.join(os.homedir(), '.claude', 'skills');
    if (fs.existsSync(path.join(os.homedir(), '.claude'))) {
      const skillDir = path.join(claudeDir, 'visual-edit');
      fs.mkdirSync(skillDir, { recursive: true });
      const skillMd = `# visual-edit skill
Use this skill when reviewing or implementing visual UI modifications requested through visual-edit.
1. Run \`visual_edit_list_sessions\` to inspect pending drafts.
2. Call \`visual_edit_get_session\` to read detailed DOM and CSS diffs.
3. Apply the changes cleanly to the repository code.
4. Mark the session as \`implemented\` via \`visual_edit_update_status\`.
`;
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd);
      console.log(`✓ Installed Claude Code skill: ${path.join(skillDir, 'SKILL.md')}`);
    }
  });

program.parse(process.argv);
