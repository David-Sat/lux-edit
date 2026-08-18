---
name: lux-review
description: Live visual UI review and in-browser draft editing with LUX. Use when the user asks to review, visually tweak, inspect, or edit a web application, HTML file, or React component.
---

# LUX Live Visual Review & UI Editing

LUX (Live User eXperience) injects a high-performance visual overlay into local web apps, dev servers (Vite, Next.js, etc.), and static HTML files. It allows human reviewers to draft visual edits (spacing, typography, colors, layout, themes) and pin comments, then hands structured AST diffs back to the AI agent to implement in the codebase.

## Workflow Overview

```
Agent starts LUX ──> User edits visually in browser ──> User clicks "Send to Agent" ──> Agent receives diff & modifies code
```

## Step-by-Step Agent Guide

### 1. Start the LUX Review Server
When the user wants to review or visually edit their web UI:
- Run the LUX server targeting their dev server or file in the background:
  ```bash
  # For an active development server (e.g. Vite, React, Next.js):
  lux http://127.0.0.1:3000 --port 4320

  # For a static HTML file or directory:
  lux ./index.html --port 4320
  ```
- Present the user with the clickable Review URL: `http://127.0.0.1:4320`.

### 2. Wait for User Review Submission
Call the blocking MCP tool to listen for user feedback:
```json
{
  "name": "lux_wait_for_review",
  "arguments": {
    "timeoutSeconds": 300
  }
}
```
* **Note**: Calling `lux_wait_for_review` automatically lights up the **Send to Agent** button inside the user's overlay dock.
* When the user clicks **Send to Agent**, the tool immediately unblocks and returns the structured review batch containing:
  - `mutations`: Array of CSS style changes, class additions/removals, text edits, DOM insertions/deletions, or global theme token adjustments.
  - `annotations`: Pinned comments with element selectors, bounding boxes, and reviewer notes.
  - `sourceLocation`: Mapped React component names and file paths (e.g. `src/components/Hero.tsx:42`).
  - `url`, `pathname`, `pageTitle`: Specific page routes for multi-page editing.

### 3. Implement the Requested Changes
1. Inspect the returned diff summary and component paths.
2. Locate the corresponding source files in the workspace.
3. Apply idiomatic code edits (e.g. JSX structure, Tailwind CSS utility classes, or CSS variables).
4. For global theme tokens (`THEME_CHANGE`), update `tailwind.config.js` or `globals.css`.

### 4. Update Status & Confirm
- Mark the session as implemented:
  ```json
  {
    "name": "lux_update_status",
    "arguments": {
      "sessionId": "<session-id>",
      "status": "implemented"
    }
  }
  ```
- Optionally reply to specific comment threads via `lux_reply_to_comment`.
- Confirm the changes to the user so they can inspect the live result in their browser.
