---
name: lux
description: In-browser visual review and editing with lux. Use when the user asks to start visual editing, inspect UI, review in-browser comments, or runs /lux.
---

# lux Visual Review & UI Editing

lux injects an in-browser visual editing and annotation overlay into running web apps, dev servers, and static HTML files.

## Agent Workflow for `/lux`

When the user runs `/lux` (or asks to review / visually edit the UI):

### 1. Check for Pending Review
Call the instant MCP tool:
```json
{
  "name": "lux_get_pending_review",
  "arguments": {}
}
```

### 2. If Pending Comments or Edits Exist:
1. Read all returned annotations (pinned comments, element selectors, component names) and visual style mutations.
2. Locate the corresponding source files in the project (React/JSX/TSX components, HTML, Tailwind classes, CSS).
3. Apply the requested code edits directly to the codebase.
4. Saving the files automatically marks the feedback resolved and reloads the browser via lux's file watcher.

### 3. If No Pending Edits or Server Not Running:
1. Detect any running dev server (e.g. `http://localhost:3000`, `http://localhost:5173`) or static HTML file (e.g. `./index.html`).
2. Start the proxy in the background:
   ```bash
   lux <url-or-file> --port 4320
   ```
3. Share the review URL with the user: `http://127.0.0.1:4320`.
4. Inform the user: "Open `http://127.0.0.1:4320` in your browser. Press **C** to drop comment pins or **V** to adjust styles. When finished, run `/lux` again and I will apply your feedback directly to the code!"
