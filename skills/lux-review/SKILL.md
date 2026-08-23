---
name: lux-review
description: In-browser visual review and editing with lux. Use when reviewing web pages, inspecting HTML or React apps, waiting for visual feedback, and applying DOM or style diffs.
---

# lux-edit Visual Review & UI Editing

lux-edit injects a visual overlay into local web apps, dev servers, and static HTML files. Reviewers can edit styles, typography, colors, layout, and pin comments, producing structured diffs for agents to apply.

## Workflow Overview

```
User runs /lux-start -> Agent starts lux proxy -> User adds comments in browser -> User runs /lux-review -> Agent fetches comments via MCP & updates code -> File watcher auto-resolves & reloads
```

## Instructions for Agents

### 1. Starting the Review Server (`/lux-start`)
When the user asks to start visual editing or runs `/lux-start`:
- Check for a running dev server or target file:
  ```bash
  # For a running development server (e.g. localhost:3000, 5173):
  lux http://127.0.0.1:3000 --port 4320

  # For static HTML files:
  lux ./index.html --port 4320
  ```
- Inform the user that the review overlay is live at `http://127.0.0.1:4320`.

### 2. Reviewing Comments & Edits (`/lux-review`)
When the user asks to review comments or runs `/lux-review`:
- Call the instant MCP tool:
  ```json
  {
    "name": "lux_get_pending_review",
    "arguments": {}
  }
  ```
- The tool returns:
  - `annotations`: Pinned comments with selectors, components, coordinates, and reviewer notes.
  - `mutations`: Style changes, class updates, text edits, and theme variable adjustments.
  - `sourceLocation`: React component names and file paths where available.
  - `url`, `pathname`, `pageTitle`: Page route context.

### 3. Implementing the Requested Changes
1. Read the user's pinned comments and visual diffs.
2. Locate the corresponding source files in the project.
3. Modify the source code (JSX/TSX, Tailwind classes, CSS files, HTML).
4. As soon as you save the files, lux's background file watcher automatically marks the feedback as implemented and reloads the browser. No status calls required.
