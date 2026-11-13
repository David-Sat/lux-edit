import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { getAntigravityHooksContent, mergeHarnessHooksConfig } from './hooks.js';
import {
  SKILL_CONTENT,
  SKILL_WEB_CONTENT,
  PLUGIN_MANIFEST,
  CLAUDE_PLUGIN_MANIFEST,
  getPackageVersion,
  getClaudeDotMcpContent,
  getMcpConfigContent,
  CLAUDE_DOT_MCP_CONTENT,
  MCP_CONFIG_CONTENT,
  writePluginBundle,
  removePluginBundle,
  writeSkillFile,
  removeSkillFile,
} from './init-templates.js';
import {
  AGENT_HARNESSES,
  AgentHarnessSpec,
  AgentHarnessKey,
  AgentPaths,
  getVscodeGlobalStorage,
  mergeMcpConfig,
  removeMcpConfig,
  mergeZedConfig,
  removeZedConfig,
  mergeContinueConfig,
  removeContinueConfig,
  installHarness,
  uninstallHarness,
  isAgentInstalled,
  getAgentConfigPaths,
} from './agent-harnesses.js';

export {
  SKILL_CONTENT,
  SKILL_WEB_CONTENT,
  PLUGIN_MANIFEST,
  CLAUDE_PLUGIN_MANIFEST,
  getPackageVersion,
  getClaudeDotMcpContent,
  getMcpConfigContent,
  CLAUDE_DOT_MCP_CONTENT,
  MCP_CONFIG_CONTENT,
  writePluginBundle,
  removePluginBundle,
  writeSkillFile,
  removeSkillFile,
  AGENT_HARNESSES,
  getVscodeGlobalStorage,
  mergeMcpConfig,
  removeMcpConfig,
  mergeZedConfig,
  removeZedConfig,
  mergeContinueConfig,
  removeContinueConfig,
  installHarness,
  uninstallHarness,
  isAgentInstalled,
  getAgentConfigPaths,
  type AgentHarnessSpec,
  type AgentHarnessKey,
  type AgentPaths,
};

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
        log(`[ok] Configured custom MCP file: ${resolvedPath}`);
        return true;
      }
    } else {
      const mcpPath = path.join(resolvedPath, 'mcp.json');
      const skillPath = path.join(resolvedPath, 'skills', 'lux', 'SKILL.md');
      if (mergeMcpConfig(mcpPath, dryRun, autoUpdate)) {
        log(`[ok] Created custom MCP config:  ${mcpPath}`);
      }
      if (writeSkillFile(skillPath, dryRun)) {
        log(`[ok] Created custom skill file:  ${skillPath}`);
      }
      return true;
    }
  } catch (err: unknown) {
    log(`[error] Failed to configure custom path ${targetPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return false;
}

export function uninstallCustomPath(
  targetPath: string,
  dryRun: boolean = false,
  log: (msg: string) => void = console.log
): boolean {
  try {
    const resolvedPath = path.resolve(targetPath);
    if (resolvedPath.endsWith('.json')) {
      if (removeMcpConfig(resolvedPath, dryRun)) {
        log(`[ok] Removed lux from custom file: ${resolvedPath}`);
        return true;
      }
    } else {
      const mcpPath = path.join(resolvedPath, 'mcp.json');
      const skillPath = path.join(resolvedPath, 'skills', 'lux', 'SKILL.md');
      removeMcpConfig(mcpPath, dryRun);
      removeSkillFile(skillPath, dryRun);
      log(`[ok] Cleaned custom directory:     ${resolvedPath}`);
      return true;
    }
  } catch (err: unknown) {
    log(`[error] Failed to uninstall from custom path ${targetPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return false;
}

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
    log('[auto-update] Auto-update enabled: MCP configs will run lux-edit@latest');
  }

  if (customPath) {
    log(`\nConfiguring custom path: ${customPath}\n`);
    installCustomPath(customPath, dryRun, log, autoUpdate);
    return;
  }

  if (isGlobal) {
    log('\nInstalling lux globally across user agent environments\n');

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
    return;
  }

  // Workspace Initialization Mode (Agent Plugin Standard)
  log('\nInitializing lux workspace configuration (Agent Plugin standard)\n');

  const claudePluginDir = path.join(cwd, '.claude-plugin');
  if (!dryRun) {
    fs.mkdirSync(claudePluginDir, { recursive: true });
    fs.writeFileSync(path.join(claudePluginDir, 'plugin.json'), JSON.stringify(CLAUDE_PLUGIN_MANIFEST, null, 2) + '\n');
    fs.writeFileSync(path.join(claudePluginDir, '.mcp.json'), JSON.stringify(getClaudeDotMcpContent(autoUpdate), null, 2) + '\n');
  }
  log(`[ok] Created Claude plugin:  ${path.join(claudePluginDir, 'plugin.json')}`);

  const pluginManifestPath = path.join(cwd, 'plugin.json');
  const pluginHooksPath = path.join(cwd, 'hooks.json');
  if (!dryRun) {
    fs.writeFileSync(pluginManifestPath, JSON.stringify(PLUGIN_MANIFEST, null, 2) + '\n');
    fs.writeFileSync(pluginHooksPath, JSON.stringify(getAntigravityHooksContent(autoUpdate), null, 2) + '\n');
  }
  log(`[ok] Created plugin manifest: ${pluginManifestPath}`);
  log(`[ok] Created plugin hooks:    ${pluginHooksPath}`);

  const pluginMcpPath = path.join(cwd, 'mcp_config.json');
  if (mergeMcpConfig(pluginMcpPath, dryRun, autoUpdate)) {
    log(`[ok] Configured plugin MCP:  ${pluginMcpPath}`);
  }

  for (const cfgPath of [path.join(cwd, 'mcp.json'), path.join(cwd, '.mcp.json')]) {
    if (mergeMcpConfig(cfgPath, dryRun, autoUpdate)) {
      log(`[ok] Configured MCP config:  ${cfgPath}`);
    }
  }

  const skillFile = path.join(cwd, 'skills', 'lux', 'SKILL.md');
  const skillWebFile = path.join(cwd, 'skills', 'lux-web', 'SKILL.md');
  if (!dryRun) {
    const legacySkillDir = path.join(cwd, 'skills', 'lux-review');
    if (fs.existsSync(legacySkillDir)) {
      fs.rmSync(legacySkillDir, { recursive: true, force: true });
    }
  }
  if (writeSkillFile(skillFile, dryRun)) {
    log(`[ok] Created agent skill:    ${skillFile}`);
  }
  if (writeSkillFile(skillWebFile, dryRun, SKILL_WEB_CONTENT)) {
    log(`[ok] Created agent skill:    ${skillWebFile}`);
  }

  const claudeDir = path.join(home, '.claude');
  if (fs.existsSync(claudeDir) || fs.existsSync(path.join(home, '.claude.json'))) {
    if (!dryRun) {
      for (const dir of [
        path.join(claudeDir, 'skills', 'lux-review'),
        path.join(claudeDir, 'skills', 'lux-edit'),
        path.join(claudeDir, 'plugins', 'lux-edit'),
      ]) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    }
    const claudeSkill = path.join(claudeDir, 'skills', 'lux', 'SKILL.md');
    const claudeWebSkill = path.join(claudeDir, 'skills', 'lux-web', 'SKILL.md');
    if (writeSkillFile(claudeSkill, dryRun)) {
      log(`[ok] Synced Claude Code:     ${claudeSkill}`);
    }
    if (writeSkillFile(claudeWebSkill, dryRun, SKILL_WEB_CONTENT)) {
      log(`[ok] Synced Claude Code:     ${claudeWebSkill}`);
    }
    mergeHarnessHooksConfig(path.join(claudeDir, 'settings.json'), 'claude-code', dryRun, autoUpdate);
  }

  const geminiDir = path.join(home, '.gemini');
  if (fs.existsSync(geminiDir)) {
    const geminiPluginDir = path.join(geminiDir, 'config', 'plugins', 'lux-edit');
    if (writePluginBundle(geminiPluginDir, dryRun, autoUpdate)) {
      log(`[ok] Synced Antigravity:     ${geminiPluginDir}`);
    }
  }

  const agentsDir = path.join(cwd, '.agents');
  if (fs.existsSync(agentsDir)) {
    const agentsSkill = path.join(agentsDir, 'skills', 'lux', 'SKILL.md');
    const agentsWebSkill = path.join(agentsDir, 'skills', 'lux-web', 'SKILL.md');
    const agentsHooks = path.join(agentsDir, 'hooks.json');
    if (writeSkillFile(agentsSkill, dryRun)) {
      log(`[ok] Synced .agents skill:   ${agentsSkill}`);
    }
    if (writeSkillFile(agentsWebSkill, dryRun, SKILL_WEB_CONTENT)) {
      log(`[ok] Synced .agents skill:   ${agentsWebSkill}`);
    }
    if (!dryRun) {
      fs.writeFileSync(agentsHooks, JSON.stringify(getAntigravityHooksContent(autoUpdate), null, 2) + '\n');
    }
  }

  log('\nWorkspace initialization complete.');
  log('Run `lux <url-or-file>` to start visual editing.\n');
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

  if (customPath) {
    log(`\nRemoving lux from custom path: ${customPath}\n`);
    uninstallCustomPath(customPath, dryRun, log);
    return;
  }

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
    log('lux MCP servers, skills, and hooks have been removed from your agents.\n');
    return;
  }

  // Workspace Mode
  log('\nRemoving lux from workspace\n');

  for (const cfgPath of [path.join(cwd, 'mcp.json'), path.join(cwd, '.mcp.json')]) {
    if (removeMcpConfig(cfgPath, dryRun)) {
      log(`[ok] Cleaned MCP config:         ${cfgPath}`);
    }
  }

  const pluginManifestPath = path.join(cwd, 'plugin.json');
  const pluginHooksPath = path.join(cwd, 'hooks.json');
  const pluginMcpPath = path.join(cwd, 'mcp_config.json');

  if (fs.existsSync(pluginManifestPath)) {
    if (!dryRun) fs.rmSync(pluginManifestPath, { force: true });
    log(`[ok] Removed plugin manifest:    ${pluginManifestPath}`);
  }
  if (fs.existsSync(pluginHooksPath)) {
    if (!dryRun) fs.rmSync(pluginHooksPath, { force: true });
    log(`[ok] Removed plugin hooks:       ${pluginHooksPath}`);
  }
  const claudePluginDir = path.join(cwd, '.claude-plugin');
  if (fs.existsSync(claudePluginDir)) {
    if (!dryRun) fs.rmSync(claudePluginDir, { recursive: true, force: true });
    log(`[ok] Removed Claude plugin:      ${claudePluginDir}`);
  }
  if (fs.existsSync(pluginMcpPath)) {
    let isOnlyLux = false;
    try {
      const parsed = JSON.parse(fs.readFileSync(pluginMcpPath, 'utf-8'));
      const keys = Object.keys(parsed.mcpServers || {});
      isOnlyLux = keys.length === 0 || (keys.length === 1 && keys[0] === 'lux');
    } catch {
      // Fall through to removeMcpConfig if plugin MCP JSON cannot be parsed.
    }
    if (isOnlyLux) {
      if (!dryRun) fs.rmSync(pluginMcpPath, { force: true });
      log(`[ok] Removed plugin MCP:         ${pluginMcpPath}`);
    } else {
      removeMcpConfig(pluginMcpPath, dryRun);
      log(`[ok] Cleaned plugin MCP:         ${pluginMcpPath}`);
    }
  }

  const skillFile = path.join(cwd, 'skills', 'lux', 'SKILL.md');
  const skillWebFile = path.join(cwd, 'skills', 'lux-web', 'SKILL.md');
  const legacySkillFile = path.join(cwd, 'skills', 'lux-review', 'SKILL.md');

  if (removeSkillFile(skillFile, dryRun)) {
    log(`[ok] Removed workspace skill:    ${skillFile}`);
  }
  if (removeSkillFile(skillWebFile, dryRun)) {
    log(`[ok] Removed workspace skill:    ${skillWebFile}`);
  }
  if (removeSkillFile(legacySkillFile, dryRun)) {
    log(`[ok] Removed legacy skill:       ${legacySkillFile}`);
  }

  const agentsDir = path.join(cwd, '.agents');
  if (fs.existsSync(agentsDir)) {
    removeSkillFile(path.join(agentsDir, 'skills', 'lux', 'SKILL.md'), dryRun);
    removeSkillFile(path.join(agentsDir, 'skills', 'lux-web', 'SKILL.md'), dryRun);
    const agentsHooks = path.join(agentsDir, 'hooks.json');
    if (fs.existsSync(agentsHooks) && !dryRun) {
      fs.rmSync(agentsHooks, { force: true });
    }
  }

  log('\nWorkspace cleanup complete.\n');
}
