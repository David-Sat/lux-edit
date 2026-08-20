---
name: lux-review
description: In-browser visual review and editing with lux. Use when reviewing web pages, inspecting HTML or React apps, waiting for visual feedback, and applying DOM or style diffs.
---

# lux-edit Visual Review & UI Editing

lux-edit injects a visual overlay into local web apps, dev servers, and static HTML files. Reviewers can edit styles, typography, colors, layout, and pin comments, producing structured diffs for agents to apply.

## Workflow Overview

```
Agent starts lux -> User edits in browser -> User clicks "Send to Agent" -> Agent receives diff & modifies code
```

## Instructions for Agents

### 1. Start the Review Server
When the user asks to review or visually edit their web UI:
- Start the server targeting the active development server or file:
  ```bash
  # For a running development server:
  lux http://127.0.0.1:3000 --port 4320

  # For static HTML files:
  lux ./index.html --port 4320
  ```
- Share the review URL: `http://127.0.0.1:4320`.

### 2. Wait for Review Submission
Call the blocking MCP tool to listen for user feedback:
```json
{
  "name": "lux_wait_for_review",
  "arguments": {
    "timeoutSeconds": 300
  }
}
```
- Calling `lux_wait_for_review` activates the "Send to Agent" button in the overlay dock.
- When submitted, the tool returns:
  - `mutations`: Style changes, class updates, text edits, and theme variable adjustments.
  - `annotations`: Pinned comments with selectors and reviewer notes.
  - `sourceLocation`: React component names and file paths where available.
  - `url`, `pathname`, `pageTitle`: Page route context.

### 3. Implement the Requested Changes
1. Read the diff summary and target files.
2. Locate the source files in the project.
3. Apply corresponding changes in code (JSX, Tailwind classes, CSS files, or theme configurations).

### 4. Update Status
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
- Optionally reply to comment threads using `lux_reply_to_comment`.
