---
name: lux
description: In-browser visual review, live/batch UI editing, visual screenshot verification, and component variant exploration with lux for local projects, dev servers (localhost/127.0.0.1), and static HTML files where code changes will be applied directly to the user's codebase. Use when the user wants to visually edit or review their own app, or runs /lux. Do NOT use for external third-party websites or online articles (use /lux-web instead).
---

# lux visual review and UI editing

> [!NOTE]
> **User-Hosted Apps Only:** `lux` is for reviewing and visually modifying the user's own codebase (running local dev servers like `http://localhost:3000` or local files). For exploring or tearing down external, third-party websites and online articles, use `/lux-web`.

lux runs an in-browser visual editing overlay on running web apps, dev servers, and static HTML files with **Live Streaming Mode**, **Batch Review Mode**, **Multi-Target Voice Walkthroughs**, **Visual Capture (`lux_capture_visual`)**, and **Component Variants (`lux_propose_variants`)**.

## Workflow for `/lux`

When the user runs `/lux`, asks to review visual edits/comments, or when woken automatically by a lifecycle hook:

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

Passing `workspaceDir` ensures lux finds `.visual-edit/sessions.jsonl` and connects to the active server even when started from a global plugin folder.

### 2. When comments, voice sections, variant decisions, or edits exist
1. Read the returned mutations, pinned comments, sectioned voice walkthroughs, and approved component variants. Note the `sessionId`, `revisionHash`, and `nextCursor`.
2. If the user asks you to explore multiple visual designs for an element, call `lux_propose_variants` with 2–4 named options so the user can toggle and pick one live in the browser. Pass `resolveSessionId: "<sessionId>"` (and an optional `reply`) when proposing variants in response to an active review so proposing and resolving happen atomically in one call.
3. Otherwise, find the relevant component files in the project (React/JSX/TSX, Vue, Svelte, HTML, Tailwind classes, or CSS) and apply the requested code edits directly.
4. Optionally call `lux_capture_visual` to visually inspect the rendered pixels and verify there are no layout overflow issues.
5. Call `lux_resolve_review` (passing `expectedHash` and `modifiedSelectors`) so the browser highlights the updated elements with a Green Verification Halo (skip if already resolved via `lux_propose_variants({ resolveSessionId })`).
6. **Seamless Live & Batch Wakeup:**
   - **In Claude Code / Codex:** Lifecycle hooks (`PostToolUse` + `Stop`) automatically hold and wake you when the user submits new Live or Batch feedback—simply finish your turn.
   - **In Antigravity:** To avoid locking the Antigravity chat in `"Working"` state while still waking immediately on browser edits, launch `npx lux-edit hook wait` via `run_command` with `WaitMsBeforeAsync: 500` and `IsDaemon: false`, then immediately finish your turn.
   - **In Pure-MCP Clients (Cursor, Windsurf, VS Code, Zed, Claude Desktop) or Direct Loops:** Call `lux_wait_for_feedback` passing `afterCursor: <nextCursor>` (and `workspaceDir`) to block cleanly until the user makes another Live edit, Variant pick, or Batch submission.

### 3. When no pending edits are found
Do not restart or kill the lux server if it is already running. Restarting drops active browser sessions and clears pinned comments.

Check whether a review server is already running on port 4320:

- **If the server is running:**
  1. In Antigravity, if no background waiter is active yet, start `npx lux-edit hook wait` (`WaitMsBeforeAsync: 500, IsDaemon: false`) so browser submissions wake you automatically while leaving the chat input free; in pure-MCP clients without hooks, call `lux_wait_for_feedback` once the user asks you to wait for edits.
  2. Tell the user:
     "The lux review server is running at `http://127.0.0.1:4320`. Switch between **Live** and **Batch** mode in the dock, press **V** to edit styles, **C** to drop comment pins, **S** to capture element screenshots, or **R** for multi-target voice dictation."

- **If the server is not running:**
  1. Find the running dev server URL (e.g. `http://localhost:3000`, `http://localhost:5173`) or static HTML file (e.g. `./index.html`).
  2. Start lux in the background:
     ```bash
     lux <url-or-file> --port 4320
     ```
  3. In Antigravity, also start the background review waiter (`npx lux-edit hook wait` with `WaitMsBeforeAsync: 500, IsDaemon: false`) so browser feedback wakes you automatically.
  4. Tell the user:
     "Open `http://127.0.0.1:4320` in your browser. Press V to adjust styles, C to drop comment pins, S to capture visual screenshots, or R to record a sectioned voice walkthrough. In Live mode, your feedback streams to me automatically; in Batch mode, click Submit Review when ready."
