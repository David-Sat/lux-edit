import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  mergeMcpConfig,
  removeMcpConfig,
  writeSkillFile,
  removeSkillFile,
  writePluginBundle,
  removePluginBundle,
  isAgentInstalled,
  getAgentConfigPaths,
  runInit,
  runUninstall,
} from '../init.js';

describe('lux init and multi-agent configuration', () => {
  const testDir = path.join(os.tmpdir(), `lux-init-test-${Date.now()}`);
  const fakeHome = path.join(testDir, 'home');
  const fakeWorkspace = path.join(testDir, 'workspace');

  beforeEach(() => {
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.mkdirSync(fakeWorkspace, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('getAgentConfigPaths', () => {
    it('resolves correct paths for macOS (darwin)', () => {
      const paths = getAgentConfigPaths('/Users/testuser', 'darwin');
      expect(paths.antigravityPlugin).toBe('/Users/testuser/.gemini/config/plugins/lux-edit');
      expect(paths.antigravityMcp).toBe('/Users/testuser/.gemini/config/mcp_config.json');
      expect(paths.antigravitySkill).toBe('/Users/testuser/.gemini/config/skills/lux/SKILL.md');
      expect(paths.claudePlugin).toBe('/Users/testuser/.claude/plugins/lux-edit');
      expect(paths.claudeCodeMcp).toBe('/Users/testuser/.claude/mcp.json');
      expect(paths.claudeCodeSkill).toBe('/Users/testuser/.claude/skills/lux/SKILL.md');
      expect(paths.claudeDesktopMcp).toBe('/Users/testuser/Library/Application Support/Claude/claude_desktop_config.json');
      expect(paths.windsurfMcp).toBe('/Users/testuser/.codeium/windsurf/mcp_config.json');
      expect(paths.cursorMcp).toBe('/Users/testuser/.cursor/mcp.json');
      expect(paths.clineMcp).toBe('/Users/testuser/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json');
      expect(paths.rooCodeMcp).toBe('/Users/testuser/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json');
    });

    it('resolves correct paths for Linux', () => {
      const paths = getAgentConfigPaths('/home/testuser', 'linux');
      expect(paths.antigravityPlugin).toBe('/home/testuser/.gemini/config/plugins/lux-edit');
      expect(paths.antigravityMcp).toBe('/home/testuser/.gemini/config/mcp_config.json');
      expect(paths.claudeDesktopMcp).toBe('/home/testuser/.config/Claude/claude_desktop_config.json');
      expect(paths.clineMcp).toBe('/home/testuser/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json');
      expect(paths.rooCodeMcp).toBe('/home/testuser/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json');
    });
  });

  describe('writePluginBundle and removePluginBundle', () => {
    it('writes a complete Agent Plugin bundle (plugin.json, mcp_config.json, skills/lux/SKILL.md)', () => {
      const pluginDir = path.join(fakeHome, 'plugins', 'lux-edit');
      const ok = writePluginBundle(pluginDir);
      expect(ok).toBe(true);

      expect(fs.existsSync(path.join(pluginDir, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginDir, 'mcp_config.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginDir, 'skills', 'lux', 'SKILL.md'))).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'));
      expect(manifest.name).toBe('lux-edit');

      const mcp = JSON.parse(fs.readFileSync(path.join(pluginDir, 'mcp_config.json'), 'utf-8'));
      expect(mcp.mcpServers.lux).toBeDefined();

      const skill = fs.readFileSync(path.join(pluginDir, 'skills', 'lux', 'SKILL.md'), 'utf-8');
      expect(skill).toContain('name: lux');
    });

    it('removes an Agent Plugin bundle directory', () => {
      const pluginDir = path.join(fakeHome, 'plugins', 'lux-edit');
      writePluginBundle(pluginDir);
      expect(fs.existsSync(pluginDir)).toBe(true);

      const ok = removePluginBundle(pluginDir);
      expect(ok).toBe(true);
      expect(fs.existsSync(pluginDir)).toBe(false);
    });
  });

  describe('isAgentInstalled', () => {
    it('detects antigravity and claude when dot-directories exist', () => {
      expect(isAgentInstalled('antigravity', fakeHome)).toBe(false);
      fs.mkdirSync(path.join(fakeHome, '.gemini'), { recursive: true });
      expect(isAgentInstalled('antigravity', fakeHome)).toBe(true);

      expect(isAgentInstalled('claude', fakeHome)).toBe(false);
      fs.mkdirSync(path.join(fakeHome, '.claude'), { recursive: true });
      expect(isAgentInstalled('claude', fakeHome)).toBe(true);
    });

    it('detects cursor and windsurf when config directory exists', () => {
      expect(isAgentInstalled('cursor', fakeHome, 'linux')).toBe(false);
      fs.mkdirSync(path.join(fakeHome, '.cursor'), { recursive: true });
      expect(isAgentInstalled('cursor', fakeHome, 'linux')).toBe(true);

      expect(isAgentInstalled('windsurf', fakeHome, 'linux')).toBe(false);
      fs.mkdirSync(path.join(fakeHome, '.codeium', 'windsurf'), { recursive: true });
      expect(isAgentInstalled('windsurf', fakeHome, 'linux')).toBe(true);
    });
  });

  describe('mergeMcpConfig', () => {
    it('creates new config file with lux MCP server', () => {
      const targetPath = path.join(fakeHome, 'config', 'mcp.json');
      const ok = mergeMcpConfig(targetPath);
      expect(ok).toBe(true);
      expect(fs.existsSync(targetPath)).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      expect(parsed.mcpServers.lux).toEqual({
        command: 'npx',
        args: ['-y', 'lux-edit', 'mcp'],
      });
    });

    it('merges lux into existing config while preserving other servers and removing legacy keys', () => {
      const targetPath = path.join(fakeHome, 'config', 'mcp.json');
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(
        targetPath,
        JSON.stringify({
          mcpServers: {
            customServer: { command: 'node', args: ['server.js'] },
            'lux-review': { command: 'npx', args: ['old-server'] },
            'visual-edit': { command: 'npx', args: ['old-server'] },
          },
        })
      );

      const ok = mergeMcpConfig(targetPath);
      expect(ok).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      expect(parsed.mcpServers.customServer).toEqual({ command: 'node', args: ['server.js'] });
      expect(parsed.mcpServers.lux).toEqual({
        command: 'npx',
        args: ['-y', 'lux-edit', 'mcp'],
      });
      expect(parsed.mcpServers['lux-review']).toBeUndefined();
      expect(parsed.mcpServers['visual-edit']).toBeUndefined();
    });

    it('respects dryRun flag by not writing files', () => {
      const targetPath = path.join(fakeHome, 'config', 'dryrun.json');
      const ok = mergeMcpConfig(targetPath, true);
      expect(ok).toBe(true);
      expect(fs.existsSync(targetPath)).toBe(false);
    });
  });

  describe('removeMcpConfig and removeSkillFile', () => {
    it('removes lux and legacy keys from MCP config while retaining others', () => {
      const targetPath = path.join(fakeHome, 'config', 'mcp.json');
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(
        targetPath,
        JSON.stringify({
          mcpServers: {
            customServer: { command: 'node', args: ['server.js'] },
            lux: { command: 'npx', args: ['lux'] },
          },
        })
      );

      const modified = removeMcpConfig(targetPath);
      expect(modified).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      expect(parsed.mcpServers.customServer).toEqual({ command: 'node', args: ['server.js'] });
      expect(parsed.mcpServers.lux).toBeUndefined();
    });

    it('removes skill file and empty parent directory', () => {
      const skillPath = path.join(fakeHome, 'skills', 'lux', 'SKILL.md');
      writeSkillFile(skillPath);
      expect(fs.existsSync(skillPath)).toBe(true);

      const ok = removeSkillFile(skillPath);
      expect(ok).toBe(true);
      expect(fs.existsSync(skillPath)).toBe(false);
      expect(fs.existsSync(path.dirname(skillPath))).toBe(false);
    });
  });

  describe('runInit and runUninstall', () => {
    it('installs plugin bundles and skips non-detected legacy agents by default', () => {
      const initLogs: string[] = [];
      runInit({
        global: true,
        home: fakeHome,
        logger: (msg) => initLogs.push(msg),
      });

      const paths = getAgentConfigPaths(fakeHome);
      // Plugin-compatible agents installed
      expect(fs.existsSync(path.join(paths.antigravityPlugin, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(paths.antigravityPlugin, 'mcp_config.json'))).toBe(true);
      expect(fs.existsSync(path.join(paths.antigravityPlugin, 'skills', 'lux', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(paths.claudePlugin, 'plugin.json'))).toBe(true);

      // Undetected legacy agents should be skipped (no ghost files)
      expect(fs.existsSync(paths.cursorMcp)).toBe(false);
      expect(fs.existsSync(paths.windsurfMcp)).toBe(false);
      expect(initLogs.some((l) => l.includes('Cursor') && l.includes('not detected, skipped'))).toBe(true);

      const uninstallLogs: string[] = [];
      runUninstall({
        global: true,
        home: fakeHome,
        logger: (msg) => uninstallLogs.push(msg),
      });

      expect(fs.existsSync(paths.antigravityPlugin)).toBe(false);
      expect(fs.existsSync(paths.claudePlugin)).toBe(false);
      expect(uninstallLogs.some((l) => l.includes('Removed Antigravity plugin'))).toBe(true);
      expect(uninstallLogs.some((l) => l.includes('Global uninstallation complete'))).toBe(true);
    });

    it('configures legacy agents when --all is specified', () => {
      runInit({
        global: true,
        all: true,
        home: fakeHome,
        logger: () => {},
      });

      const paths = getAgentConfigPaths(fakeHome);
      expect(fs.existsSync(paths.cursorMcp)).toBe(true);
      expect(fs.existsSync(paths.windsurfMcp)).toBe(true);
      expect(fs.existsSync(paths.claudeDesktopMcp)).toBe(true);
    });

    it('targets a single agent when --agent is specified', () => {
      runInit({
        global: true,
        agent: 'cursor',
        home: fakeHome,
        logger: () => {},
      });

      const paths = getAgentConfigPaths(fakeHome);
      expect(fs.existsSync(paths.cursorMcp)).toBe(true);
      expect(fs.existsSync(paths.windsurfMcp)).toBe(false);
      expect(fs.existsSync(paths.antigravityPlugin)).toBe(false);
    });

    it('initializes workspace as an Agent Plugin and cleanly uninstalls workspace files', () => {
      runInit({
        global: false,
        home: fakeHome,
        cwd: fakeWorkspace,
        logger: () => {},
      });

      expect(fs.existsSync(path.join(fakeWorkspace, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'mcp_config.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, '.mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'skills', 'lux', 'SKILL.md'))).toBe(true);

      runUninstall({
        global: false,
        home: fakeHome,
        cwd: fakeWorkspace,
        logger: () => {},
      });

      expect(fs.existsSync(path.join(fakeWorkspace, 'plugin.json'))).toBe(false);
      expect(fs.existsSync(path.join(fakeWorkspace, 'mcp_config.json'))).toBe(false);
      expect(fs.existsSync(path.join(fakeWorkspace, 'skills', 'lux', 'SKILL.md'))).toBe(false);
    });
  });
});

