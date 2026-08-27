# lux-edit

In-browser visual editing, annotation, and review overlay for AI coding agents.

[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-38bdf8.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE)

![lux-edit Workflow](./docs/workflow.svg)

lux-edit injects a live visual editing layer into your web app or static HTML. Adjust styling, edit text directly in the DOM, and highlight words or drop comment pins. Everything syncs in real time as structured diffs to your AI coding agent via MCP.

---

## Quickstart

### 1. Install & Setup

```bash
# 1. Install globally
npm install -g lux-edit

# 2. Configure your AI coding agents machine-wide (or run without -g in a repo)
lux init -g
```

> Configures Google Antigravity, Gemini, Claude Code, Cursor, Windsurf, Claude Desktop, Cline, and Roo Code automatically.

<details>
<summary><strong>Prefer running with <code>npx</code> without installing?</strong></summary>

```bash
# Local repo setup
npx lux-edit init

# Global machine setup
npx lux-edit init -g
```
</details>

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

### Available MCP Tools
* `lux_get_pending_review`: Instantly retrieves active comments, text selections, and visual diffs.
* `lux_get_session`: Retrieves details for a specific session ID.
* `lux_list_sessions`: Lists all recorded review sessions.
</details>

---

## Update & Uninstall

### Updating

```bash
# Update CLI to latest version
npm install -g lux-edit@latest

# Refresh agent skills & MCP configs
lux init -g
```

### Uninstalling & Cleanup

```bash
# 1. Cleanly remove MCP servers and skills from all agents (or without -g for workspace)
lux uninstall -g

# (or with npx: npx lux-edit uninstall -g)

# 2. Remove the CLI package
npm uninstall -g lux-edit
```

---

## License

[MIT](./LICENSE) © 2026 David Satomi. Inspired by [ui-review](https://github.com/flucas96/ui-review).
