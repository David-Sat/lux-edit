import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { mergeHarnessHooksConfig, removeHarnessHooksConfig } from './hooks.js';
import {
  SKILL_CONTENT,
  SKILL_WEB_CONTENT,
  writePluginBundle,
  removePluginBundle,
  writeSkillFile,
  removeSkillFile,
} from './init-templates.js';

export type AgentHarnessKey =
  | 'antigravity'
  | 'claude'
  | 'codex'
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

export interface AgentPaths {
  antigravityPlugin: string;
  antigravityMcp: string;
  antigravitySkill: string;
  claudePlugin?: string;
  claudeCodeMcp: string;
  claudeCodeSkill: string;
  claudeCodeWebSkill: string;
  claudeDesktopMcp: string;
  windsurfMcp: string;
  cursorMcp: string;
  clineMcp?: string;
  rooCodeMcp?: string;
  zedMcp?: string;
  continueMcp?: string;
  vscodeMcp?: string;
}

function readJsonFileOrDefault(filePath: string, fallback: Record<string, any>): Record<string, any> | null {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function getLuxMcpServerSpec(autoUpdate: boolean) {
  return {
    command: 'npx',
    args: ['-y', autoUpdate ? 'lux-edit@latest' : 'lux-edit', 'mcp'],
  };
}

export function getVscodeGlobalStorage(
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage');
  }
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage');
  }
  return path.join(home, '.config', 'Code', 'User', 'globalStorage');
}

export function mergeMcpConfig(filePath: string, dryRun: boolean = false, autoUpdate: boolean = false): boolean {
  try {
    const config = readJsonFileOrDefault(filePath, { mcpServers: {} });
    if (!config) return false;
    if (!config.mcpServers) config.mcpServers = {};

    delete config.mcpServers['lux-review'];
    delete config.mcpServers['visual-edit'];
    config.mcpServers.lux = getLuxMcpServerSpec(autoUpdate);

    if (!dryRun) {
      writeJsonFile(filePath, config);
    }
    return true;
  } catch {
    return false;
  }
}

export function removeMcpConfig(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const config = readJsonFileOrDefault(filePath, {});
    if (!config || !config.mcpServers) return false;

    let modified = false;
    for (const key of ['lux', 'lux-review', 'visual-edit']) {
      if (key in config.mcpServers) {
        delete config.mcpServers[key];
        modified = true;
      }
    }

    if (modified && !dryRun) {
      writeJsonFile(filePath, config);
    }
    return modified;
  } catch {
    return false;
  }
}

export function mergeZedConfig(filePath: string, dryRun: boolean = false, autoUpdate: boolean = false): boolean {
  try {
    const config = readJsonFileOrDefault(filePath, { context_servers: {} });
    if (!config) return false;
    if (!config.context_servers) config.context_servers = {};

    config.context_servers.lux = getLuxMcpServerSpec(autoUpdate);
    if (!dryRun) {
      writeJsonFile(filePath, config);
    }
    return true;
  } catch {
    return false;
  }
}

export function removeZedConfig(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const config = readJsonFileOrDefault(filePath, {});
    if (!config || !config.context_servers || !('lux' in config.context_servers)) return false;
    delete config.context_servers.lux;
    if (!dryRun) {
      writeJsonFile(filePath, config);
    }
    return true;
  } catch {
    return false;
  }
}

export function mergeContinueConfig(filePath: string, dryRun: boolean = false, autoUpdate: boolean = false): boolean {
  try {
    const config = readJsonFileOrDefault(filePath, { mcpServers: [] });
    if (!config) return false;

    const spec = getLuxMcpServerSpec(autoUpdate);
    if (Array.isArray(config.mcpServers) || !config.mcpServers) {
      if (!Array.isArray(config.mcpServers)) config.mcpServers = [];
      config.mcpServers = config.mcpServers.filter((s: any) => s && s.name !== 'lux');
      config.mcpServers.push({ name: 'lux', ...spec });
    } else if (typeof config.mcpServers === 'object') {
      config.mcpServers.lux = spec;
    }

    if (!dryRun) {
      writeJsonFile(filePath, config);
    }
    return true;
  } catch {
    return false;
  }
}

