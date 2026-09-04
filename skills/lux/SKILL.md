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

### 3. If No Pending Edits Found:
**IMPORTANT: NEVER restart, kill, or re-launch the lux server if it is already running! Restarting the server kills active browser sessions, resets WebSockets, and erases comments the user has pinned.**

Check if a review server is already running (e.g. check if port 4320 is listening or if a background `lux` process is active):

- **If the server IS ALREADY RUNNING:**
  - **DO NOT restart it.**
  - Simply inform the user:
    "The lux review server is running at `http://127.0.0.1:4320`. No submitted comments or edits were found yet.
    - If you added comments, make sure to save the comment pin or click **Submit Review** in the bottom-right drawer.
    - When ready, run `/lux` again and I will apply them directly to the code!"

- **If the server IS NOT RUNNING YET:**
  - Only start the server when no instance is currently running:
    1. Detect any running dev server (e.g. `http://localhost:3000`, `http://localhost:5173`) or static HTML file (e.g. `./index.html`).
    2. Start the proxy in the background:
       ```bash
       lux <url-or-file> --port 4320
       ```
    3. Share the review URL: `http://127.0.0.1:4320`.
    4. Inform the user: "Open `http://127.0.0.1:4320` in your browser. Press **C** to drop comment pins or **V** to adjust styles. When finished, run `/lux` again and I will apply your feedback directly to the code!"
