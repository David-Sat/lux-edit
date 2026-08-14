# LUX — Live Visual Edit & Review for AI Coding Agents

> **LUX** (*Live User eXperience*) is a local-first in-browser visual editing and annotation layer for AI coding agents. Tweak styles, edit text inline, and place pinned feedback on any web app in real time. LUX serializes your visual drafts into rich DOM diffs, Tailwind utility suggestions, and HTML snippets, synced directly to AI agents via the Model Context Protocol (MCP).

---

## Key Features

* ⚡ **Zero Intrusion Idle Mode**: Unobtrusive launcher dock at the bottom-right; normal page clicks, scrolling, and forms behave 100% untouched until activated.
* 🎨 **Visual Edit Mode**: Floating micro-inspector for box-model padding/margins, colors, typography, flex/grid layouts, and inline `contenteditable` text editing.
* 💬 **Element Comment Pins**: Click any element to immediately drop a feedback pin with autofocus. Pins stay locked to elements on scroll and resize.
* ↩ **Instant Revert & Reset**: Revert any individual visual tweak or reset the entire draft back to original with one click.
* 🤖 **MCP Server Integration**: Built on the official Model Context Protocol (`@modelcontextprotocol/sdk`). Provides real-time session streaming (`lux_list_sessions`, `lux_get_session`, `lux_claim_session`, `lux_update_status`).
* 💅 **Tailwind CSS & Token Mapping**: Automatically maps raw pixel/color changes to standard Tailwind CSS utility classes (e.g. `p-6`, `mb-8`, `font-bold`, `bg-indigo-500`) to guide the agent toward clean, idiomatic code.
* 🔄 **Automatic Live Reload**: Watches source files in real time. When the AI agent implements code changes, the browser immediately auto-refreshes!
* 🛡️ **Zero Style Leakage**: Fully isolated Shadow DOM Web Component (`<visual-edit-overlay>`) injected via a streaming proxy or static server. Zero repo pollution.

---

## Quickstart

### 1. Start LUX on your App or HTML file

For a running Vite/Next.js/React dev server:
```bash
npx lux-edit http://127.0.0.1:5173
```

For a static HTML page or built site:
```bash
npx lux-edit ./index.html
# or
npx lux-edit ./dist
```

Open the printed Review URL (default `http://127.0.0.1:4320`) in your browser.

---

### 2. Configure MCP in your AI Agent

Add LUX to your `.mcp.json` or agent configuration:
```json
{
  "mcpServers": {
    "lux": {
      "command": "npx",
      "args": ["-y", "lux-edit", "mcp"]
    }
  }
}
```

---

### 3. Workflow with Coding Agents

1. **Draft in Browser**:
   * Choose **⚡ Visual Edit** to tweak styles, colors, and rewrite text inline.
   * Choose **💬 Comment** to drop numbered feedback pins directly onto elements.
2. **Sync with Agent**:
   * All changes auto-sync in real time. Click **📋 Copy Prompt** or tell your agent: *"Please implement the visual edits from LUX"*.
3. **Agent Implements & Browser Live Updates**:
   * The agent reads the exact DOM/AST diffs and element HTML snippets from MCP.
   * The agent refactors the repository code.
   * The browser automatically reloads with the new code in real time!

---

## Monorepo Architecture

* [`packages/core`](./packages/core): Data models, AST/DOM diffing engine, Tailwind CSS mapper.
* [`packages/overlay`](./packages/overlay): Preact + Shadow DOM client with Floating UI inspector, comment pins, and review drawer.
* [`packages/server`](./packages/server): Streaming reverse proxy, static file server, live file watcher, WebSocket hub, and JSONL store.
* [`packages/mcp`](./packages/mcp): Model Context Protocol server exposing tools and prompts over stdio.
* [`packages/cli`](./packages/cli): Executable CLI runner (`lux`, `lux-edit`).

---

## Development & Testing

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit and integration tests
pnpm test
```

## License

[MIT](./LICENSE) © 2026 David Satomi
