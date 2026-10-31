import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

export const SKILL_CONTENT = `---
name: lux
description: In-browser visual review and UI editing with lux for local projects, dev servers (localhost/127.0.0.1), and static HTML files where code changes will be applied directly to the user's codebase. Use when the user wants to visually edit or review their own app, or runs /lux. Do NOT use for external third-party websites or online articles (use /lux-web instead).
---

# lux visual review and UI editing

> [!NOTE]
> **User-Hosted Apps Only:** \`lux\` is for reviewing and visually modifying the user's own codebase (running local dev servers like \`http://localhost:3000\` or local files). For exploring or tearing down external, third-party websites and online articles, use \`/lux-web\`.

lux runs an in-browser visual editing overlay on running web apps, dev servers, and static HTML files.

## Workflow for \`/lux\`

When the user runs \`/lux\`, or asks to review visual edits and comments:

### 1. Check for pending review
Call \`lux_get_pending_review\`. Always pass \`workspaceDir\` with the absolute path of your current workspace root:

\`\`\`json
{
  "name": "lux_get_pending_review",
  "arguments": {
    "workspaceDir": "<absolute-path-to-current-workspace>"
  }
}
\`\`\`

Passing \`workspaceDir\` ensures lux finds \`.visual-edit/sessions.jsonl\` even when your IDE starts the MCP server from a global plugin folder.

### 2. When comments or edits exist
1. Read the returned annotations and style mutations.
2. Find the relevant component files in the project (React/JSX/TSX, HTML, Tailwind classes, or CSS).
3. Apply the requested code edits directly to the codebase.
4. Save the files. The file watcher detects changes, resolves the active review, and reloads the browser.

### 3. When no pending edits are found
Do not restart or kill the lux server if it is already running. Restarting drops active browser sessions and clears pinned comments.

Check whether a review server is already running on port 4320:

- **If the server is running:**
  Tell the user:
  "The lux review server is running at \`http://127.0.0.1:4320\`. No submitted comments or edits were found. Save your comment pins or click Submit Review in the drawer, then run \`/lux\` again."

- **If the server is not running:**
  1. Find the running dev server URL (e.g. \`http://localhost:3000\`, \`http://localhost:5173\`) or static HTML file (e.g. \`./index.html\`).
  2. Start lux in the background:
     \`\`\`bash
     lux <url-or-file> --port 4320
     \`\`\`
  3. Tell the user:
     "Open \`http://127.0.0.1:4320\` in your browser. Press C to drop comment pins, R to record a voice walkthrough, or V to adjust styles. When finished, run \`/lux\` again and I will apply your changes to the code."
`;

export const SKILL_WEB_CONTENT = `---
name: lux-web
description: In-browser visual inspection, teardown, discussion, and explanation of external, third-party websites, online articles, and competitor designs using lux. Use EXCLUSIVELY for external sources and remote internet pages that are NOT hosted by the user and where there is no local codebase to modify. Do NOT use for user-hosted apps, local dev servers, or local HTML files (use /lux instead).
---

# lux-web: Web Research, UI Teardown & Article Discussion

> [!IMPORTANT]
> **External Sources Only:** \`lux-web\` is strictly for inspecting, discussing, and tearing down **external, third-party websites, online articles, and design references** on the internet where there is no local codebase to modify. If the user wants to visually edit, review, or modify an application or website hosted by themselves (e.g., \`localhost\`, dev servers, or local files), use \`/lux\` instead.

\`lux-web\` proxies live external websites, online articles, and public web apps through lux's in-browser overlay, allowing users to drop comment pins, highlight phrases, and discuss the design, architecture, or content directly with an AI coding agent.

## Workflow for \`/lux-web\`

When the user runs \`/lux-web\` or asks to inspect/discuss an external URL:

### 1. Starting or Pointing \`lux\` at an External Web Target

1. Identify the external target URL (e.g. \`https://example.com\`, \`https://news.ycombinator.com\`, \`https://overreacted.io\`).
   - If the user has not specified a URL, ask them for the target URL.
2. Check for an available port (default \`4320\`, fallback to \`4330\` or next free port if \`4320\` is already in use by another session).
3. Start the \`lux\` review server in the background:
   \`\`\`bash
   lux <url> --port <port>
   \`\`\`
4. Tell the user:
   "The lux web review server is running at \`http://127.0.0.1:<port>\` targeting \`<url>\`.
   - Press **C** to drop comment pins on specific elements (headers, cards, buttons) or highlight text to comment on exact passages.
   - Press **R** to record a voice walkthrough explaining the design or architecture.
   - Press **V** to inspect computed styles, layout rules, and DOM elements.
   - When finished, click **Submit Review** in the bottom drawer, then run \`/lux-web\` (or ask me to review)!"

### 2. Reviewing Comments & In-Browser Discussion

When the user asks to review, or runs \`/lux-web\`:

1. Call \`lux_get_pending_review\` (or probe the live server API \`http://127.0.0.1:<port>/__visual_edit__/api/pending\`).
2. **Crucial distinction from local \`/lux\`:**
   - **DO NOT attempt to find or edit local files** for external websites.
   - Treat the user's pins, selectors, and style edits as grounds for **technical analysis, design explanation, or content discussion**:
     - **For UI / Design Teardowns:** Explain the layout technique (Flexbox/Grid), CSS properties (transforms, shadows, backdrop-filters, custom properties), or interactive patterns. Provide clean, modular code snippets (e.g., React + Tailwind or CSS) showing how the user can replicate the effect in their own project.
     - **For Articles & Documentation:** Address the user's questions, break down complex concepts, summarize highlighted text, or clarify difficult equations/theorems based on the pinned DOM context.
3. Respond in structured markdown referencing each pinned element's selector and text snippet.
`;

