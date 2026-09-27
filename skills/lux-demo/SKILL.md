---
name: lux-demo
description: Interactive in-browser walkthrough and playground for Lux. Launches a lightweight local sandbox (./lux-demo/index.html) demonstrating direct visual editing, inline text selection, multi-element pins, and live agent code resolution. Use when the user asks for a demo, walkthrough, tutorial of Lux, or runs /lux-demo or /lux demo.
---

# Lux Interactive Playground & Demo

> [!NOTE]
> **Zero-Bloat Ephemeral Sandbox:** The demo creates a self-contained `./lux-demo/index.html` file in the user's current project and auto-adds `lux-demo/` to `.gitignore`. It lets users experience the full round-trip: making visual edits in the browser, returning to chat, and watching the AI agent apply those changes to code in real time.

## Workflow for `/lux-demo` (or `/lux demo`)

When the user asks to try out Lux, requests a demo/tutorial, or runs `/lux-demo` / `/lux demo`:

### 1. Transparently Explain Required Rights

Before launching, briefly inform the user why permissions are needed:
- **Terminal Execution:** To launch the local review server in the background (`lux demo`).
- **File Edit Rights:** To modify `./lux-demo/index.html` when the user returns and asks you to apply their visual review.

### 2. Launch the Demo Server

Run the demo command in the background:
```bash
lux demo
```
*(If `lux` is not in PATH, use `npx lux-edit demo` or `node packages/cli/dist/cli.js demo`)*.

### 3. Give the User a 60-Second Mission Briefing

Provide a clean, encouraging response with the review link:

```markdown
✦ **Lux Interactive Playground is live at http://127.0.0.1:4320**

Here is your 60-second mission on the demo page:
1. **Station 01 (Edit Tool — Press `E`):** Double-click the main headline to fix the typo (*"DEVLOPMENT"* → *"DEVELOPMENT"*), and select the red badge to tweak its padding/border.
2. **Station 02 (Comment Tool — Press `C`):** Drag-select the marketing jargon phrase *"quantum-grade paradigm synergies"* and drop a comment asking me to rewrite it.
3. **Station 03 (Multi-Element Pin — `Shift + Click`):** Hold Shift and click Card 1, Card 2, and Card 3 to link all three cards with connector pins (1A, 1B, 1C), asking to unify their heights and margins.

When you're finished, simply return here and run **/lux**. I will read your visual review, edit `lux-demo/index.html`, and your browser will hot-reload with the fixes applied live!
```

### 4. Applying the Demo Review

When the user returns and runs `/lux` (or asks you to apply the changes):
1. Call `lux_get_pending_review` with `workspaceDir: process.cwd()`.
2. Inspect the annotations and mutations targeting `./lux-demo/index.html`.
3. Modify `./lux-demo/index.html`:
   - Fix the typo in `#demo-headline`
   - Clean up `#demo-badge`
   - Rewrite the jargon in `#demo-paragraph` to sound natural and engineering-focused
   - Align the height, border-radius, and margins of `#metric-card-2` with the other cards
4. Save `./lux-demo/index.html`.
5. The lux file watcher will automatically reload the user's browser, resolve the session to **Implemented**, and complete the interactive loop!
