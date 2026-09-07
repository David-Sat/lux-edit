# lux-edit

In-browser visual editing, annotation, and review overlay for AI coding agents.

[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-38bdf8.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE)

![lux-edit Workflow](./docs/workflow.svg)

lux-edit injects a live visual editing layer into your web app or static HTML. Adjust styling, edit text directly in the DOM, and highlight words or drop comment pins. Everything syncs in real time as structured diffs to your AI coding agent via MCP.

---

## Quickstart

### 1. Installation

You can install `lux` via the Claude Marketplace/Plugin system, portable workspace configuration, or the interactive global installer:

#### Option A: Claude Code Plugin (Official / Git)
```bash
# Install directly via Claude Code plugin manager
claude plugin add https://github.com/David-Sat/lux-edit
```

#### Option B: Workspace Setup (Zero Global Pollution)
Run in any web project root to generate universal `.mcp.json`, `plugin.json`, and `/lux` skills:
```bash
npx lux-edit init
```

#### Option C: Global Machine Setup (Interactive)
Install the CLI and configure your AI coding agents across all projects:
```bash
# 1. Install globally
npm install -g lux-edit

# 2. Interactive multi-agent installer
lux init -g
```

When running `lux init -g`, an interactive selector identifies installed tools and lets you pick:
```text
Select agents to configure with lux:
  1. [●] Google Antigravity    (detected)
  2. [●] Claude Code           (detected)
  3. [○] Claude Desktop        (not detected)
  4. [●] Cursor                (detected)
  5. [○] Windsurf              (not detected)
  a. Configure all
  q. Cancel

Enter numbers to select (e.g. 1,2), "a" for all, or press ENTER for detected defaults:
```

> **Advanced Init Options:**
> - **Non-interactive default:** `lux init -g -y` (automatically configures detected tools)
> - **Target specific agent:** `lux init -g --agent cursor`
> - **Custom tool config path:** `lux init --path ~/.config/zed/settings.json` (or any custom directory/file)
> - **Configure all major agents:** `lux init -g --all`

---

### 2. How to Use (3 Steps)

1. **Start Review:** In your AI agent chat (Claude Code, Cursor, Antigravity, etc.), type:
   ```text
   /lux
   ```
   *(Or start manually in terminal: `lux http://localhost:3000` or `lux ./index.html`)*

2. **Edit in Browser:** Open `http://127.0.0.1:4320`:
   * Press **`V`** to visually inspect elements, tweak CSS, or double-click text to edit directly.
   * Press **`C`** to drop comment pins or drag across text to comment on specific words.

3. **Apply Changes:** Tell your agent:
   ```text
   /lux
   ```
   The agent reads your visual edits and comments over MCP, updates your code, and the browser auto-refreshes.

---

## Shortcuts

| Key | Action |
| --- | --- |
| `V` | **Visual Edit** (select elements, tweak styles, box model, double-click text) |
| `C` | **Comment Pin** (click element or highlight text selection) |
| `Enter` | Save active comment / finish text edit |
| `Shift` + `Enter` | Multi-line newline inside comment |
| `Esc` | Deselect element or close active popover / drawer |

---

## Standalone CLI Options

```bash
# Target running dev server (Next.js, Vite, Remix, etc.)
lux http://localhost:3000

# Target static HTML file
lux ./index.html

# Custom port or behind cloud proxies (SageMaker, Codespaces, JupyterHub)
lux http://localhost:5173 --port 4401 --base-path /codeeditor/default/ports/4401
```

<details>
<summary><strong>Manual MCP Server Configuration</strong></summary>

Add this to your `.mcp.json` or agent config:

```json
{
  "mcpServers": {
    "lux": {
      "command": "lux",
      "args": ["mcp"]
    }
  }
}
```

Or with Claude Code CLI:
```bash
claude mcp add lux -- lux mcp
```

### Available MCP Capabilities
* **Tools**:
  * `lux_get_pending_review`: Instantly retrieves active comments, text selections, and visual diffs.
  * `lux_get_session`: Retrieves details for a specific session ID.
  * `lux_list_sessions`: Lists all recorded review sessions.
* **Resources**:
  * `lux://pending-review`: Real-time markdown context of active annotations and style edits for direct agent attachment.
* **Prompts**:
  * `lux_apply_review`: One-click prompt template to apply review changes to the codebase.
</details>

---

## Update & Uninstall

### Updating

**From npm:**
```bash
# Update CLI to latest published release
npm install -g lux-edit@latest

# Refresh agent skills & MCP configs
lux init -g
```

**From local repository (monorepo / local development):**
```bash
# Rebuild the monorepo packages
pnpm build

# Refresh agent skills & MCP configs from the current local build
lux init -g
```

### Uninstalling & Cleanup

```bash
# 1. Cleanly remove MCP servers and skills from all agents (or without -g for workspace)
lux uninstall -g

# (or remove from a custom path: lux uninstall --path ~/.config/zed/settings.json)
# (or with npx: npx lux-edit uninstall -g)

# 2. Remove the CLI package
npm uninstall -g lux-edit
```

---

## License

[MIT](./LICENSE) © 2026 David Satomi. Inspired by [ui-review](https://github.com/flucas96/ui-review).
