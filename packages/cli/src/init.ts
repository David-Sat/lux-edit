import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

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

### 3. If No Pending Edits Found:
**IMPORTANT: NEVER restart, kill, or re-launch the lux server if it is already running! Restarting the server kills active browser sessions, resets WebSockets, and erases comments the user has pinned.**

Check if a review server is already running (e.g. check if port 4320 is listening or if a background \`lux\` process is active):

- **If the server IS ALREADY RUNNING:**
  - **DO NOT restart it.**
  - Simply inform the user:
    "The lux review server is running at \`http://127.0.0.1:4320\`. No submitted comments or edits were found yet.
    - If you added comments, make sure to save the comment pin or click **Submit Review** in the bottom-right drawer.
    - When ready, run \`/lux\` again and I will apply them directly to the code!"

- **If the server IS NOT RUNNING YET:**
  - Only start the server when no instance is currently running:
    1. Detect any running dev server (e.g. \`http://localhost:3000\`, \`http://localhost:5173\`) or static HTML file (e.g. \`./index.html\`).
    2. Start the proxy in the background:
       \`\`\`bash
       lux <url-or-file> --port 4320
       \`\`\`
    3. Share the review URL: \`http://127.0.0.1:4320\`.
    4. Inform the user: "Open \`http://127.0.0.1:4320\` in your browser. Press **C** to drop comment pins or **V** to adjust styles. When finished, run \`/lux\` again and I will apply your feedback directly to the code!"
`;

export const PLUGIN_MANIFEST = {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  name: 'lux-edit',
  description: 'Live User eXperience overlay for visual UI editing, design token tweaking, and multi-agent feedback',
  version: '0.6.0',
};

export const MCP_CONFIG_CONTENT = {
  mcpServers: {
    lux: {
      command: 'npx',
      args: ['-y', 'lux-edit', 'mcp'],
    },
  },
};

// Helper to write a self-contained Agent Plugin bundle (plugin.json + mcp_config.json + skills/lux/SKILL.md)
export function writePluginBundle(pluginDir: string, dryRun: boolean = false): boolean {
  try {
    if (!dryRun) {
      fs.mkdirSync(path.join(pluginDir, 'skills', 'lux'), { recursive: true });
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(PLUGIN_MANIFEST, null, 2) + '\n'
      );
      fs.writeFileSync(
        path.join(pluginDir, 'mcp_config.json'),
        JSON.stringify(MCP_CONFIG_CONTENT, null, 2) + '\n'
      );
      fs.writeFileSync(
        path.join(pluginDir, 'skills', 'lux', 'SKILL.md'),
        SKILL_CONTENT
      );
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Helper to remove an Agent Plugin bundle directory
export function removePluginBundle(pluginDir: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(pluginDir)) return false;
    if (!dryRun) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Smart detection to verify if an agent/tool is actually installed on the system
export function isAgentInstalled(
  agentKey: 'antigravity' | 'claude' | 'desktop' | 'cursor' | 'windsurf' | 'cline' | 'roo',
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): boolean {
  switch (agentKey) {
    case 'antigravity':
      return fs.existsSync(path.join(home, '.gemini'));
    case 'claude':
      return fs.existsSync(path.join(home, '.claude'));
    case 'desktop':
      if (platform === 'darwin') {
        return (
          fs.existsSync(path.join(home, 'Library', 'Application Support', 'Claude')) ||
          fs.existsSync('/Applications/Claude.app')
        );
      } else if (platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        return fs.existsSync(path.join(appData, 'Claude'));
      } else {
        return fs.existsSync(path.join(home, '.config', 'Claude'));
      }
    case 'cursor':
      if (platform === 'darwin') {
        return (
          fs.existsSync(path.join(home, '.cursor')) ||
          fs.existsSync('/Applications/Cursor.app')
        );
      }
      return fs.existsSync(path.join(home, '.cursor'));
    case 'windsurf':
      if (platform === 'darwin') {
        return (
          fs.existsSync(path.join(home, '.codeium', 'windsurf')) ||
          fs.existsSync('/Applications/Windsurf.app')
        );
      }
      return fs.existsSync(path.join(home, '.codeium', 'windsurf'));
    case 'cline': {
      let vscodeGlobal: string;
      if (platform === 'darwin') {
        vscodeGlobal = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage');
      } else if (platform === 'win32') {
        vscodeGlobal = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage');
      } else {
        vscodeGlobal = path.join(home, '.config', 'Code', 'User', 'globalStorage');
      }
      return fs.existsSync(path.join(vscodeGlobal, 'saoudrizwan.claude-dev'));
    }
    case 'roo': {
      let vscodeGlobal: string;
      if (platform === 'darwin') {
        vscodeGlobal = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage');
      } else if (platform === 'win32') {
        vscodeGlobal = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage');
      } else {
        vscodeGlobal = path.join(home, '.config', 'Code', 'User', 'globalStorage');
      }
      return fs.existsSync(path.join(vscodeGlobal, 'rooveterinaryinc.roo-cline'));
    }
    default:
      return false;
  }
}

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
  // Plugin-compatible agents
  antigravityPlugin: string;
  antigravityMcp: string;
  antigravitySkill: string;
  claudePlugin: string;
  claudeCodeMcp: string;
  claudeCodeSkill: string;
  // Major standalone MCP agents
  claudeDesktopMcp: string;
  windsurfMcp: string;
  cursorMcp: string;
  clineMcp?: string;
  rooCodeMcp?: string;
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

  // VS Code globalStorage base directory (for optional legacy path resolution)
  let vscodeGlobalStorage: string;
  if (platform === 'darwin') {
    vscodeGlobalStorage = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage');
  } else if (platform === 'win32') {
    vscodeGlobalStorage = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage');
  } else {
    vscodeGlobalStorage = path.join(home, '.config', 'Code', 'User', 'globalStorage');
  }

  return {
    antigravityPlugin: path.join(home, '.gemini', 'config', 'plugins', 'lux-edit'),
    antigravityMcp: path.join(home, '.gemini', 'config', 'mcp_config.json'),
    antigravitySkill: path.join(home, '.gemini', 'config', 'skills', 'lux', 'SKILL.md'),
    claudePlugin: path.join(home, '.claude', 'plugins', 'lux-edit'),
    claudeCodeMcp: path.join(home, '.claude', 'mcp.json'),
    claudeCodeSkill: path.join(home, '.claude', 'skills', 'lux', 'SKILL.md'),
    claudeDesktopMcp,
    windsurfMcp: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    cursorMcp: path.join(home, '.cursor', 'mcp.json'),
    clineMcp: path.join(vscodeGlobalStorage, 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    rooCodeMcp: path.join(vscodeGlobalStorage, 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
  };
}

// Helper to install into an explicit custom JSON file or directory path
export function installCustomPath(
  targetPath: string,
  dryRun: boolean = false,
  log: (msg: string) => void = console.log
): boolean {
  try {
    const resolvedPath = path.resolve(targetPath);
    if (resolvedPath.endsWith('.json')) {
      if (mergeMcpConfig(resolvedPath, dryRun)) {
        log(`✓ Configured custom MCP file: ${resolvedPath}`);
        return true;
      }
    } else {
      const mcpPath = path.join(resolvedPath, 'mcp.json');
      const skillPath = path.join(resolvedPath, 'skills', 'lux', 'SKILL.md');
      if (mergeMcpConfig(mcpPath, dryRun)) {
        log(`✓ Created custom MCP config:  ${mcpPath}`);
      }
      if (writeSkillFile(skillPath, dryRun)) {
        log(`✓ Created custom skill file:  ${skillPath}`);
      }
      return true;
    }
  } catch (err: any) {
    log(`✗ Failed to configure custom path ${targetPath}: ${err.message}`);
  }
  return false;
}

// Helper to uninstall from an explicit custom JSON file or directory path
export function uninstallCustomPath(
  targetPath: string,
  dryRun: boolean = false,
  log: (msg: string) => void = console.log
): boolean {
  try {
    const resolvedPath = path.resolve(targetPath);
    if (resolvedPath.endsWith('.json')) {
      if (removeMcpConfig(resolvedPath, dryRun)) {
        log(`✓ Removed lux from custom file: ${resolvedPath}`);
        return true;
      }
    } else {
      const mcpPath = path.join(resolvedPath, 'mcp.json');
      const skillPath = path.join(resolvedPath, 'skills', 'lux', 'SKILL.md');
      removeMcpConfig(mcpPath, dryRun);
      removeSkillFile(skillPath, dryRun);
      log(`✓ Cleaned custom directory:     ${resolvedPath}`);
      return true;
    }
  } catch (err: any) {
    log(`✗ Failed to uninstall from custom path ${targetPath}: ${err.message}`);
  }
  return false;
}

// Interactive agent selector for terminal TTY environments
export async function promptAgentSelection(
  candidates: Array<{ key: string; name: string; detected: boolean }>
): Promise<string[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nSelect agents to configure with lux:');
  candidates.forEach((c, idx) => {
    const status = c.detected ? 'detected' : 'not detected';
    const mark = c.detected ? '●' : '○';
    console.log(`  ${idx + 1}. [${mark}] ${c.name.padEnd(20)} (${status})`);
  });
  console.log('  a. Configure all');
  console.log('  q. Cancel\n');

  return new Promise((resolve) => {
    rl.question('Enter numbers to select (e.g. 1,2), "a" for all, or press ENTER for detected defaults: ', (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'q' || trimmed === 'none') {
        resolve([]);
        return;
      }
      if (trimmed === 'a' || trimmed === 'all') {
        resolve(candidates.map((c) => c.key));
        return;
      }
      if (trimmed === '') {
        resolve(candidates.filter((c) => c.detected).map((c) => c.key));
        return;
      }
      const selectedKeys: string[] = [];
      const parts = trimmed.split(/[\s,]+/);
      for (const part of parts) {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= candidates.length) {
          selectedKeys.push(candidates[num - 1].key);
        }
      }
      resolve(selectedKeys);
    });
  });
}

export interface InitOptions {
  global?: boolean;
  dryRun?: boolean;
  all?: boolean;
  yes?: boolean;
  agent?: string;
  path?: string;
  home?: string;
  cwd?: string;
  logger?: (msg: string) => void;
}

export async function runInit(options: InitOptions = {}) {
  const home = options.home || os.homedir();
  const cwd = options.cwd || process.cwd();
  const dryRun = !!options.dryRun;
  const isGlobal = !!options.global;
  const forceAll = !!options.all;
  const targetAgent = options.agent?.toLowerCase();
  const customPath = options.path;
  const log = options.logger || console.log;

  // 1. Custom Path Mode
  if (customPath) {
    log(`\nConfiguring custom path: ${customPath}\n`);
    installCustomPath(customPath, dryRun, log);
    return;
  }

  // 2. Global Agent Installation Mode
  if (isGlobal) {
    log('\nInstalling lux globally across user agent environments\n');
    const paths = getAgentConfigPaths(home);

    const agentCandidates: Array<{
      key: 'antigravity' | 'claude' | 'cursor' | 'windsurf' | 'desktop';
      name: string;
      detected: boolean;
    }> = [
      { key: 'antigravity', name: 'Google Antigravity', detected: isAgentInstalled('antigravity', home) },
      { key: 'claude', name: 'Claude Code', detected: isAgentInstalled('claude', home) },
      { key: 'cursor', name: 'Cursor', detected: isAgentInstalled('cursor', home) },
      { key: 'windsurf', name: 'Windsurf', detected: isAgentInstalled('windsurf', home) },
      { key: 'desktop', name: 'Claude Desktop', detected: isAgentInstalled('desktop', home) },
    ];

    let selectedAgentKeys: string[];
    if (targetAgent) {
      selectedAgentKeys = [targetAgent];
    } else if (forceAll) {
      selectedAgentKeys = agentCandidates.map((c) => c.key);
    } else if (!options.yes && process.stdin.isTTY && process.stdout.isTTY) {
      selectedAgentKeys = await promptAgentSelection(agentCandidates);
      if (selectedAgentKeys.length === 0) {
        log('Initialization cancelled (no agents selected).\n');
        return;
      }
    } else {
      // Default non-interactive or --yes: select all detected agents
      selectedAgentKeys = agentCandidates.filter((c) => c.detected).map((c) => c.key);
      if (selectedAgentKeys.length === 0) {
        selectedAgentKeys = ['antigravity', 'claude'];
      }
    }

    const shouldTarget = (key: string) => selectedAgentKeys.includes(key);

    // Tier 1: Plugin-Compatible Agents (Agent Plugin Standard: plugin.json + mcp_config.json + skills/)
    if (shouldTarget('antigravity') || shouldTarget('gemini')) {
      if (writePluginBundle(paths.antigravityPlugin, dryRun)) {
        log(`✓ Antigravity plugin:     ${paths.antigravityPlugin} (Skills + MCP)`);
        // Clean up legacy standalone skill & mcp if present to prevent duplicate registrations
        if (fs.existsSync(paths.antigravitySkill)) {
          removeSkillFile(paths.antigravitySkill, dryRun);
        }
        if (fs.existsSync(paths.antigravityMcp)) {
          removeMcpConfig(paths.antigravityMcp, dryRun);
        }
      }
    }

    if (shouldTarget('claude') || shouldTarget('claude-code')) {
      if (!dryRun) {
        const legacyClaudeDir = path.join(home, '.claude', 'skills', 'lux-review');
        if (fs.existsSync(legacyClaudeDir)) {
          fs.rmSync(legacyClaudeDir, { recursive: true, force: true });
        }
      }
      if (writePluginBundle(paths.claudePlugin, dryRun)) {
        log(`✓ Claude Code plugin:     ${paths.claudePlugin} (Skills + MCP)`);
      }
      // Also write standard ~/.claude/skills and mcp.json for Claude Code CLI backward compatibility
      if (writeSkillFile(paths.claudeCodeSkill, dryRun)) {
        log(`✓ Claude Code skill:      ${paths.claudeCodeSkill}`);
      }
      if (mergeMcpConfig(paths.claudeCodeMcp, dryRun)) {
        log(`✓ Claude Code MCP:        ${paths.claudeCodeMcp}`);
      }
    }

    // Tier 2: Standalone MCP Clients (Cursor, Windsurf, Claude Desktop)
    const standaloneClients: Array<{
      key: 'desktop' | 'windsurf' | 'cursor';
      name: string;
      path: string;
    }> = [
      { key: 'desktop', name: 'Claude Desktop', path: paths.claudeDesktopMcp },
      { key: 'windsurf', name: 'Windsurf', path: paths.windsurfMcp },
      { key: 'cursor', name: 'Cursor', path: paths.cursorMcp },
    ];

    for (const client of standaloneClients) {
      if (shouldTarget(client.key)) {
        if (mergeMcpConfig(client.path, dryRun)) {
          log(`✓ ${client.name.padEnd(16)}:    ${client.path}`);
        }
      } else {
        const detected = isAgentInstalled(client.key, home);
        log(`- ${client.name.padEnd(16)}:    (${detected ? 'skipped' : 'not detected, skipped'})`);
      }
    }

    log('\nGlobal initialization complete.');
    log('lux is now configured for your agents across all projects.\n');
  } else {
    // 3. Workspace Initialization Mode (Agent Plugin Standard)
    log('\nInitializing lux workspace configuration (Agent Plugin standard)\n');

    // 1. Write standard plugin.json
    const pluginManifestPath = path.join(cwd, 'plugin.json');
    if (!dryRun) {
      fs.writeFileSync(pluginManifestPath, JSON.stringify(PLUGIN_MANIFEST, null, 2) + '\n');
    }
    log(`✓ Created plugin manifest: ${pluginManifestPath}`);

    // 2. Write standard mcp_config.json
    const pluginMcpPath = path.join(cwd, 'mcp_config.json');
    if (!dryRun) {
      fs.writeFileSync(pluginMcpPath, JSON.stringify(MCP_CONFIG_CONTENT, null, 2) + '\n');
    }
    log(`✓ Created plugin MCP:     ${pluginMcpPath}`);

    // 3. Write standard mcp.json and .mcp.json (universal across Cursor, Claude Code, Windsurf, Zed)
    const mcpConfigPath = path.join(cwd, 'mcp.json');
    const dotMcpConfigPath = path.join(cwd, '.mcp.json');
    if (!dryRun) {
      fs.writeFileSync(mcpConfigPath, JSON.stringify(MCP_CONFIG_CONTENT, null, 2) + '\n');
      fs.writeFileSync(dotMcpConfigPath, JSON.stringify(MCP_CONFIG_CONTENT, null, 2) + '\n');
    }
    log(`✓ Created MCP configs:    ${mcpConfigPath} & .mcp.json`);

    // 4. Write standard skills/lux/SKILL.md
    const skillFile = path.join(cwd, 'skills', 'lux', 'SKILL.md');
    if (!dryRun) {
      const legacySkillDir = path.join(cwd, 'skills', 'lux-review');
      if (fs.existsSync(legacySkillDir)) {
        fs.rmSync(legacySkillDir, { recursive: true, force: true });
      }
    }
    if (writeSkillFile(skillFile, dryRun)) {
      log(`✓ Created agent skill:    ${skillFile}`);
    }

    // 5. Auto-detect and sync Claude Code ~/.claude/skills
    const claudeDir = path.join(home, '.claude');
    if (fs.existsSync(claudeDir)) {
      const claudeSkill = path.join(claudeDir, 'skills', 'lux', 'SKILL.md');
      if (writeSkillFile(claudeSkill, dryRun)) {
        log(`✓ Synced Claude Code:     ${claudeSkill}`);
      }
    }

    // 6. Auto-detect and sync Antigravity / Gemini ~/.gemini/config/plugins/lux-edit
    const geminiDir = path.join(home, '.gemini');
    if (fs.existsSync(geminiDir)) {
      const geminiPluginDir = path.join(geminiDir, 'config', 'plugins', 'lux-edit');
      if (writePluginBundle(geminiPluginDir, dryRun)) {
        log(`✓ Synced Antigravity:     ${geminiPluginDir}`);
      }
    }

    log('\nWorkspace initialization complete.');
    log('Run `lux <url-or-file>` to start visual editing.\n');
  }
}

export interface UninstallOptions {
  global?: boolean;
  dryRun?: boolean;
  agent?: string;
  path?: string;
  home?: string;
  cwd?: string;
  logger?: (msg: string) => void;
}

export async function runUninstall(options: UninstallOptions = {}) {
  const home = options.home || os.homedir();
  const cwd = options.cwd || process.cwd();
  const dryRun = !!options.dryRun;
  const isGlobal = !!options.global;
  const targetAgent = options.agent?.toLowerCase();
  const customPath = options.path;
  const log = options.logger || console.log;

  // 1. Custom Path Mode
  if (customPath) {
    log(`\nRemoving lux from custom path: ${customPath}\n`);
    uninstallCustomPath(customPath, dryRun, log);
    return;
  }

  // 2. Global Mode
  if (isGlobal) {
    log('\nRemoving lux globally from user agent environments\n');
    const paths = getAgentConfigPaths(home);
    const shouldTarget = (name: string) => !targetAgent || targetAgent === name || targetAgent === 'all';

    // Tier 1: Google Antigravity / Gemini
    if (shouldTarget('antigravity') || shouldTarget('gemini')) {
      if (removePluginBundle(paths.antigravityPlugin, dryRun)) {
        log(`✓ Removed Antigravity plugin: ${paths.antigravityPlugin}`);
      }
      if (removeSkillFile(paths.antigravitySkill, dryRun)) {
        log(`✓ Removed Antigravity skill:  ${paths.antigravitySkill}`);
      }
      if (removeMcpConfig(paths.antigravityMcp, dryRun)) {
        log(`✓ Removed Antigravity MCP:    ${paths.antigravityMcp}`);
      }
    }

    // Tier 1: Claude Code
    if (shouldTarget('claude') || shouldTarget('claude-code')) {
      if (removePluginBundle(paths.claudePlugin, dryRun)) {
        log(`✓ Removed Claude Code plugin: ${paths.claudePlugin}`);
      }
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
    }

    // Tier 2: Standalone MCP Clients
    const standaloneClients: Array<{
      key: 'desktop' | 'windsurf' | 'cursor';
      name: string;
      path: string;
    }> = [
      { key: 'desktop', name: 'Claude Desktop', path: paths.claudeDesktopMcp },
      { key: 'windsurf', name: 'Windsurf', path: paths.windsurfMcp },
      { key: 'cursor', name: 'Cursor', path: paths.cursorMcp },
    ];

    for (const client of standaloneClients) {
      if (!shouldTarget(client.key) && !shouldTarget(client.name.toLowerCase().replace(/\s+/g, ''))) {
        continue;
      }
      if (removeMcpConfig(client.path, dryRun)) {
        log(`✓ Removed ${client.name.padEnd(16)}: ${client.path}`);
      }
    }

    log('\nGlobal uninstallation complete.');
    log('lux MCP servers and skills have been removed from your agents.\n');
  } else {
    // 3. Workspace Mode
    log('\nRemoving lux from workspace\n');

    const mcpConfigPath = path.join(cwd, 'mcp.json');
    const dotMcpConfigPath = path.join(cwd, '.mcp.json');
    const pluginManifestPath = path.join(cwd, 'plugin.json');
    const pluginMcpPath = path.join(cwd, 'mcp_config.json');
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
    if (fs.existsSync(pluginMcpPath)) {
      if (!dryRun) fs.rmSync(pluginMcpPath, { force: true });
      log(`✓ Removed plugin MCP:         ${pluginMcpPath}`);
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
