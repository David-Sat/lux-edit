import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const SKILL_CONTENT = `---
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

// Helper to safely merge lux into existing MCP JSON config and clean legacy keys
export function mergeMcpConfig(filePath: string, dryRun: boolean = false): boolean {
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

    // Clean legacy server names if present
    delete config.mcpServers['lux-review'];
    delete config.mcpServers['visual-edit'];

    // Update with current standard configuration
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

// Helper to safely remove lux from existing MCP JSON config
export function removeMcpConfig(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    let config: any;
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      return false;
    }

    if (!config || !config.mcpServers) return false;

    let modified = false;
    ['lux', 'lux-review', 'visual-edit'].forEach((key) => {
      if (config.mcpServers && key in config.mcpServers) {
        delete config.mcpServers[key];
        modified = true;
      }
    });

    if (modified && !dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    }
    return modified;
  } catch (err) {
    return false;
  }
}

export function writeSkillFile(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, SKILL_CONTENT);
    }
    return true;
  } catch (err) {
    return false;
  }
}

export function removeSkillFile(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    if (!dryRun) {
      fs.rmSync(filePath, { force: true });
      const parentDir = path.dirname(filePath);
      if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
        fs.rmdirSync(parentDir);
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

export interface AgentPaths {
  antigravityMcp: string;
  antigravitySkill: string;
  claudeCodeMcp: string;
  claudeCodeSkill: string;
  claudeDesktopMcp: string;
  windsurfMcp: string;
  cursorMcp: string;
  clineMcp: string;
  rooCodeMcp: string;
}

export function getAgentConfigPaths(
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): AgentPaths {
  // Claude Desktop config path
  let claudeDesktopMcp: string;
  if (platform === 'darwin') {
    claudeDesktopMcp = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    claudeDesktopMcp = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else {
    claudeDesktopMcp = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }

  // VS Code globalStorage base directory
  let vscodeGlobalStorage: string;
  if (platform === 'darwin') {
    vscodeGlobalStorage = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage');
  } else if (platform === 'win32') {
    vscodeGlobalStorage = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage');
  } else {
    vscodeGlobalStorage = path.join(home, '.config', 'Code', 'User', 'globalStorage');
  }

  return {
    antigravityMcp: path.join(home, '.gemini', 'config', 'mcp_config.json'),
    antigravitySkill: path.join(home, '.gemini', 'config', 'skills', 'lux', 'SKILL.md'),
    claudeCodeMcp: path.join(home, '.claude', 'mcp.json'),
    claudeCodeSkill: path.join(home, '.claude', 'skills', 'lux', 'SKILL.md'),
    claudeDesktopMcp,
    windsurfMcp: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    cursorMcp: path.join(home, '.cursor', 'mcp.json'),
    clineMcp: path.join(vscodeGlobalStorage, 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    rooCodeMcp: path.join(vscodeGlobalStorage, 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
  };
}

export interface InitOptions {
  global?: boolean;
  dryRun?: boolean;
  home?: string;
  cwd?: string;
  logger?: (msg: string) => void;
}

export function runInit(options: InitOptions = {}) {
  const home = options.home || os.homedir();
  const cwd = options.cwd || process.cwd();
  const dryRun = !!options.dryRun;
  const isGlobal = !!options.global;
  const log = options.logger || console.log;

  if (isGlobal) {
    log('\nInstalling lux globally across user agent environments\n');
    const paths = getAgentConfigPaths(home);

    // 1. Google Antigravity / Gemini
    if (writeSkillFile(paths.antigravitySkill, dryRun)) {
      log(`✓ Antigravity skill:     ${paths.antigravitySkill}`);
    }
    if (mergeMcpConfig(paths.antigravityMcp, dryRun)) {
      log(`✓ Antigravity MCP:       ${paths.antigravityMcp}`);
    }

    // 2. Claude Code
    if (!dryRun) {
      const legacyClaudeDir = path.join(home, '.claude', 'skills', 'lux-review');
      if (fs.existsSync(legacyClaudeDir)) {
        fs.rmSync(legacyClaudeDir, { recursive: true, force: true });
      }
    }
    if (writeSkillFile(paths.claudeCodeSkill, dryRun)) {
      log(`✓ Claude Code skill:     ${paths.claudeCodeSkill}`);
    }
    if (mergeMcpConfig(paths.claudeCodeMcp, dryRun)) {
      log(`✓ Claude Code MCP:       ${paths.claudeCodeMcp}`);
    }

    // 3. Claude Desktop
    if (mergeMcpConfig(paths.claudeDesktopMcp, dryRun)) {
      log(`✓ Claude Desktop MCP:    ${paths.claudeDesktopMcp}`);
    }

    // 4. Windsurf
    if (mergeMcpConfig(paths.windsurfMcp, dryRun)) {
      log(`✓ Windsurf MCP:          ${paths.windsurfMcp}`);
    }

    // 5. Cursor
    if (mergeMcpConfig(paths.cursorMcp, dryRun)) {
      log(`✓ Cursor MCP:            ${paths.cursorMcp}`);
    }

    // 6. Cline (VS Code extension)
    if (mergeMcpConfig(paths.clineMcp, dryRun)) {
      log(`✓ Cline MCP:             ${paths.clineMcp}`);
    }

    // 7. Roo Code (VS Code extension)
    if (mergeMcpConfig(paths.rooCodeMcp, dryRun)) {
      log(`✓ Roo Code MCP:          ${paths.rooCodeMcp}`);
    }

    log('\nGlobal initialization complete.');
    log('lux is now configured for your agents across all projects.\n');
  } else {
    log('\nInitializing lux workspace configuration\n');

    const mcpConfig = {
      mcpServers: {
        lux: {
          command: 'npx',
          args: ['-y', 'lux-edit', 'mcp'],
        },
      },
    };

    // 1. Write standard mcp.json and .mcp.json
    const mcpConfigPath = path.join(cwd, 'mcp.json');
    const dotMcpConfigPath = path.join(cwd, '.mcp.json');
    if (!dryRun) {
      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + '\n');
      fs.writeFileSync(dotMcpConfigPath, JSON.stringify(mcpConfig, null, 2) + '\n');
    }
    log(`✓ Created MCP config:    ${mcpConfigPath}`);

    // 2. Write standard plugin.json
    const pluginManifestPath = path.join(cwd, 'plugin.json');
    const pluginManifest = {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'lux-edit',
      description: 'Live in-browser visual editing overlay for web apps and AI coding agents',
      version: '0.2.0',
    };
    if (!dryRun) {
      fs.writeFileSync(pluginManifestPath, JSON.stringify(pluginManifest, null, 2) + '\n');
    }
    log(`✓ Created plugin manifest: ${pluginManifestPath}`);

    // 3. Write standard skills/lux/SKILL.md
    const skillFile = path.join(cwd, 'skills', 'lux', 'SKILL.md');
    if (!dryRun) {
      const legacySkillDir = path.join(cwd, 'skills', 'lux-review');
      if (fs.existsSync(legacySkillDir)) {
        fs.rmSync(legacySkillDir, { recursive: true, force: true });
      }
    }
    if (writeSkillFile(skillFile, dryRun)) {
      log(`✓ Created agent skill:   ${skillFile}`);
    }

    // 4. Auto-detect and sync Claude Code ~/.claude/skills
    const claudeDir = path.join(home, '.claude');
    if (fs.existsSync(claudeDir)) {
      const claudeSkill = path.join(claudeDir, 'skills', 'lux', 'SKILL.md');
      if (writeSkillFile(claudeSkill, dryRun)) {
        log(`✓ Synced Claude Code:    ${claudeSkill}`);
      }
    }

    // 5. Auto-detect and sync Antigravity / Gemini ~/.gemini/config/skills
    const geminiDir = path.join(home, '.gemini');
    if (fs.existsSync(geminiDir)) {
      const geminiSkill = path.join(geminiDir, 'config', 'skills', 'lux', 'SKILL.md');
      if (writeSkillFile(geminiSkill, dryRun)) {
        log(`✓ Synced Antigravity:    ${geminiSkill}`);
      }
    }

    log('\nWorkspace initialization complete.');
    log('Run `lux <url-or-file>` to start visual editing.\n');
  }
}

export interface UninstallOptions {
  global?: boolean;
  dryRun?: boolean;
  home?: string;
  cwd?: string;
  logger?: (msg: string) => void;
}

export function runUninstall(options: UninstallOptions = {}) {
  const home = options.home || os.homedir();
  const cwd = options.cwd || process.cwd();
  const dryRun = !!options.dryRun;
  const isGlobal = !!options.global;
  const log = options.logger || console.log;

  if (isGlobal) {
    log('\nRemoving lux globally from user agent environments\n');
    const paths = getAgentConfigPaths(home);

    // 1. Google Antigravity / Gemini
    if (removeSkillFile(paths.antigravitySkill, dryRun)) {
      log(`✓ Removed Antigravity skill:  ${paths.antigravitySkill}`);
    }
    if (removeMcpConfig(paths.antigravityMcp, dryRun)) {
      log(`✓ Removed Antigravity MCP:    ${paths.antigravityMcp}`);
    }

    // 2. Claude Code
    if (removeSkillFile(paths.claudeCodeSkill, dryRun)) {
      log(`✓ Removed Claude Code skill:  ${paths.claudeCodeSkill}`);
    }
    if (removeMcpConfig(paths.claudeCodeMcp, dryRun)) {
      log(`✓ Removed Claude Code MCP:    ${paths.claudeCodeMcp}`);
    }
    if (!dryRun) {
      const legacyClaudeDir = path.join(home, '.claude', 'skills', 'lux-review');
      if (fs.existsSync(legacyClaudeDir)) {
        fs.rmSync(legacyClaudeDir, { recursive: true, force: true });
      }
    }

    // 3. Claude Desktop
    if (removeMcpConfig(paths.claudeDesktopMcp, dryRun)) {
      log(`✓ Removed Claude Desktop MCP: ${paths.claudeDesktopMcp}`);
    }

    // 4. Windsurf
    if (removeMcpConfig(paths.windsurfMcp, dryRun)) {
      log(`✓ Removed Windsurf MCP:       ${paths.windsurfMcp}`);
    }

    // 5. Cursor
    if (removeMcpConfig(paths.cursorMcp, dryRun)) {
      log(`✓ Removed Cursor MCP:         ${paths.cursorMcp}`);
    }

    // 6. Cline
    if (removeMcpConfig(paths.clineMcp, dryRun)) {
      log(`✓ Removed Cline MCP:          ${paths.clineMcp}`);
    }

    // 7. Roo Code
    if (removeMcpConfig(paths.rooCodeMcp, dryRun)) {
      log(`✓ Removed Roo Code MCP:       ${paths.rooCodeMcp}`);
    }

    log('\nGlobal uninstallation complete.');
    log('lux MCP servers and skills have been removed from your agents.\n');
  } else {
    log('\nRemoving lux from workspace\n');

    const mcpConfigPath = path.join(cwd, 'mcp.json');
    const dotMcpConfigPath = path.join(cwd, '.mcp.json');
    const pluginManifestPath = path.join(cwd, 'plugin.json');
    const skillFile = path.join(cwd, 'skills', 'lux', 'SKILL.md');
    const legacySkillFile = path.join(cwd, 'skills', 'lux-review', 'SKILL.md');

    if (removeMcpConfig(mcpConfigPath, dryRun) || (fs.existsSync(mcpConfigPath) && removeSkillFile(mcpConfigPath, dryRun))) {
      log(`✓ Cleaned MCP config:         ${mcpConfigPath}`);
    }
    if (removeMcpConfig(dotMcpConfigPath, dryRun) || (fs.existsSync(dotMcpConfigPath) && removeSkillFile(dotMcpConfigPath, dryRun))) {
      log(`✓ Cleaned MCP config:         ${dotMcpConfigPath}`);
    }
    if (fs.existsSync(pluginManifestPath)) {
      if (!dryRun) fs.rmSync(pluginManifestPath, { force: true });
      log(`✓ Removed plugin manifest:    ${pluginManifestPath}`);
    }
    if (removeSkillFile(skillFile, dryRun)) {
      log(`✓ Removed workspace skill:    ${skillFile}`);
    }
    if (removeSkillFile(legacySkillFile, dryRun)) {
      log(`✓ Removed legacy skill:       ${legacySkillFile}`);
    }

    log('\nWorkspace cleanup complete.\n');
  }
}