declare const __PACKAGE_VERSION__: string | undefined;

export function getPackageVersion(): string {
  if (typeof __PACKAGE_VERSION__ !== 'undefined' && __PACKAGE_VERSION__) {
    return __PACKAGE_VERSION__;
  }
  try {
    const pkg = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
    );
    return pkg.version || '0.13.0';
  } catch {
    return '0.13.0';
  }
}

export const PLUGIN_MANIFEST = {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  name: 'lux-edit',
  description: 'Live User eXperience overlay for visual UI editing, design token tweaking, and multi-agent feedback',
  get version() {
    return getPackageVersion();
  },
  author: {
    name: 'David Satomi',
    url: 'https://github.com/David-Sat',
  },
  homepage: 'https://github.com/David-Sat/lux-edit',
  repository: 'https://github.com/David-Sat/lux-edit',
  license: 'MIT',
  keywords: [
    'visual-editing',
    'mcp',
    'overlay',
    'ui-review',
    'agent-plugin',
    'tailwind',
    'design-tokens',
  ],
};

export const CLAUDE_PLUGIN_MANIFEST = {
  name: 'lux-edit',
  description: 'Live in-browser visual editing, design token tweaking, and multi-agent review overlay for web apps.',
  get version() {
    return getPackageVersion();
  },
  author: {
    name: 'David Satomi',
    url: 'https://github.com/David-Sat',
  },
  homepage: 'https://github.com/David-Sat/lux-edit',
  repository: 'https://github.com/David-Sat/lux-edit',
  license: 'MIT',
  keywords: [
    'visual-editing',
    'mcp',
    'overlay',
    'ui-review',
    'tailwind',
    'design-tokens',
  ],
};

export function getClaudeDotMcpContent(autoUpdate: boolean = false) {
  return {
    lux: {
      command: 'npx',
      args: ['-y', autoUpdate ? 'lux-edit@latest' : 'lux-edit', 'mcp'],
    },
  };
}

export function getMcpConfigContent(autoUpdate: boolean = false) {
  return {
    mcpServers: {
      lux: {
        command: 'npx',
        args: ['-y', autoUpdate ? 'lux-edit@latest' : 'lux-edit', 'mcp'],
      },
    },
  };
}

export const CLAUDE_DOT_MCP_CONTENT = getClaudeDotMcpContent(false);
export const MCP_CONFIG_CONTENT = getMcpConfigContent(false);