export function removeContinueConfig(filePath: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const config = readJsonFileOrDefault(filePath, {});
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
      writeJsonFile(filePath, config);
    }
    return modified;
  } catch {
    return false;
  }
}

function registerClaudeCodeMcpViaCli(autoUpdate: boolean = false): void {
  try {
    const pkg = autoUpdate ? 'lux-edit@latest' : 'lux-edit';
    execSync(`claude mcp add -s user lux -- npx -y ${pkg} mcp`, { stdio: 'ignore' });
  } catch {}
}

function deregisterClaudeCodeMcpViaCli(): void {
  try {
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
      mergeHarnessHooksConfig(path.join(home, '.claude', 'settings.json'), 'claude-code', dryRun, autoUpdate);
      if (!dryRun && home === os.homedir()) {
        registerClaudeCodeMcpViaCli(autoUpdate);
      }
    },
    postUninstall: (home, dryRun) => {
      removeHarnessHooksConfig(path.join(home, '.claude', 'settings.json'), dryRun);
      if (!dryRun && home === os.homedir()) {
        deregisterClaudeCodeMcpViaCli();
      }
    },
  },
  {
    key: 'codex',
    name: 'OpenAI Codex',
    aliases: ['openai-codex'],
    isDetected: (home) => fs.existsSync(path.join(home, '.codex')),
    skillsStrategy: 'flat',
    skillsPaths: (home) => [
      { path: path.join(home, '.codex', 'skills', 'lux', 'SKILL.md'), content: SKILL_CONTENT },
      { path: path.join(home, '.codex', 'skills', 'lux-web', 'SKILL.md'), content: SKILL_WEB_CONTENT },
    ],
    postInstall: (home, dryRun, autoUpdate) => {
      mergeHarnessHooksConfig(path.join(home, '.codex', 'hooks.json'), 'codex', dryRun, autoUpdate);
    },
    postUninstall: (home, dryRun) => {
      removeHarnessHooksConfig(path.join(home, '.codex', 'hooks.json'), dryRun);
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
      }
      if (platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        return fs.existsSync(path.join(appData, 'Claude'));
      }
      return fs.existsSync(path.join(home, '.config', 'Claude'));
    },
    mcpPath: (home, platform = process.platform) => {
      if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      }
      if (platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      }
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
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
      return path.join(home, '.config/zed/settings.json');
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
      }
      if (platform === 'win32') {
        return fs.existsSync(path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code'));
      }
      return fs.existsSync(path.join(home, '.config', 'Code'));
    },
    mcpPath: (home) => path.join(home, '.vscode', 'mcp.json'),
    skillsStrategy: 'none',
  },
];

function cleanLegacyPathsList(pathsToClean: string[], dryRun: boolean): void {
  if (dryRun) return;
  for (const legacyPath of pathsToClean) {
    if (fs.existsSync(legacyPath)) {
      if (legacyPath.endsWith('.json')) {
        removeMcpConfig(legacyPath, dryRun);
      } else {
        fs.rmSync(legacyPath, { recursive: true, force: true });
      }
    }
  }
}

