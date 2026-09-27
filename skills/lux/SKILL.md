---
name: lux
description: In-browser visual review and UI editing with lux for local projects, dev servers (localhost/127.0.0.1), and static HTML files where code changes will be applied directly to the user's codebase. Use when the user wants to visually edit or review their own app, or runs /lux. Do NOT use for external third-party websites or online articles (use /lux-web instead).
---

# lux visual review and UI editing

> [!NOTE]
> **User-Hosted Apps Only:** `lux` is for reviewing and visually modifying the user's own codebase (running local dev servers like `http://localhost:3000` or local files). For exploring or tearing down external, third-party websites and online articles, use `/lux-web`.

lux runs an in-browser visual editing overlay on running web apps, dev servers, and static HTML files.

## Workflow for `/lux`

When the user runs `/lux`, or asks to review visual edits and comments:

### 1. Check for pending review
Call `lux_get_pending_review`. Always pass `workspaceDir` with the absolute path of your current workspace root:

```json
{
  "name": "lux_get_pending_review",
  "arguments": {
    "workspaceDir": "<absolute-path-to-current-workspace>"
  }
}
```

Passing `workspaceDir` ensures lux finds `.visual-edit/sessions.jsonl` even when your IDE starts the MCP server from a global plugin folder.

### 2. When comments or edits exist
1. Read the returned annotations and style mutations.
2. Find the relevant component files in the project (React/JSX/TSX, HTML, Tailwind classes, or CSS).
3. Apply the requested code edits directly to the codebase.
4. Save the files. The file watcher detects changes, resolves the active review, and reloads the browser.

### 3. When no pending edits are found
Do not restart or kill the lux server if it is already running. Restarting drops active browser sessions and clears pinned comments.

Check whether a review server is already running on port 4320:

- **If the server is running:**
  Tell the user:
  "The lux review server is running at `http://127.0.0.1:4320`. No submitted comments or edits were found. Save your comment pins or click Submit Review in the drawer, then run `/lux` again."

- **If the server is not running:**
  1. Find the running dev server URL (e.g. `http://localhost:3000`, `http://localhost:5173`) or static HTML file (e.g. `./index.html`).
  2. Start lux in the background:
     ```bash
     lux <url-or-file> --port 4320
     ```
  3. Tell the user:
     "Open `http://127.0.0.1:4320` in your browser. Press C to drop comment pins or V to adjust styles. When finished, run `/lux` again and I will apply your changes to the code."
