import fs from 'node:fs';
import path from 'node:path';
import { getAntigravityHooksContent } from './hooks.js';

export const SKILL_CONTENT = `---
name: lux
description: In-browser visual review, live/batch UI editing, visual screenshot verification, and component variant exploration with lux for local projects, dev servers (localhost/127.0.0.1), and static HTML files where code changes will be applied directly to the user's codebase. Use when the user wants to visually edit or review their own app, or runs /lux. Do NOT use for external third-party websites or online articles (use /lux-web instead).
---

# lux visual review and UI editing

> [!NOTE]
> **User-Hosted Apps Only:** \`lux\` is for reviewing and visually modifying the user's own codebase (running local dev servers like \`http://localhost:3000\` or local files). For exploring or tearing down external, third-party websites and online articles, use \`/lux-web\`.

lux runs an in-browser visual editing overlay on running web apps, dev servers, and static HTML files with **Live Streaming Mode**, **Batch Review Mode**, **Multi-Target Voice Walkthroughs**, **Visual Capture (\`lux_capture_visual\`)**, and **Component Variants (\`lux_propose_variants\`)**.

## Workflow for \`/lux\`

When the user runs \`/lux\`, asks to review visual edits/comments, or when woken automatically by a lifecycle hook:

### 0. Absolute Priority & Action Directives
> [!IMPORTANT]
> - **Visual Feedback Takes Absolute Precedence:** When woken by a \`[LUX VISUAL REVIEW INTERRUPTION]\` or when visual reviews exist, you must address the visual feedback immediately. Do NOT continue prior conversation topics or old test discussions until the visual review is fulfilled.
> - **Never Fake-Resolve:** Never call \`lux_resolve_review\` or mark a review resolved as a no-op or dismissal. Every review must either result in applied code edits in the source files, or proposed component variants.
> - **Variant Requests:** If any comment, transcript, or prompt mentions "options", "variants", "choices", "alternatives", or "different designs", you MUST call \`lux_propose_variants\` with 2–4 options so the user can preview them live in the browser. Do NOT make a single arbitrary code edit.

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

Passing \`workspaceDir\` ensures lux finds \`.visual-edit/sessions.jsonl\` and connects to the active server even when started from a global plugin folder.

### 2. When comments, voice sections, variant decisions, or edits exist
1. Read the returned mutations, pinned comments, sectioned voice walkthroughs, and approved component variants. Note the \`sessionId\`, \`revisionHash\`, and \`nextCursor\`.
2. If the user asks you to explore multiple visual designs for an element, call \`lux_propose_variants\` with 2–4 named options so the user can toggle and pick one live in the browser. Pass \`resolveSessionId: "<sessionId>"\` (and an optional \`reply\`) when proposing variants in response to an active review so proposing and resolving happen atomically in one call.
3. Otherwise, find the relevant component files in the project (React/JSX/TSX, Vue, Svelte, HTML, Tailwind classes, or CSS) and apply the requested code edits directly.
4. Optionally call \`lux_capture_visual\` to visually inspect the rendered pixels and verify there are no layout overflow issues.
5. Call \`lux_resolve_review\` (passing \`expectedHash\` and \`modifiedSelectors\`) so the browser highlights the updated elements with a Green Verification Halo (skip if already resolved via \`lux_propose_variants({ resolveSessionId })\`).
6. **Seamless Live & Batch Wakeup:**
   - **In Claude Code / Codex:** Lifecycle hooks (\`PostToolUse\` + \`Stop\`) automatically hold and wake you when the user submits new Live or Batch feedback—simply finish your turn.
   - **In Antigravity:** To avoid locking the Antigravity chat in \`"Working"\` state while still waking immediately on browser edits, launch \`npx lux-edit hook wait\` via \`run_command\` with \`WaitMsBeforeAsync: 500\` and \`IsDaemon: false\`, then immediately finish your turn.
   - **In Pure-MCP Clients (Cursor, Windsurf, VS Code, Zed, Claude Desktop) or Direct Loops:** Call \`lux_wait_for_feedback\` passing \`afterCursor: <nextCursor>\` (and \`workspaceDir\`) to block efficiently until the user makes another Live edit, Variant pick, or Batch submission.

### 3. When no pending edits are found
Do not restart or kill the lux server if it is already running. Restarting drops active browser sessions and clears pinned comments.

Check whether a review server is already running on port 4320:

- **If the server is running:**
  1. In Antigravity, if no background waiter is active yet, start \`npx lux-edit hook wait\` (\`WaitMsBeforeAsync: 500, IsDaemon: false\`) so browser submissions wake you automatically while leaving the chat input free; in pure-MCP clients without hooks, call \`lux_wait_for_feedback\` once the user asks you to wait for edits.
  2. Tell the user:
     "The lux review server is running at \`http://127.0.0.1:4320\`. Switch between **Live** and **Batch** mode in the dock, press **V** to edit styles, **C** to drop comment pins, **S** to capture element screenshots, or **R** for multi-target voice dictation."

- **If the server is not running:**
  1. Find the running dev server URL (e.g. \`http://localhost:3000\`, \`http://localhost:5173\`) or static HTML file (e.g. \`./index.html\`).
  2. Start lux in the background:
     \`\`\`bash
     lux <url-or-file> --port 4320
     \`\`\`
  3. In Antigravity, also start the background review waiter (\`npx lux-edit hook wait\` with \`WaitMsBeforeAsync: 500, IsDaemon: false\`) so browser feedback wakes you automatically.
  4. Tell the user:
     "Open \`http://127.0.0.1:4320\` in your browser. Press C to drop comment pins, R to record a sectioned voice walkthrough, or V to adjust styles. In Live mode, your feedback streams to me automatically; in Batch mode, click Submit Review when ready."
`;

