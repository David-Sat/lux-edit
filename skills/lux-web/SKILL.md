---
name: lux-web
description: In-browser visual inspection, teardown, discussion, and explanation of external, third-party websites, online articles, and competitor designs using lux. Use EXCLUSIVELY for external sources and remote internet pages that are NOT hosted by the user and where there is no local codebase to modify. Do NOT use for user-hosted apps, local dev servers, or local HTML files (use /lux instead).
---

# lux-web — External Web Teardown & Discussion

> **External Sites Only:** Never search or edit local codebase files for `/lux-web`. Use `/lux` for local apps and dev servers.

## Workflow

### 1. Proxy the Target URL
If no `lux` server is running for the target URL (never kill an active server on another task—pick a free port like `4330` if `4320` is busy):
```bash
lux <external-url> --port <port>
```
Tell the user to open `http://127.0.0.1:<port>` (**C** comment or highlight text, **R** voice walkthrough, **V** inspect styles, **S** screenshot; **Live** or **Batch** mode).

### 2. Read, Analyze & Resolve
1. Call `lux_get_pending_review({ workspaceDir: "<abs-workspace-root>" })` (and optionally `lux_capture_visual` to inspect rendered pixels). Note `sessionId`, `revisionHash`, and `nextCursor`.
2. **Respond without local edits:**
   - **UI teardowns:** Explain layout/CSS/interactions with reusable snippets, or call `lux_propose_variants` (2–4 live variations + `resolveSessionId`) to preview alternatives in-browser.
   - **Articles/docs:** Answer questions and summarize highlighted passages, referencing each element's selector and text snippet.
3. Unless already resolved via `lux_propose_variants({ resolveSessionId })`, call `lux_resolve_review({ sessionId, expectedHash: "<revisionHash>", reply, workspaceDir })` to record your answer in the drawer.

### 3. Wait for Follow-ups
- **Claude Code / Codex:** Lifecycle hooks wake on new feedback—end your turn.
- **Antigravity:** Launch `npx lux-edit hook wait` (`WaitMsBeforeAsync: 500`, `IsDaemon: false`) and end your turn.
- **Pure-MCP clients:** Call `lux_wait_for_feedback({ afterCursor: <nextCursor>, workspaceDir })`.
