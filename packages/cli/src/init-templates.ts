import fs from 'node:fs';
import path from 'node:path';
import { getAntigravityHooksContent } from './hooks.js';

export const SKILL_CONTENT = `---
name: lux
description: In-browser visual review, live/batch UI editing, visual screenshot verification, and component variant exploration with lux for local projects, dev servers (localhost/127.0.0.1), and static HTML files where code changes will be applied directly to the user's codebase. Use when the user wants to visually edit or review their own app, or runs /lux. Do NOT use for external third-party websites or online articles (use /lux-web instead).
---

# lux — Local Visual Review & UI Editing

> **User-Hosted Apps Only:** For external websites/articles with no local codebase, use \`/lux-web\`.

## Core Rules
- **Absolute Priority:** When woken by \`[LUX VISUAL REVIEW INTERRUPTION]\` or pending feedback, handle the visual review first—before any unrelated conversation.
- **Never Fake-Resolve:** Every review must end in real source edits or proposed variants (never a no-op resolve).
- **Variant Requests:** If feedback mentions "options", "variants", "choices", "alternatives", or "different designs", call \`lux_propose_variants\` (2–4 options) instead of making a single guess.
- **Keep Running Server Alive:** Never kill or restart an active \`lux\` server (it drops live WebSocket tabs and pinned comments).

## Workflow

### 1. Read Pending Feedback
Call \`lux_get_pending_review({ workspaceDir: "<abs-workspace-root>" })\`—it auto-discovers the active server, claims items \`in_progress\`, and returns \`sessionId\`, \`revisionHash\`, and \`nextCursor\`.

### 2. Apply & Resolve
- **When variants are requested:** Call \`lux_propose_variants\` with 2–4 named options and \`resolveSessionId: "<sessionId>"\` (proposes and resolves atomically).
- **For direct code edits:** Update the relevant component/style files, optionally verify pixels with \`lux_capture_visual\`, then call \`lux_resolve_review({ sessionId, expectedHash: "<revisionHash>", modifiedSelectors, reply, workspaceDir })\` to trigger the Green Verification Halo.
  - On a stale-hash conflict, re-read \`lux_get_pending_review\` to pick up newer feedback before resolving.

### 3. Start / Wait Loop (Live & Batch)
- **If no server is running:** Start \`lux <dev-url-or-file> --port 4320\` in the background (use another free port if \`4320\` is busy) and tell the user to open \`http://127.0.0.1:<port>\` (**C** comments, **R** voice walkthrough, **V** styles, **S** screenshot; **Live** streams automatically, **Batch** waits for Submit Review).
- **Waiting for follow-up feedback:**
  - **Claude Code / Codex:** Lifecycle hooks (\`PostToolUse\` + \`Stop\`) wake automatically—end your turn.
  - **Antigravity:** If no waiter is running, launch \`npx lux-edit hook wait\` (\`WaitMsBeforeAsync: 500\`, \`IsDaemon: false\`) and end your turn so chat stays interactive.
  - **Pure-MCP clients:** Call \`lux_wait_for_feedback({ afterCursor: <nextCursor>, workspaceDir })\`.
`;

