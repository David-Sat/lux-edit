---
name: lux
description: In-browser visual review, live/batch UI editing, visual screenshot verification, and component variant exploration with lux for local projects, dev servers (localhost/127.0.0.1), and static HTML files where code changes will be applied directly to the user's codebase. Use when the user wants to visually edit or review their own app, or runs /lux. Do NOT use for external third-party websites or online articles (use /lux-web instead).
---

# lux — Local Visual Review & UI Editing

> **User-Hosted Apps Only:** For external websites/articles with no local codebase, use `/lux-web`.

## Core Rules
- **Absolute Priority:** When woken by `[LUX VISUAL REVIEW INTERRUPTION]` or pending feedback, handle the visual review first—before any unrelated conversation.
- **Never Fake-Resolve:** Every review must end in real source edits or proposed variants (never a no-op resolve).
- **Variant Requests:** If feedback mentions "options", "variants", "choices", "alternatives", or "different designs", call `lux_propose_variants` (2–4 options) instead of making a single guess.
- **Keep Running Server Alive:** Never kill or restart an active `lux` server (it drops live WebSocket tabs and pinned comments).

## Workflow

### 1. Read Pending Feedback
Call `lux_get_pending_review({ workspaceDir: "<abs-workspace-root>" })`—it auto-discovers the active server, claims items `in_progress`, and returns `sessionId`, `revisionHash`, and `nextCursor`.

### 2. Apply & Resolve
- **When variants are requested:** Call `lux_propose_variants` with 2–4 named options and `resolveSessionId: "<sessionId>"` (proposes and resolves atomically).
- **For direct code edits:** Update the relevant component/style files, optionally verify pixels with `lux_capture_visual`, then call `lux_resolve_review({ sessionId, expectedHash: "<revisionHash>", modifiedSelectors, reply, workspaceDir })` to trigger the Green Verification Halo.
  - On a stale-hash conflict, re-read `lux_get_pending_review` to pick up newer feedback before resolving.

### 3. Start / Wait Loop (Live & Batch)
- **If no server is running:** Start `lux <dev-url-or-file> --port 4320` in the background (use another free port if `4320` is busy) and tell the user to open `http://127.0.0.1:<port>` (**C** comments, **R** voice walkthrough, **V** styles, **S** screenshot; **Live** streams automatically, **Batch** waits for Submit Review).
- **Waiting for follow-up feedback:**
  - **Claude Code / Codex:** Lifecycle hooks (`PostToolUse` + `Stop`) wake automatically—end your turn.
  - **Antigravity:** If no waiter is running, launch `npx lux-edit hook wait` (`WaitMsBeforeAsync: 500`, `IsDaemon: false`) and end your turn so chat stays interactive.
  - **Pure-MCP clients:** Call `lux_wait_for_feedback({ afterCursor: <nextCursor>, workspaceDir })`.