// Helper to write a self-contained Agent Plugin bundle (Claude Code .claude-plugin + Antigravity plugin.json + skills/lux & lux-web)
export function writePluginBundle(
  pluginDir: string,
  dryRun: boolean = false,
  autoUpdate: boolean = false
): boolean {
  try {
    if (!dryRun) {
      fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
      fs.mkdirSync(path.join(pluginDir, 'skills', 'lux'), { recursive: true });
      fs.mkdirSync(path.join(pluginDir, 'skills', 'lux-web'), { recursive: true });

      const claudeDotMcp = getClaudeDotMcpContent(autoUpdate);
      const mcpConfig = getMcpConfigContent(autoUpdate);

      // Claude Code official plugin layout
      fs.writeFileSync(
        path.join(pluginDir, '.claude-plugin', 'plugin.json'),
        JSON.stringify(CLAUDE_PLUGIN_MANIFEST, null, 2) + '\n'
      );
      fs.writeFileSync(
        path.join(pluginDir, '.claude-plugin', '.mcp.json'),
        JSON.stringify(claudeDotMcp, null, 2) + '\n'
      );
      fs.writeFileSync(
        path.join(pluginDir, '.mcp.json'),
        JSON.stringify(mcpConfig, null, 2) + '\n'
      );

      // Antigravity & Agent Plugin specification
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(PLUGIN_MANIFEST, null, 2) + '\n'
      );
      fs.writeFileSync(
        path.join(pluginDir, 'mcp_config.json'),
        JSON.stringify(mcpConfig, null, 2) + '\n'
      );

      // Skills
      fs.writeFileSync(
        path.join(pluginDir, 'skills', 'lux', 'SKILL.md'),
        SKILL_CONTENT
      );
      fs.writeFileSync(
        path.join(pluginDir, 'skills', 'lux-web', 'SKILL.md'),
        SKILL_WEB_CONTENT
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

export type AgentHarnessKey =
  | 'antigravity'
  | 'claude'
  | 'cursor'
  | 'windsurf'
  | 'desktop'
  | 'cline'
  | 'roo'
  | 'zed'
  | 'continue'
  | 'vscode';

export interface AgentHarnessSpec {
  key: AgentHarnessKey;
  name: string;
  aliases?: string[];
  isDetected: (home: string, platform?: NodeJS.Platform) => boolean;
  mcpPath?: (home: string, platform?: NodeJS.Platform) => string;
  mcpMerger?: (filePath: string, dryRun?: boolean, autoUpdate?: boolean) => boolean;
  mcpRemover?: (filePath: string, dryRun?: boolean) => boolean;
  skillsStrategy: 'bundle' | 'flat' | 'none';
  bundlePath?: (home: string, platform?: NodeJS.Platform) => string;
  skillsPaths?: (home: string, platform?: NodeJS.Platform) => Array<{ path: string; content: string }>;
  cleanLegacyPaths?: (home: string, platform?: NodeJS.Platform) => string[];
  postInstall?: (home: string, dryRun?: boolean, autoUpdate?: boolean) => void;
  postUninstall?: (home: string, dryRun?: boolean) => void;
}

export function getVscodeGlobalStorage(
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage');
  } else {
    return path.join(home, '.config', 'Code', 'User', 'globalStorage');
  }
}

// Helpers for Zed Editor context_servers
export function mergeZedConfig(
  filePath: string,
  dryRun: boolean = false,
  autoUpdate: boolean = false
): boolean {
  try {
    let config: any = { context_servers: {} };
    if (fs.existsSync(filePath)) {
      try {
        config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!config.context_servers) config.context_servers = {};
      } catch {
        return false;
      }
    }
    config.context_servers.lux = {
      command: 'npx',
      args: ['-y', autoUpdate ? 'lux-edit@latest' : 'lux-edit', 'mcp'],
    };
    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    }
    return true;
  } catch {
    return false;
  }
}

export function removeZedConfig(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    let config: any;
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return false;
    }
    if (!config || !config.context_servers || !('lux' in config.context_servers)) return false;
    delete config.context_servers.lux;
    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    }
    return true;
  } catch {
    return false;
  }
}

// Helpers for Continue.dev mcpServers
export function mergeContinueConfig(
  filePath: string,
  dryRun: boolean = false,
  autoUpdate: boolean = false
): boolean {
  try {
    let config: any = { mcpServers: [] };
    if (fs.existsSync(filePath)) {
      try {
        config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        return false;
      }
    }
    const luxEntry = {
      name: 'lux',
      command: 'npx',
      args: ['-y', autoUpdate ? 'lux-edit@latest' : 'lux-edit', 'mcp'],
    };
    if (Array.isArray(config.mcpServers) || !config.mcpServers) {
      if (!Array.isArray(config.mcpServers)) config.mcpServers = [];
      config.mcpServers = config.mcpServers.filter((s: any) => s && s.name !== 'lux');
      config.mcpServers.push(luxEntry);
    } else if (typeof config.mcpServers === 'object') {
      config.mcpServers.lux = {
        command: 'npx',
        args: ['-y', autoUpdate ? 'lux-edit@latest' : 'lux-edit', 'mcp'],
      };
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    }
    return true;
  } catch {
    return false;
  }
}

export function removeContinueConfig(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    let config: any;
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return false;
    }
    if (!config || !config.mcpServers) return false;
    let modified = false;
    if (Array.isArray(config.mcpServers)) {
      const beforeLen = config.mcpServers.length;
      config.mcpServers = config.mcpServers.filter((s: any) => s.name !== 'lux');
      modified = config.mcpServers.length !== beforeLen;
    } else if (typeof config.mcpServers === 'object' && 'lux' in config.mcpServers) {
      delete config.mcpServers.lux;
      modified = true;
    }
    if (modified && !dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    }
    return modified;
  } catch {
    return false;
  }
}

function registerClaudeCodeMcpViaCli(autoUpdate: boolean = false): void {
  try {
    const pkg = autoUpdate ? 'lux-edit@latest' : 'lux-edit';
    const { execSync } = require('node:child_process');
    execSync(`claude mcp add -s user lux -- npx -y ${pkg} mcp`, { stdio: 'ignore' });
  } catch {}
}

function deregisterClaudeCodeMcpViaCli(): void {
  try {
    const { execSync } = require('node:child_process');
    execSync('claude mcp remove -s user lux', { stdio: 'ignore' });
  } catch {}
}