export const SKILL_WEB_CONTENT = `---
name: lux-web
description: In-browser visual inspection, teardown, discussion, and explanation of external, third-party websites, online articles, and competitor designs using lux. Use EXCLUSIVELY for external sources and remote internet pages that are NOT hosted by the user and where there is no local codebase to modify. Do NOT use for user-hosted apps, local dev servers, or local HTML files (use /lux instead).
---

# lux-web — External Web Teardown & Discussion

> **External Sites Only:** Never search or edit local codebase files for \`/lux-web\`. Use \`/lux\` for local apps and dev servers.

## Workflow

### 1. Proxy the Target URL
If no \`lux\` server is running for the target URL (never kill an active server on another task—pick a free port like \`4330\` if \`4320\` is busy):
\`\`\`bash
lux <external-url> --port <port>
\`\`\`
Tell the user to open \`http://127.0.0.1:<port>\` (**C** comment or highlight text, **R** voice walkthrough, **V** inspect styles, **S** screenshot; **Live** or **Batch** mode).

### 2. Read, Analyze & Resolve
1. Call \`lux_get_pending_review({ workspaceDir: "<abs-workspace-root>" })\` (and optionally \`lux_capture_visual\` to inspect rendered pixels). Note \`sessionId\`, \`revisionHash\`, and \`nextCursor\`.
2. **Respond without local edits:**
   - **UI teardowns:** Explain layout/CSS/interactions with reusable snippets, or call \`lux_propose_variants\` (2–4 live variations + \`resolveSessionId\`) to preview alternatives in-browser.
   - **Articles/docs:** Answer questions and summarize highlighted passages, referencing each element's selector and text snippet.
3. Unless already resolved via \`lux_propose_variants({ resolveSessionId })\`, call \`lux_resolve_review({ sessionId, expectedHash: "<revisionHash>", reply, workspaceDir })\` to record your answer in the drawer.

### 3. Wait for Follow-ups
- **Claude Code / Codex:** Lifecycle hooks wake on new feedback—end your turn.
- **Antigravity:** Launch \`npx lux-edit hook wait\` (\`WaitMsBeforeAsync: 500\`, \`IsDaemon: false\`) and end your turn.
- **Pure-MCP clients:** Call \`lux_wait_for_feedback({ afterCursor: <nextCursor>, workspaceDir })\`.
`;

declare const __PACKAGE_VERSION__: string | undefined;

export function getPackageVersion(): string {
  if (typeof __PACKAGE_VERSION__ !== 'undefined' && __PACKAGE_VERSION__) {
    return __PACKAGE_VERSION__;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
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
  keywords: ['visual-editing', 'mcp', 'overlay', 'ui-review', 'agent-plugin', 'tailwind', 'design-tokens'],
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
  keywords: ['visual-editing', 'mcp', 'overlay', 'ui-review', 'tailwind', 'design-tokens'],
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

/** Writes a self-contained Agent Plugin bundle (Claude Code `.claude-plugin` + Antigravity `plugin.json` + `hooks.json` + skills). */
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
      const agyHooks = getAntigravityHooksContent(autoUpdate);

      // Claude Code official plugin layout
      fs.writeFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), JSON.stringify(CLAUDE_PLUGIN_MANIFEST, null, 2) + '\n');
      fs.writeFileSync(path.join(pluginDir, '.claude-plugin', '.mcp.json'), JSON.stringify(claudeDotMcp, null, 2) + '\n');
      fs.writeFileSync(path.join(pluginDir, '.mcp.json'), JSON.stringify(mcpConfig, null, 2) + '\n');

      // Antigravity & Agent Plugin specification (with native root hooks.json)
      fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(PLUGIN_MANIFEST, null, 2) + '\n');
      fs.writeFileSync(path.join(pluginDir, 'mcp_config.json'), JSON.stringify(mcpConfig, null, 2) + '\n');
      fs.writeFileSync(path.join(pluginDir, 'hooks.json'), JSON.stringify(agyHooks, null, 2) + '\n');

      // Skills
      fs.writeFileSync(path.join(pluginDir, 'skills', 'lux', 'SKILL.md'), SKILL_CONTENT);
      fs.writeFileSync(path.join(pluginDir, 'skills', 'lux-web', 'SKILL.md'), SKILL_WEB_CONTENT);
    }
    return true;
  } catch {
    return false;
  }
}

/** Removes an Agent Plugin bundle directory. */
export function removePluginBundle(pluginDir: string, dryRun: boolean = false): boolean {
  try {
    if (!fs.existsSync(pluginDir)) return false;
    if (!dryRun) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
    }
    return true;
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
  } catch {
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
  } catch {
    return false;
  }
}