export function installHarness(
  spec: AgentHarnessSpec,
  home: string,
  dryRun: boolean = false,
  autoUpdate: boolean = false,
  log: (msg: string) => void = console.log,
  platform: NodeJS.Platform = process.platform
): boolean {
  try {
    if (spec.cleanLegacyPaths) {
      cleanLegacyPathsList(spec.cleanLegacyPaths(home, platform), dryRun);
    }

    if (spec.skillsStrategy === 'bundle' && spec.bundlePath) {
      const bPath = spec.bundlePath(home, platform);
      if (writePluginBundle(bPath, dryRun, autoUpdate)) {
        log(`[ok] ${spec.name === 'Google Antigravity' ? 'Antigravity' : spec.name} plugin:     ${bPath} (Skills + MCP + Hooks)`);
      }
    } else if (spec.skillsStrategy === 'flat' && spec.skillsPaths) {
      for (const s of spec.skillsPaths(home, platform)) {
        if (writeSkillFile(s.path, dryRun, s.content)) {
          log(`[ok] ${spec.name} skill:     ${s.path}`);
        }
      }
    }

    if (spec.mcpPath) {
      const mPath = spec.mcpPath(home, platform);
      const merger = spec.mcpMerger || mergeMcpConfig;
      if (merger(mPath, dryRun, autoUpdate)) {
        if (spec.key === 'claude') {
          log(`[ok] Claude Code MCP:        ${mPath}`);
        } else {
          log(`[ok] ${spec.name.padEnd(16)}:    ${mPath}`);
        }
      }
    }

    if (spec.postInstall) {
      spec.postInstall(home, dryRun, autoUpdate);
    }
    return true;
  } catch (err: any) {
    log(`[error] Failed to install ${spec.name}: ${err.message}`);
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
        log(`[ok] Removed ${spec.name === 'Google Antigravity' ? 'Antigravity' : spec.name} plugin: ${bPath}`);
      }
    } else if (spec.skillsStrategy === 'flat' && spec.skillsPaths) {
      for (const s of spec.skillsPaths(home, platform)) {
        if (removeSkillFile(s.path, dryRun)) {
          log(`[ok] Removed ${spec.name} skill: ${s.path}`);
        }
      }
    }

    if (spec.mcpPath) {
      const mPath = spec.mcpPath(home, platform);
      const remover = spec.mcpRemover || removeMcpConfig;
      if (remover(mPath, dryRun)) {
        if (spec.key === 'claude') {
          log(`[ok] Removed Claude Code MCP:   ${mPath}`);
        } else {
          log(`[ok] Removed ${spec.name.padEnd(16)}: ${mPath}`);
        }
      }
    }

    if (spec.cleanLegacyPaths) {
      cleanLegacyPathsList(spec.cleanLegacyPaths(home, platform), dryRun);
    }

    if (spec.postUninstall) {
      spec.postUninstall(home, dryRun);
    }
    return true;
  } catch (err: any) {
    log(`[error] Failed to uninstall ${spec.name}: ${err.message}`);
    return false;
  }
}

export function isAgentInstalled(
  agentKey: AgentHarnessKey | 'gemini' | 'claude-code' | 'roo-code' | 'code' | 'copilot',
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): boolean {
  const harness = AGENT_HARNESSES.find(
    (h) => h.key === agentKey || (h.aliases && h.aliases.includes(agentKey as string))
  );
  return harness ? harness.isDetected(home, platform) : false;
}

export function getAgentConfigPaths(
  home: string = os.homedir(),
  platform: NodeJS.Platform = process.platform
): AgentPaths {
  const byKey = (key: AgentHarnessKey) => AGENT_HARNESSES.find((h) => h.key === key)!;
  const antigravity = byKey('antigravity');
  const claude = byKey('claude');
  const claudeSkills = claude.skillsPaths!(home, platform);

  return {
    antigravityPlugin: antigravity.bundlePath!(home, platform),
    antigravityMcp: path.join(home, '.gemini', 'config', 'mcp_config.json'),
    antigravitySkill: path.join(home, '.gemini', 'config', 'skills', 'lux', 'SKILL.md'),
    claudePlugin: path.join(home, '.claude', 'skills', 'lux-edit'),
    claudeCodeMcp: claude.mcpPath!(home, platform),
    claudeCodeSkill: claudeSkills[0].path,
    claudeCodeWebSkill: claudeSkills[1].path,
    claudeDesktopMcp: byKey('desktop').mcpPath!(home, platform),
    windsurfMcp: byKey('windsurf').mcpPath!(home, platform),
    cursorMcp: byKey('cursor').mcpPath!(home, platform),
    clineMcp: byKey('cline').mcpPath!(home, platform),
    rooCodeMcp: byKey('roo').mcpPath!(home, platform),
    zedMcp: byKey('zed').mcpPath!(home, platform),
    continueMcp: byKey('continue').mcpPath!(home, platform),
    vscodeMcp: byKey('vscode').mcpPath!(home, platform),
  };
}