export const AGENT_HARNESSES: AgentHarnessSpec[] = [
  {
    key: 'antigravity',
    name: 'Google Antigravity',
    aliases: ['gemini'],
    isDetected: (home) => fs.existsSync(path.join(home, '.gemini')),
    skillsStrategy: 'bundle',
    bundlePath: (home) => path.join(home, '.gemini', 'config', 'plugins', 'lux-edit'),
    cleanLegacyPaths: (home) => [
      path.join(home, '.gemini', 'config', 'skills', 'lux', 'SKILL.md'),
      path.join(home, '.gemini', 'config', 'mcp_config.json'),
    ],
  },
  {
    key: 'claude',
    name: 'Claude Code',
    aliases: ['claude-code'],
    isDetected: (home) => fs.existsSync(path.join(home, '.claude')) || fs.existsSync(path.join(home, '.claude.json')),
    mcpPath: (home) => path.join(home, '.claude.json'),
    skillsStrategy: 'flat',
    skillsPaths: (home) => [
      { path: path.join(home, '.claude', 'skills', 'lux', 'SKILL.md'), content: SKILL_CONTENT },
      { path: path.join(home, '.claude', 'skills', 'lux-web', 'SKILL.md'), content: SKILL_WEB_CONTENT },
    ],
    cleanLegacyPaths: (home) => [
      path.join(home, '.claude', 'plugins', 'lux-edit'),
      path.join(home, '.claude', 'skills', 'lux-review'),
      path.join(home, '.claude', 'skills', 'lux-edit'),
      path.join(home, '.claude', 'mcp.json'),
    ],
    postInstall: (home, dryRun, autoUpdate) => {
      if (!dryRun && home === os.homedir()) {
        registerClaudeCodeMcpViaCli(autoUpdate);
      }
    },
    postUninstall: (home, dryRun) => {
      if (!dryRun && home === os.homedir()) {
        deregisterClaudeCodeMcpViaCli();
      }
    },
  },
  {
    key: 'cursor',
    name: 'Cursor',
    isDetected: (home, platform = process.platform) => {
      if (platform === 'darwin') {
        return fs.existsSync(path.join(home, '.cursor')) || fs.existsSync('/Applications/Cursor.app');
      }
      return fs.existsSync(path.join(home, '.cursor'));
    },
    mcpPath: (home) => path.join(home, '.cursor', 'mcp.json'),
    skillsStrategy: 'none',
  },
  {
    key: 'windsurf',
    name: 'Windsurf',
    isDetected: (home, platform = process.platform) => {
      if (platform === 'darwin') {
        return fs.existsSync(path.join(home, '.codeium', 'windsurf')) || fs.existsSync('/Applications/Windsurf.app');
      }
      return fs.existsSync(path.join(home, '.codeium', 'windsurf'));
    },
    mcpPath: (home) => path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    skillsStrategy: 'none',
  },
  {
    key: 'desktop',
    name: 'Claude Desktop',
    aliases: ['claude-desktop'],
    isDetected: (home, platform = process.platform) => {
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
    },
    mcpPath: (home, platform = process.platform) => {
      if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else if (platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      } else {
        return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
      }
    },
    skillsStrategy: 'none',
  },
  {
    key: 'cline',
    name: 'Cline',
    isDetected: (home, platform = process.platform) =>
      fs.existsSync(path.join(getVscodeGlobalStorage(home, platform), 'saoudrizwan.claude-dev')),
    mcpPath: (home, platform = process.platform) =>
      path.join(getVscodeGlobalStorage(home, platform), 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    skillsStrategy: 'none',
  },
  {
    key: 'roo',
    name: 'Roo Code',
    aliases: ['roo-code'],
    isDetected: (home, platform = process.platform) =>
      fs.existsSync(path.join(getVscodeGlobalStorage(home, platform), 'rooveterinaryinc.roo-cline')),
    mcpPath: (home, platform = process.platform) =>
      path.join(getVscodeGlobalStorage(home, platform), 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
    skillsStrategy: 'none',
  },
  {
    key: 'zed',
    name: 'Zed Editor',
    isDetected: (home, platform = process.platform) => {
      if (platform === 'win32') {
        return fs.existsSync(path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Zed'));
      }
      if (platform === 'darwin') {
        return fs.existsSync(path.join(home, '.config', 'zed')) || fs.existsSync('/Applications/Zed.app');
      }
      return fs.existsSync(path.join(home, '.config', 'zed'));
    },
    mcpPath: (home, platform = process.platform) => {
      if (platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Zed', 'settings.json');
      }
      return path.join(home, '.config', 'zed', 'settings.json');
    },
    mcpMerger: mergeZedConfig,
    mcpRemover: removeZedConfig,
    skillsStrategy: 'none',
  },
  {
    key: 'continue',
    name: 'Continue.dev',
    aliases: ['continue'],
    isDetected: (home) => fs.existsSync(path.join(home, '.continue')),
    mcpPath: (home) => path.join(home, '.continue', 'config.json'),
    mcpMerger: mergeContinueConfig,
    mcpRemover: removeContinueConfig,
    skillsStrategy: 'none',
  },
  {
    key: 'vscode',
    name: 'VS Code',
    aliases: ['code', 'copilot'],
    isDetected: (home, platform = process.platform) => {
      if (platform === 'darwin') {
        return (
          fs.existsSync(path.join(home, 'Library', 'Application Support', 'Code')) ||
          fs.existsSync('/Applications/Visual Studio Code.app')
        );
      } else if (platform === 'win32') {
        return fs.existsSync(path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code'));
      }
      return fs.existsSync(path.join(home, '.config', 'Code'));
    },
    mcpPath: (home) => path.join(home, '.vscode', 'mcp.json'),
    skillsStrategy: 'none',
  },
];

export function installHarness(
  spec: AgentHarnessSpec,
  home: string,
  dryRun: boolean = false,
  autoUpdate: boolean = false,
  log: (msg: string) => void = console.log,
  platform: NodeJS.Platform = process.platform
): boolean {
  try {
    // 1. Clean legacy paths before installing
    if (!dryRun && spec.cleanLegacyPaths) {
      for (const legacyPath of spec.cleanLegacyPaths(home, platform)) {
        if (fs.existsSync(legacyPath)) {
          if (legacyPath.endsWith('.json')) {
            removeMcpConfig(legacyPath, dryRun);
          } else {
            fs.rmSync(legacyPath, { recursive: true, force: true });
          }
        }
      }
    }

    // 2. Install skills or bundle
    if (spec.skillsStrategy === 'bundle' && spec.bundlePath) {
      const bPath = spec.bundlePath(home, platform);
      if (writePluginBundle(bPath, dryRun, autoUpdate)) {
        log(`✓ ${spec.name === 'Google Antigravity' ? 'Antigravity' : spec.name} plugin:     ${bPath} (Skills + MCP)`);
      }
    } else if (spec.skillsStrategy === 'flat' && spec.skillsPaths) {
      for (const s of spec.skillsPaths(home, platform)) {
        if (writeSkillFile(s.path, dryRun, s.content)) {
          log(`✓ ${spec.name} skill:     ${s.path}`);
        }
      }
    }

    // 3. Configure MCP (standalone)
    if (spec.mcpPath) {
      const mPath = spec.mcpPath(home, platform);
      const merger = spec.mcpMerger || mergeMcpConfig;
      if (merger(mPath, dryRun, autoUpdate)) {
        if (spec.key === 'claude') {
          log(`✓ Claude Code MCP:        ${mPath}`);
        } else {
          log(`✓ ${spec.name.padEnd(16)}:    ${mPath}`);
        }
      }
    }

    // 4. Post-install hook (e.g. CLI delegation)
    if (spec.postInstall) {
      spec.postInstall(home, dryRun, autoUpdate);
    }
    return true;
  } catch (err: any) {
    log(`✗ Failed to install ${spec.name}: ${err.message}`);
    return false;
  }
}

export function uninstallHarness(
  spec: AgentHarnessSpec,
  home: string,
  dryRun: boolean = false,
  log: (msg: string) => void = console.log,
  platform: NodeJS.Platform = process.platform
): boolean {
  try {
    if (spec.skillsStrategy === 'bundle' && spec.bundlePath) {
      const bPath = spec.bundlePath(home, platform);
      if (removePluginBundle(bPath, dryRun)) {
        log(`✓ Removed ${spec.name === 'Google Antigravity' ? 'Antigravity' : spec.name} plugin: ${bPath}`);
      }
    } else if (spec.skillsStrategy === 'flat' && spec.skillsPaths) {
      for (const s of spec.skillsPaths(home, platform)) {
        if (removeSkillFile(s.path, dryRun)) {
          log(`✓ Removed ${spec.name} skill: ${s.path}`);
        }
      }
    }

    if (spec.mcpPath) {
      const mPath = spec.mcpPath(home, platform);
      const remover = spec.mcpRemover || removeMcpConfig;
      if (remover(mPath, dryRun)) {
        if (spec.key === 'claude') {
          log(`✓ Removed Claude Code MCP:   ${mPath}`);
        } else {
          log(`✓ Removed ${spec.name.padEnd(16)}: ${mPath}`);
        }
      }
    }

    if (!dryRun && spec.cleanLegacyPaths) {
      for (const legacyPath of spec.cleanLegacyPaths(home, platform)) {
        if (fs.existsSync(legacyPath)) {
          if (legacyPath.endsWith('.json')) {
            removeMcpConfig(legacyPath, dryRun);
          } else {
            fs.rmSync(legacyPath, { recursive: true, force: true });
          }
        }
      }
    }

    if (spec.postUninstall) {
      spec.postUninstall(home, dryRun);
    }
    return true;
  } catch (err: any) {
    log(`✗ Failed to uninstall ${spec.name}: ${err.message}`);
    return false;
  }
}

// Smart detection to verify if an agent/tool is actually installed on the system
export function isAgentInstalled(
  agentKey: AgentHarnessKey | 'gemini' | 'claude-code' | 'roo-code' | 'code' | 'copilot',
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): boolean {
  const harness = AGENT_HARNESSES.find(
    (h) => h.key === agentKey || (h.aliases && h.aliases.includes(agentKey as string))
  );
  if (harness) {
    return harness.isDetected(home, platform);
  }
  return false;
}

// Helper to safely merge lux into existing MCP JSON config and clean legacy keys
export function mergeMcpConfig(
  filePath: string,
  dryRun: boolean = false,
  autoUpdate: boolean = false
): boolean {
  try {
    let config: any = { mcpServers: {} };
    if (fs.existsSync(filePath)) {
      try {
        config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!config.mcpServers) config.mcpServers = {};
      } catch {
        return false;
      }
    }

    delete config.mcpServers['lux-review'];
    delete config.mcpServers['visual-edit'];

    config.mcpServers.lux = {
      command: 'npx',
      args: ['-y', autoUpdate ? 'lux-edit@latest' : 'lux-edit', 'mcp'],
    };

    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    }
    return true;
  } catch {
    return false;
  }
}

export function removeMcpConfig(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    let config: any;
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
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
  } catch {
    return false;
  }
}

export function writeSkillFile(filePath: string, dryRun: boolean = false, content: string = SKILL_CONTENT): boolean {
  try {
    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
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
  claudePlugin?: string;
  claudeCodeMcp: string;
  claudeCodeSkill: string;
  claudeCodeWebSkill: string;
  // Major standalone MCP agents
  claudeDesktopMcp: string;
  windsurfMcp: string;
  cursorMcp: string;
  clineMcp?: string;
  rooCodeMcp?: string;
  zedMcp?: string;
  continueMcp?: string;
  vscodeMcp?: string;
}

export function getAgentConfigPaths(
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): AgentPaths {
  const antigravity = AGENT_HARNESSES.find((h) => h.key === 'antigravity')!;
  const claude = AGENT_HARNESSES.find((h) => h.key === 'claude')!;
  const desktop = AGENT_HARNESSES.find((h) => h.key === 'desktop')!;
  const windsurf = AGENT_HARNESSES.find((h) => h.key === 'windsurf')!;
  const cursor = AGENT_HARNESSES.find((h) => h.key === 'cursor')!;
  const cline = AGENT_HARNESSES.find((h) => h.key === 'cline')!;
  const roo = AGENT_HARNESSES.find((h) => h.key === 'roo')!;
  const zed = AGENT_HARNESSES.find((h) => h.key === 'zed')!;
  const cont = AGENT_HARNESSES.find((h) => h.key === 'continue')!;
  const vscode = AGENT_HARNESSES.find((h) => h.key === 'vscode')!;

  const claudeSkills = claude.skillsPaths!(home, platform);

  return {
    antigravityPlugin: antigravity.bundlePath!(home, platform),
    antigravityMcp: path.join(home, '.gemini', 'config', 'mcp_config.json'),
    antigravitySkill: path.join(home, '.gemini', 'config', 'skills', 'lux', 'SKILL.md'),
    claudePlugin: path.join(home, '.claude', 'skills', 'lux-edit'),
    claudeCodeMcp: claude.mcpPath!(home, platform),
    claudeCodeSkill: claudeSkills[0].path,
    claudeCodeWebSkill: claudeSkills[1].path,
    claudeDesktopMcp: desktop.mcpPath!(home, platform),
    windsurfMcp: windsurf.mcpPath!(home, platform),
    cursorMcp: cursor.mcpPath!(home, platform),
    clineMcp: cline.mcpPath!(home, platform),
    rooCodeMcp: roo.mcpPath!(home, platform),
    zedMcp: zed.mcpPath!(home, platform),
    continueMcp: cont.mcpPath!(home, platform),
    vscodeMcp: vscode.mcpPath!(home, platform),
  };
}

// Helper to install into an explicit custom JSON file or directory path
export function installCustomPath(
  targetPath: string,
  dryRun: boolean = false,
  log: (msg: string) => void = console.log,
  autoUpdate: boolean = false
): boolean {
  try {
    const resolvedPath = path.resolve(targetPath);
    if (resolvedPath.endsWith('.json')) {
      if (mergeMcpConfig(resolvedPath, dryRun, autoUpdate)) {
        log(`✓ Configured custom MCP file: ${resolvedPath}`);
        return true;
      }
    } else {
      const mcpPath = path.join(resolvedPath, 'mcp.json');
      const skillPath = path.join(resolvedPath, 'skills', 'lux', 'SKILL.md');
      if (mergeMcpConfig(mcpPath, dryRun, autoUpdate)) {
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
  autoUpdate?: boolean;
}

export async function runInit(options: InitOptions = {}) {
  const home = options.home || os.homedir();
  const cwd = options.cwd || process.cwd();
  const dryRun = !!options.dryRun;
  const isGlobal = !!options.global;
  const forceAll = !!options.all;
  const autoUpdate = !!options.autoUpdate;
  const targetAgent = options.agent?.toLowerCase();
  const customPath = options.path;
  const log = options.logger || console.log;

  if (autoUpdate) {
    log('⚡ Auto-update enabled: MCP configs will run lux-edit@latest');
  }

  // 1. Custom Path Mode
  if (customPath) {
    log(`\nConfiguring custom path: ${customPath}\n`);
    installCustomPath(customPath, dryRun, log, autoUpdate);
    return;
  }

  // 2. Global Agent Installation Mode
  if (isGlobal) {
    log('\nInstalling lux globally across user agent environments\n');
    const paths = getAgentConfigPaths(home);

    const agentCandidates = AGENT_HARNESSES.map((harness) => ({
      key: harness.key,
      name: harness.name,
      detected: harness.isDetected(home, process.platform),
    }));

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

    const shouldTarget = (harness: AgentHarnessSpec) =>
      selectedAgentKeys.includes(harness.key) ||
      (harness.aliases && harness.aliases.some((alias) => selectedAgentKeys.includes(alias)));

    for (const harness of AGENT_HARNESSES) {
      if (shouldTarget(harness)) {
        installHarness(harness, home, dryRun, autoUpdate, log);
      } else {
        const detected = harness.isDetected(home, process.platform);
        log(`- ${harness.name.padEnd(16)}:    (${detected ? 'skipped' : 'not detected, skipped'})`);
      }
    }

    log('\nGlobal initialization complete.');
    log('lux is now configured for your agents across all projects.\n');
  } else {
    // 3. Workspace Initialization Mode (Agent Plugin Standard)
    log('\nInitializing lux workspace configuration (Agent Plugin standard)\n');

    // 1. Write Claude Code official plugin manifests
    const claudePluginDir = path.join(cwd, '.claude-plugin');
    if (!dryRun) {
      fs.mkdirSync(claudePluginDir, { recursive: true });
      fs.writeFileSync(
        path.join(claudePluginDir, 'plugin.json'),
        JSON.stringify(CLAUDE_PLUGIN_MANIFEST, null, 2) + '\n'
      );
      fs.writeFileSync(
        path.join(claudePluginDir, '.mcp.json'),
        JSON.stringify(getClaudeDotMcpContent(autoUpdate), null, 2) + '\n'
      );
    }
    log(`✓ Created Claude plugin:  ${path.join(claudePluginDir, 'plugin.json')}`);

    // 2. Write standard plugin.json (Antigravity & Agent Plugin specification)
    const pluginManifestPath = path.join(cwd, 'plugin.json');
    if (!dryRun) {
      fs.writeFileSync(pluginManifestPath, JSON.stringify(PLUGIN_MANIFEST, null, 2) + '\n');
    }
    log(`✓ Created plugin manifest: ${pluginManifestPath}`);

    // 3. Write standard mcp_config.json
    const pluginMcpPath = path.join(cwd, 'mcp_config.json');
    if (mergeMcpConfig(pluginMcpPath, dryRun, autoUpdate)) {
      log(`✓ Configured plugin MCP:  ${pluginMcpPath}`);
    }

    // 4. Write standard mcp.json and .mcp.json (universal across Cursor, Claude Code, Windsurf, Zed)
    const mcpConfigPath = path.join(cwd, 'mcp.json');
    const dotMcpConfigPath = path.join(cwd, '.mcp.json');
    if (mergeMcpConfig(mcpConfigPath, dryRun, autoUpdate)) {
      log(`✓ Configured MCP config:  ${mcpConfigPath}`);
    }
    if (mergeMcpConfig(dotMcpConfigPath, dryRun, autoUpdate)) {
      log(`✓ Configured MCP config:  ${dotMcpConfigPath}`);
    }

    // 5. Write standard skills/lux/SKILL.md and skills/lux-web/SKILL.md
    const skillFile = path.join(cwd, 'skills', 'lux', 'SKILL.md');
    const skillWebFile = path.join(cwd, 'skills', 'lux-web', 'SKILL.md');
    if (!dryRun) {
      const legacySkillDir = path.join(cwd, 'skills', 'lux-review');
      if (fs.existsSync(legacySkillDir)) {
        fs.rmSync(legacySkillDir, { recursive: true, force: true });
      }
    }
    if (writeSkillFile(skillFile, dryRun)) {
      log(`✓ Created agent skill:    ${skillFile}`);
    }
    if (writeSkillFile(skillWebFile, dryRun, SKILL_WEB_CONTENT)) {
      log(`✓ Created agent skill:    ${skillWebFile}`);
    }

    // 6. Auto-detect and sync Claude Code ~/.claude/skills
    const claudeDir = path.join(home, '.claude');
    if (fs.existsSync(claudeDir) || fs.existsSync(path.join(home, '.claude.json'))) {
      if (!dryRun) {
        const legacyClaudeDirs = [
          path.join(claudeDir, 'skills', 'lux-review'),
          path.join(claudeDir, 'skills', 'lux-edit'),
          path.join(claudeDir, 'plugins', 'lux-edit'),
        ];
        for (const dir of legacyClaudeDirs) {
          if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        }
      }
      const claudeSkill = path.join(claudeDir, 'skills', 'lux', 'SKILL.md');
      const claudeWebSkill = path.join(claudeDir, 'skills', 'lux-web', 'SKILL.md');
      if (writeSkillFile(claudeSkill, dryRun)) {
        log(`✓ Synced Claude Code:     ${claudeSkill}`);
      }
      if (writeSkillFile(claudeWebSkill, dryRun, SKILL_WEB_CONTENT)) {
        log(`✓ Synced Claude Code:     ${claudeWebSkill}`);
      }
    }

    // 6. Auto-detect and sync Antigravity / Gemini ~/.gemini/config/plugins/lux-edit
    const geminiDir = path.join(home, '.gemini');
    if (fs.existsSync(geminiDir)) {
      const geminiPluginDir = path.join(geminiDir, 'config', 'plugins', 'lux-edit');
      if (writePluginBundle(geminiPluginDir, dryRun, autoUpdate)) {
        log(`✓ Synced Antigravity:     ${geminiPluginDir}`);
      }
    }

    // 7. Auto-detect and sync .agents/skills if .agents directory exists
    const agentsDir = path.join(cwd, '.agents');
    if (fs.existsSync(agentsDir)) {
      const agentsSkill = path.join(agentsDir, 'skills', 'lux', 'SKILL.md');
      const agentsWebSkill = path.join(agentsDir, 'skills', 'lux-web', 'SKILL.md');
      if (writeSkillFile(agentsSkill, dryRun)) {
        log(`✓ Synced .agents skill:   ${agentsSkill}`);
      }
      if (writeSkillFile(agentsWebSkill, dryRun, SKILL_WEB_CONTENT)) {
        log(`✓ Synced .agents skill:   ${agentsWebSkill}`);
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

    const shouldTarget = (harness: AgentHarnessSpec) =>
      !targetAgent ||
      targetAgent === 'all' ||
      targetAgent === harness.key ||
      (harness.aliases && harness.aliases.includes(targetAgent)) ||
      targetAgent === harness.name.toLowerCase().replace(/\s+/g, '');

    for (const harness of AGENT_HARNESSES) {
      if (shouldTarget(harness)) {
        uninstallHarness(harness, home, dryRun, log);
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
    const skillWebFile = path.join(cwd, 'skills', 'lux-web', 'SKILL.md');
    const legacySkillFile = path.join(cwd, 'skills', 'lux-review', 'SKILL.md');

    if (removeMcpConfig(mcpConfigPath, dryRun)) {
      log(`✓ Cleaned MCP config:         ${mcpConfigPath}`);
    }
    if (removeMcpConfig(dotMcpConfigPath, dryRun)) {
      log(`✓ Cleaned MCP config:         ${dotMcpConfigPath}`);
    }
    if (fs.existsSync(pluginManifestPath)) {
      if (!dryRun) fs.rmSync(pluginManifestPath, { force: true });
      log(`✓ Removed plugin manifest:    ${pluginManifestPath}`);
    }
    const claudePluginDir = path.join(cwd, '.claude-plugin');
    if (fs.existsSync(claudePluginDir)) {
      if (!dryRun) fs.rmSync(claudePluginDir, { recursive: true, force: true });
      log(`✓ Removed Claude plugin:      ${claudePluginDir}`);
    }
    if (fs.existsSync(pluginMcpPath)) {
      let isOnlyLux = false;
      try {
        const parsed = JSON.parse(fs.readFileSync(pluginMcpPath, 'utf-8'));
        const keys = Object.keys(parsed.mcpServers || {});
        isOnlyLux = keys.length === 0 || (keys.length === 1 && keys[0] === 'lux');
      } catch {}
      if (isOnlyLux) {
        if (!dryRun) fs.rmSync(pluginMcpPath, { force: true });
        log(`✓ Removed plugin MCP:         ${pluginMcpPath}`);
      } else {
        removeMcpConfig(pluginMcpPath, dryRun);
        log(`✓ Cleaned plugin MCP:         ${pluginMcpPath}`);
      }
    }
    if (removeSkillFile(skillFile, dryRun)) {
      log(`✓ Removed workspace skill:    ${skillFile}`);
    }
    if (removeSkillFile(skillWebFile, dryRun)) {
      log(`✓ Removed workspace skill:    ${skillWebFile}`);
    }
    if (removeSkillFile(legacySkillFile, dryRun)) {
      log(`✓ Removed legacy skill:       ${legacySkillFile}`);
    }

    const agentsDir = path.join(cwd, '.agents');
    if (fs.existsSync(agentsDir)) {
      const agentsSkill = path.join(agentsDir, 'skills', 'lux', 'SKILL.md');
      const agentsWebSkill = path.join(agentsDir, 'skills', 'lux-web', 'SKILL.md');
      removeSkillFile(agentsSkill, dryRun);
      removeSkillFile(agentsWebSkill, dryRun);
    }

    log('\nWorkspace cleanup complete.\n');
  }
}