export const SKILL_WEB_CONTENT = `---
name: lux-web
description: In-browser visual inspection, teardown, discussion, and explanation of external, third-party websites, online articles, and competitor designs using lux. Use EXCLUSIVELY for external sources and remote internet pages that are NOT hosted by the user and where there is no local codebase to modify. Do NOT use for user-hosted apps, local dev servers, or local HTML files (use /lux instead).
---

# lux-web: Web Research, UI Teardown & Article Discussion

> [!IMPORTANT]
> **External Sources Only:** \`lux-web\` is strictly for inspecting, discussing, and tearing down **external, third-party websites, online articles, and design references** on the internet where there is no local codebase to modify. If the user wants to visually edit, review, or modify an application or website hosted by themselves (e.g., \`localhost\`, dev servers, or local files), use \`/lux\` instead.

\`lux-web\` proxies live external websites, online articles, and public web apps through lux's in-browser overlay, allowing users to drop comment pins, highlight phrases, record multi-target voice walkthroughs, and discuss the design, architecture, or content directly with an AI coding agent.

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
   - Press **R** to record a sectioned voice walkthrough while clicking across elements.
   - Press **V** to inspect computed styles, layout rules, and DOM elements.
   - Use **Live Mode** for instant streaming or **Batch Mode** and click **Submit Review** when ready!"

### 2. Reviewing Comments & In-Browser Discussion

When the user asks to review, runs \`/lux-web\`, or when woken by a lifecycle hook:

1. Call \`lux_get_pending_review\` (and optionally \`lux_capture_visual\` to see the exact visual rendering of the pinned component).
2. **Crucial distinction from local \`/lux\`:**
   - **DO NOT attempt to find or edit local files** for external websites.
   - Treat the user's pins, selectors, voice sections, and style edits as grounds for **technical analysis, design explanation, or content discussion**:
     - **For UI / Design Teardowns:** Explain the layout technique (Flexbox/Grid), CSS properties (transforms, shadows, backdrop-filters, custom properties), or interactive patterns. Provide clean, modular code snippets (e.g., React + Tailwind or CSS) showing how the user can replicate the effect in their own project, or use \`lux_propose_variants\` (passing \`resolveSessionId\` to resolve in the same call) to preview live variations in the browser.
     - **For Articles & Documentation:** Address the user's questions, break down complex concepts, summarize highlighted text, or clarify difficult equations/theorems based on the pinned DOM context.
3. Call \`lux_resolve_review\` with your summary reply so it is recorded in the review drawer (unless already resolved via \`lux_propose_variants({ resolveSessionId })\`), and respond in structured markdown referencing each pinned element's selector and text snippet.
4. For follow-up browser questions in pure-MCP clients without lifecycle hooks, call \`lux_wait_for_feedback\` passing \`nextCursor\`.
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
