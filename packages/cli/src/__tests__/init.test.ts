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
  getPackageVersion,
  installCustomPath,
  uninstallCustomPath,
  runInit,
  runUninstall,
  installHarness,
  uninstallHarness,
  AGENT_HARNESSES,
  PLUGIN_MANIFEST,
  CLAUDE_PLUGIN_MANIFEST,
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
      expect(paths.claudePlugin).toBe('/Users/testuser/.claude/skills/lux-edit');
      expect(paths.claudeCodeMcp).toBe('/Users/testuser/.claude.json');
      expect(paths.claudeCodeSkill).toBe('/Users/testuser/.claude/skills/lux/SKILL.md');
      expect(paths.claudeCodeWebSkill).toBe('/Users/testuser/.claude/skills/lux-web/SKILL.md');
      expect(paths.claudeDesktopMcp).toBe('/Users/testuser/Library/Application Support/Claude/claude_desktop_config.json');
      expect(paths.windsurfMcp).toBe('/Users/testuser/.codeium/windsurf/mcp_config.json');
      expect(paths.cursorMcp).toBe('/Users/testuser/.cursor/mcp.json');
      expect(paths.clineMcp).toBe('/Users/testuser/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json');
      expect(paths.rooCodeMcp).toBe('/Users/testuser/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json');
      expect(paths.zedMcp).toBe('/Users/testuser/.config/zed/settings.json');
      expect(paths.continueMcp).toBe('/Users/testuser/.continue/config.json');
      expect(paths.vscodeMcp).toBe('/Users/testuser/.vscode/mcp.json');
    });

    it('resolves correct paths for Linux', () => {
      const paths = getAgentConfigPaths('/home/testuser', 'linux');
      expect(paths.antigravityPlugin).toBe('/home/testuser/.gemini/config/plugins/lux-edit');
      expect(paths.antigravityMcp).toBe('/home/testuser/.gemini/config/mcp_config.json');
      expect(paths.claudePlugin).toBe('/home/testuser/.claude/skills/lux-edit');
      expect(paths.claudeCodeMcp).toBe('/home/testuser/.claude.json');
      expect(paths.claudeCodeSkill).toBe('/home/testuser/.claude/skills/lux/SKILL.md');
      expect(paths.claudeCodeWebSkill).toBe('/home/testuser/.claude/skills/lux-web/SKILL.md');
      expect(paths.claudeDesktopMcp).toBe('/home/testuser/.config/Claude/claude_desktop_config.json');
      expect(paths.clineMcp).toBe('/home/testuser/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json');
      expect(paths.rooCodeMcp).toBe('/home/testuser/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json');
      expect(paths.zedMcp).toBe('/home/testuser/.config/zed/settings.json');
      expect(paths.continueMcp).toBe('/home/testuser/.continue/config.json');
      expect(paths.vscodeMcp).toBe('/home/testuser/.vscode/mcp.json');
    });
  });

  describe('writePluginBundle and removePluginBundle', () => {
    it('writes a complete Agent Plugin bundle (Claude .claude-plugin + Antigravity plugin.json + skills/lux)', () => {
      const pluginDir = path.join(fakeHome, 'plugins', 'lux-edit');
      const ok = writePluginBundle(pluginDir);
      expect(ok).toBe(true);

      // Claude Code official plugin layout
      expect(fs.existsSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginDir, '.claude-plugin', '.mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginDir, '.mcp.json'))).toBe(true);

      const claudeManifest = JSON.parse(fs.readFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf-8'));
      expect(claudeManifest.name).toBe('lux-edit');
      expect(claudeManifest.version).toBe(getPackageVersion());

      const claudeMcp = JSON.parse(fs.readFileSync(path.join(pluginDir, '.claude-plugin', '.mcp.json'), 'utf-8'));
      expect(claudeMcp.lux).toBeDefined();

      // Antigravity & universal Agent Plugin specification
      expect(fs.existsSync(path.join(pluginDir, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginDir, 'mcp_config.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginDir, 'skills', 'lux', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(pluginDir, 'skills', 'lux-web', 'SKILL.md'))).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'));
      expect(manifest.name).toBe('lux-edit');

      const mcp = JSON.parse(fs.readFileSync(path.join(pluginDir, 'mcp_config.json'), 'utf-8'));
      expect(mcp.mcpServers.lux).toBeDefined();

      const skill = fs.readFileSync(path.join(pluginDir, 'skills', 'lux', 'SKILL.md'), 'utf-8');
      expect(skill).toContain('name: lux');

      const skillWeb = fs.readFileSync(path.join(pluginDir, 'skills', 'lux-web', 'SKILL.md'), 'utf-8');
      expect(skillWeb).toContain('name: lux-web');
    });

    it('generates a bundle that passes official claude plugin validate if cli is present', () => {
      const pluginDir = path.join(fakeHome, 'plugins', 'lux-edit-validate');
      writePluginBundle(pluginDir);

      try {
        const { execSync } = require('node:child_process');
        const res = execSync(`claude plugin validate "${pluginDir}"`, { encoding: 'utf-8' });
        expect(res).toContain('Validation passed');
      } catch (err: any) {
        if (err.message?.includes('not found') || err.message?.includes('ENOENT') || err.status === 127) {
          // Gracefully skip when running in environments without Claude CLI
          return;
        }
        throw err;
      }
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

  describe('installCustomPath and uninstallCustomPath', () => {
    it('installs to a specific json file and removes cleanly', () => {
      const customFile = path.join(fakeWorkspace, 'custom-mcp.json');
      const ok = installCustomPath(customFile);
      expect(ok).toBe(true);
      expect(fs.existsSync(customFile)).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(customFile, 'utf-8'));
      expect(parsed.mcpServers.lux).toBeDefined();

      const removed = uninstallCustomPath(customFile);
      expect(removed).toBe(true);
      const parsedAfter = JSON.parse(fs.readFileSync(customFile, 'utf-8'));
      expect(parsedAfter.mcpServers.lux).toBeUndefined();
    });

    it('installs to a custom directory creating mcp.json and skill file', () => {
      const customDir = path.join(fakeWorkspace, 'custom-agent');
      const ok = installCustomPath(customDir);
      expect(ok).toBe(true);
      expect(fs.existsSync(path.join(customDir, 'mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(customDir, 'skills', 'lux', 'SKILL.md'))).toBe(true);

      const removed = uninstallCustomPath(customDir);
      expect(removed).toBe(true);
      expect(fs.existsSync(path.join(customDir, 'skills', 'lux', 'SKILL.md'))).toBe(false);
    });
  });

  describe('runInit and runUninstall', () => {
    it('installs plugin bundles and skips non-detected legacy agents by default', async () => {
      // Simulate that Antigravity (.gemini) and Claude Code (.claude) are installed, but not Cursor/Windsurf
      fs.mkdirSync(path.join(fakeHome, '.gemini'), { recursive: true });
      fs.mkdirSync(path.join(fakeHome, '.claude'), { recursive: true });

      const initLogs: string[] = [];
      await runInit({
        global: true,
        yes: true,
        home: fakeHome,
        logger: (msg) => initLogs.push(msg),
      });

      const paths = getAgentConfigPaths(fakeHome);
      // Antigravity plugin-compatible agent installed
      expect(fs.existsSync(path.join(paths.antigravityPlugin, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(paths.antigravityPlugin, 'mcp_config.json'))).toBe(true);
      expect(fs.existsSync(path.join(paths.antigravityPlugin, 'skills', 'lux', 'SKILL.md'))).toBe(true);

      // Claude Code skills and user-scope MCP installed
      expect(fs.existsSync(paths.claudeCodeSkill)).toBe(true);
      expect(fs.existsSync(paths.claudeCodeWebSkill)).toBe(true);
      expect(fs.existsSync(paths.claudeCodeMcp)).toBe(true);
      const claudeMcp = JSON.parse(fs.readFileSync(paths.claudeCodeMcp, 'utf-8'));
      expect(claudeMcp.mcpServers.lux).toBeDefined();

      // Undetected legacy agents should be skipped (no ghost files)
      expect(fs.existsSync(paths.cursorMcp)).toBe(false);
      expect(fs.existsSync(paths.windsurfMcp)).toBe(false);
      expect(initLogs.some((l) => l.includes('Cursor') && l.includes('not detected, skipped'))).toBe(true);

      const uninstallLogs: string[] = [];
      await runUninstall({
        global: true,
        home: fakeHome,
        logger: (msg) => uninstallLogs.push(msg),
      });

      expect(fs.existsSync(paths.antigravityPlugin)).toBe(false);
      expect(fs.existsSync(paths.claudeCodeSkill)).toBe(false);
      expect(fs.existsSync(paths.claudeCodeWebSkill)).toBe(false);
      const claudeMcpAfter = JSON.parse(fs.readFileSync(paths.claudeCodeMcp, 'utf-8'));
      expect(claudeMcpAfter.mcpServers.lux).toBeUndefined();
      expect(uninstallLogs.some((l) => l.includes('Removed Antigravity plugin'))).toBe(true);
      expect(uninstallLogs.some((l) => l.includes('Removed Claude Code MCP'))).toBe(true);
      expect(uninstallLogs.some((l) => l.includes('Global uninstallation complete'))).toBe(true);
    });

    it('configures Claude Code with both /lux and /lux-web skills and ~/.claude.json when --agent claude is targeted', async () => {
      // Simulate existing ~/.claude.json with custom server and legacy ~/.claude/mcp.json and legacy skill folders
      const claudeJsonPath = path.join(fakeHome, '.claude.json');
      fs.writeFileSync(
        claudeJsonPath,
        JSON.stringify({
          mcpServers: {
            custom: { command: 'node', args: ['server.js'] },
          },
        })
      );
      const legacyMcpPath = path.join(fakeHome, '.claude', 'mcp.json');
      fs.mkdirSync(path.dirname(legacyMcpPath), { recursive: true });
      fs.writeFileSync(legacyMcpPath, JSON.stringify({ mcpServers: { lux: { command: 'npx', args: ['lux'] } } }));

      const legacyEditDir = path.join(fakeHome, '.claude', 'skills', 'lux-edit');
      fs.mkdirSync(legacyEditDir, { recursive: true });
      fs.writeFileSync(path.join(legacyEditDir, 'dummy.txt'), 'old');

      const logs: string[] = [];
      await runInit({
        global: true,
        agent: 'claude',
        home: fakeHome,
        logger: (msg) => logs.push(msg),
      });

      const paths = getAgentConfigPaths(fakeHome);
      // Both skills created
      expect(fs.existsSync(paths.claudeCodeSkill)).toBe(true);
      expect(fs.existsSync(paths.claudeCodeWebSkill)).toBe(true);
      expect(fs.readFileSync(paths.claudeCodeSkill, 'utf-8')).toContain('name: lux');
      expect(fs.readFileSync(paths.claudeCodeWebSkill, 'utf-8')).toContain('name: lux-web');

      // User-scope ~/.claude.json updated, custom server preserved
      const claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
      expect(claudeJson.mcpServers.custom).toEqual({ command: 'node', args: ['server.js'] });
      expect(claudeJson.mcpServers.lux).toEqual({
        command: 'npx',
        args: ['-y', 'lux-edit', 'mcp'],
      });

      // Legacy files cleaned up
      expect(fs.existsSync(legacyEditDir)).toBe(false);
      const legacyMcp = JSON.parse(fs.readFileSync(legacyMcpPath, 'utf-8'));
      expect(legacyMcp.mcpServers.lux).toBeUndefined();

      // Clean uninstall
      await runUninstall({
        global: true,
        agent: 'claude',
        home: fakeHome,
        logger: () => {},
      });

      expect(fs.existsSync(paths.claudeCodeSkill)).toBe(false);
      expect(fs.existsSync(paths.claudeCodeWebSkill)).toBe(false);
      const claudeJsonAfter = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8'));
      expect(claudeJsonAfter.mcpServers.custom).toBeDefined();
      expect(claudeJsonAfter.mcpServers.lux).toBeUndefined();
    });

    it('configures legacy agents when --all is specified', async () => {
      await runInit({
        global: true,
        all: true,
        yes: true,
        home: fakeHome,
        logger: () => {},
      });

      const paths = getAgentConfigPaths(fakeHome);
      expect(fs.existsSync(paths.cursorMcp)).toBe(true);
      expect(fs.existsSync(paths.windsurfMcp)).toBe(true);
      expect(fs.existsSync(paths.claudeDesktopMcp)).toBe(true);
    });

    it('targets a single agent when --agent is specified', async () => {
      await runInit({
        global: true,
        agent: 'cursor',
        yes: true,
        home: fakeHome,
        logger: () => {},
      });

      const paths = getAgentConfigPaths(fakeHome);
      expect(fs.existsSync(paths.cursorMcp)).toBe(true);
      expect(fs.existsSync(paths.windsurfMcp)).toBe(false);
      expect(fs.existsSync(paths.antigravityPlugin)).toBe(false);
    });

    it('targets custom path when --path is specified', async () => {
      const customPath = path.join(fakeWorkspace, 'zed-mcp.json');
      await runInit({
        path: customPath,
        logger: () => {},
      });

      expect(fs.existsSync(customPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
      expect(parsed.mcpServers.lux).toBeDefined();

      await runUninstall({
        path: customPath,
        logger: () => {},
      });
      const parsedAfter = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
      expect(parsedAfter.mcpServers.lux).toBeUndefined();
    });

    it('initializes workspace as an Agent Plugin and cleanly uninstalls workspace files', async () => {
      await runInit({
        global: false,
        home: fakeHome,
        cwd: fakeWorkspace,
        logger: () => {},
      });

      expect(fs.existsSync(path.join(fakeWorkspace, '.claude-plugin', 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, '.claude-plugin', '.mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'mcp_config.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, '.mcp.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'skills', 'lux', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(fakeWorkspace, 'skills', 'lux-web', 'SKILL.md'))).toBe(true);

      await runUninstall({
        global: false,
        home: fakeHome,
        cwd: fakeWorkspace,
        logger: () => {},
      });

      expect(fs.existsSync(path.join(fakeWorkspace, '.claude-plugin'))).toBe(false);
      expect(fs.existsSync(path.join(fakeWorkspace, 'plugin.json'))).toBe(false);
      expect(fs.existsSync(path.join(fakeWorkspace, 'mcp_config.json'))).toBe(false);
      expect(fs.existsSync(path.join(fakeWorkspace, 'skills', 'lux', 'SKILL.md'))).toBe(false);
      expect(fs.existsSync(path.join(fakeWorkspace, 'skills', 'lux-web', 'SKILL.md'))).toBe(false);
    });

    it('non-destructively preserves existing custom servers in workspace mcp.json and syncs .agents', async () => {
      // 1. Create pre-existing mcp.json with a custom server
      const mcpPath = path.join(fakeWorkspace, 'mcp.json');
      fs.writeFileSync(
        mcpPath,
        JSON.stringify({
          mcpServers: {
            supabase: { command: 'npx', args: ['-y', 'supabase-mcp'] },
          },
        })
      );

      // 2. Create .agents directory to verify universal agent standard sync
      const agentsDir = path.join(fakeWorkspace, '.agents');
      fs.mkdirSync(agentsDir, { recursive: true });

      await runInit({
        global: false,
        home: fakeHome,
        cwd: fakeWorkspace,
        logger: () => {},
      });

      // Verify custom server was preserved alongside lux
      const parsed = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      expect(parsed.mcpServers.supabase).toEqual({ command: 'npx', args: ['-y', 'supabase-mcp'] });
      expect(parsed.mcpServers.lux).toBeDefined();

      // Verify .agents skills were created
      expect(fs.existsSync(path.join(agentsDir, 'skills', 'lux', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'skills', 'lux-web', 'SKILL.md'))).toBe(true);

      // 3. Uninstall and verify custom server is still intact
      await runUninstall({
        global: false,
        home: fakeHome,
        cwd: fakeWorkspace,
        logger: () => {},
      });

      const parsedAfter = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      expect(parsedAfter.mcpServers.supabase).toEqual({ command: 'npx', args: ['-y', 'supabase-mcp'] });
      expect(parsedAfter.mcpServers.lux).toBeUndefined();
      expect(fs.existsSync(path.join(agentsDir, 'skills', 'lux', 'SKILL.md'))).toBe(false);
    });

    it('configures lux-edit@latest when autoUpdate is true', async () => {
      const mcpPath = path.join(fakeWorkspace, 'auto-mcp.json');
      mergeMcpConfig(mcpPath, false, true);

      const parsed = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      expect(parsed.mcpServers.lux.args).toEqual(['-y', 'lux-edit@latest', 'mcp']);

      // Default should remain pinned without @latest
      const defaultMcpPath = path.join(fakeWorkspace, 'default-mcp.json');
      mergeMcpConfig(defaultMcpPath, false, false);
      const defaultParsed = JSON.parse(fs.readFileSync(defaultMcpPath, 'utf-8'));
      expect(defaultParsed.mcpServers.lux.args).toEqual(['-y', 'lux-edit', 'mcp']);

      // Workspace runInit with autoUpdate
      await runInit({
        global: false,
        home: fakeHome,
        cwd: fakeWorkspace,
        autoUpdate: true,
        logger: () => {},
      });

      const wsMcp = JSON.parse(fs.readFileSync(path.join(fakeWorkspace, 'mcp.json'), 'utf-8'));
      expect(wsMcp.mcpServers.lux.args).toEqual(['-y', 'lux-edit@latest', 'mcp']);
    });
  });

  describe('Harness Registry and Contract Invariants', () => {
    it('defines non-empty, unique keys for every registered harness', () => {
      const keys = AGENT_HARNESSES.map((h) => h.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
      for (const harness of AGENT_HARNESSES) {
        expect(harness.name).toBeTruthy();
        expect(['bundle', 'flat', 'none']).toContain(harness.skillsStrategy);
      }
    });

    it('enforces Claude Code contract invariants (no ~/.claude/mcp.json, flat skills layout)', () => {
      const claude = AGENT_HARNESSES.find((h) => h.key === 'claude')!;
      expect(claude).toBeDefined();

      const mcpPath = claude.mcpPath!('/Users/testuser', 'darwin');
      expect(mcpPath).toBe('/Users/testuser/.claude.json');
      expect(mcpPath).not.toContain('/.claude/mcp.json');

      expect(claude.skillsStrategy).toBe('flat');
      const skills = claude.skillsPaths!('/Users/testuser', 'darwin');
      expect(skills.length).toBe(2);
      expect(skills.map((s) => s.path)).toEqual([
        '/Users/testuser/.claude/skills/lux/SKILL.md',
        '/Users/testuser/.claude/skills/lux-web/SKILL.md',
      ]);

      const legacyClean = claude.cleanLegacyPaths!('/Users/testuser', 'darwin');
      expect(legacyClean).toContain('/Users/testuser/.claude/skills/lux-edit');
      expect(legacyClean).toContain('/Users/testuser/.claude/mcp.json');
    });

    it('enforces Google Antigravity contract invariants (plugin bundle with skills and mcp)', () => {
      const antigravity = AGENT_HARNESSES.find((h) => h.key === 'antigravity')!;
      expect(antigravity).toBeDefined();
      expect(antigravity.skillsStrategy).toBe('bundle');
      const bundleDir = antigravity.bundlePath!('/Users/testuser', 'darwin');
      expect(bundleDir).toBe('/Users/testuser/.gemini/config/plugins/lux-edit');
    });

    it('enforces Standalone MCP client contract invariants (Cursor, Windsurf, Claude Desktop)', () => {
      const cursor = AGENT_HARNESSES.find((h) => h.key === 'cursor')!;
      expect(cursor.skillsStrategy).toBe('none');
      expect(cursor.mcpPath!('/Users/testuser', 'darwin')).toBe('/Users/testuser/.cursor/mcp.json');

      const windsurf = AGENT_HARNESSES.find((h) => h.key === 'windsurf')!;
      expect(windsurf.skillsStrategy).toBe('none');
      expect(windsurf.mcpPath!('/Users/testuser', 'darwin')).toBe('/Users/testuser/.codeium/windsurf/mcp_config.json');

      const desktopMac = AGENT_HARNESSES.find((h) => h.key === 'desktop')!.mcpPath!('/Users/testuser', 'darwin');
      expect(desktopMac).toContain('Library/Application Support/Claude/claude_desktop_config.json');

      const desktopLinux = AGENT_HARNESSES.find((h) => h.key === 'desktop')!.mcpPath!('/home/testuser', 'linux');
      expect(desktopLinux).toBe('/home/testuser/.config/Claude/claude_desktop_config.json');
    });

    it('enforces editor and extension harness contract invariants (Cline, Roo, Zed, Continue, VS Code)', () => {
      // 1. Cline & Roo Code
      const cline = AGENT_HARNESSES.find((h) => h.key === 'cline')!;
      expect(cline.mcpPath!('/Users/testuser', 'darwin')).toContain('saoudrizwan.claude-dev/settings/cline_mcp_settings.json');

      const roo = AGENT_HARNESSES.find((h) => h.key === 'roo')!;
      expect(roo.mcpPath!('/Users/testuser', 'darwin')).toContain('rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json');

      // 2. Zed
      const zed = AGENT_HARNESSES.find((h) => h.key === 'zed')!;
      expect(zed.mcpPath!('/Users/testuser', 'darwin')).toBe('/Users/testuser/.config/zed/settings.json');
      expect(zed.mcpPath!('/home/testuser', 'linux')).toBe('/home/testuser/.config/zed/settings.json');

      // 3. Continue.dev
      const continueHarness = AGENT_HARNESSES.find((h) => h.key === 'continue')!;
      expect(continueHarness.mcpPath!('/Users/testuser', 'darwin')).toBe('/Users/testuser/.continue/config.json');

      // 4. VS Code
      const vscode = AGENT_HARNESSES.find((h) => h.key === 'vscode')!;
      expect(vscode.mcpPath!('/Users/testuser', 'darwin')).toBe('/Users/testuser/.vscode/mcp.json');
    });

    it('installs and uninstalls Zed and Continue cleanly', async () => {
      const zedFile = path.join(fakeHome, '.config', 'zed', 'settings.json');
      fs.mkdirSync(path.dirname(zedFile), { recursive: true });
      fs.writeFileSync(zedFile, JSON.stringify({ theme: 'One Dark' }));

      const continueFile = path.join(fakeHome, '.continue', 'config.json');
      fs.mkdirSync(path.dirname(continueFile), { recursive: true });
      fs.writeFileSync(continueFile, JSON.stringify({ models: [] }));

      // Test Zed install/uninstall
      const zed = AGENT_HARNESSES.find((h) => h.key === 'zed')!;
      installHarness(zed, fakeHome, false, false, () => {});
      const zedConfig = JSON.parse(fs.readFileSync(zedFile, 'utf-8'));
      expect(zedConfig.theme).toBe('One Dark');
      expect(zedConfig.context_servers.lux).toBeDefined();

      uninstallHarness(zed, fakeHome, false, () => {});
      const zedConfigAfter = JSON.parse(fs.readFileSync(zedFile, 'utf-8'));
      expect(zedConfigAfter.context_servers.lux).toBeUndefined();

      // Test Continue install/uninstall
      const cont = AGENT_HARNESSES.find((h) => h.key === 'continue')!;
      installHarness(cont, fakeHome, false, false, () => {});
      const continueConfig = JSON.parse(fs.readFileSync(continueFile, 'utf-8'));
      expect(continueConfig.models).toEqual([]);
      expect(continueConfig.mcpServers.some((s: any) => s.name === 'lux')).toBe(true);

      uninstallHarness(cont, fakeHome, false, () => {});
      const continueConfigAfter = JSON.parse(fs.readFileSync(continueFile, 'utf-8'));
      expect(continueConfigAfter.mcpServers.some((s: any) => s.name === 'lux')).toBe(false);
    });
  });

  describe('Manifest Version Consistency & Drift Gate', () => {
    it('ensures all exported plugin manifests dynamically match the active package version', () => {
      const pkgVersion = getPackageVersion();
      expect(PLUGIN_MANIFEST.version).toBe(pkgVersion);
      expect(CLAUDE_PLUGIN_MANIFEST.version).toBe(pkgVersion);

      // Verify serialization preserves dynamic version
      const serializedPlugin = JSON.parse(JSON.stringify(PLUGIN_MANIFEST));
      expect(serializedPlugin.version).toBe(pkgVersion);

      const serializedClaude = JSON.parse(JSON.stringify(CLAUDE_PLUGIN_MANIFEST));
      expect(serializedClaude.version).toBe(pkgVersion);
    });

    it('verifies root repository manifest files match active package.json version', () => {
      const rootPkgPath = path.resolve(__dirname, '../../../../package.json');
      if (fs.existsSync(rootPkgPath)) {
        const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
        const rootDir = path.dirname(rootPkgPath);

        const pluginJsonPath = path.join(rootDir, 'plugin.json');
        if (fs.existsSync(pluginJsonPath)) {
          const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
          expect(pluginJson.version).toBe(rootPkg.version);
        }

        const claudePluginPath = path.join(rootDir, '.claude-plugin', 'plugin.json');
        if (fs.existsSync(claudePluginPath)) {
          const claudeJson = JSON.parse(fs.readFileSync(claudePluginPath, 'utf-8'));
          expect(claudeJson.version).toBe(rootPkg.version);
        }

        const serverJsonPath = path.join(rootDir, 'server.json');
        if (fs.existsSync(serverJsonPath)) {
          const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, 'utf-8'));
          expect(serverJson.version).toBe(rootPkg.version);
        }
      }
    });
  });

  describe('Black-Box Harness Verification', () => {
    it('verifies Claude Code user scope registration produces valid YAML frontmatter and MCP JSON schema', async () => {
      const claudeHome = path.join(fakeHome, 'claude-smoke');
      fs.mkdirSync(claudeHome, { recursive: true });

      await runInit({
        global: true,
        agent: 'claude',
        home: claudeHome,
        logger: () => {},
      });

      const paths = getAgentConfigPaths(claudeHome);
      // Verify skill frontmatter format
      const skillLux = fs.readFileSync(paths.claudeCodeSkill, 'utf-8');
      expect(skillLux).toMatch(/^---\r?\nname:\s*lux\r?\ndescription:/m);

      const skillWeb = fs.readFileSync(paths.claudeCodeWebSkill, 'utf-8');
      expect(skillWeb).toMatch(/^---\r?\nname:\s*lux-web\r?\ndescription:/m);

      // Verify MCP structure adheres to Claude Code ~/.claude.json mcpServers schema
      const claudeJson = JSON.parse(fs.readFileSync(paths.claudeCodeMcp, 'utf-8'));
      expect(claudeJson.mcpServers).toBeDefined();
      expect(claudeJson.mcpServers.lux).toEqual({
        command: 'npx',
        args: ['-y', 'lux-edit', 'mcp'],
      });
    });
  });
});

