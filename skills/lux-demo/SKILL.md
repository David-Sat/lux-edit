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

### 3. Give the User the Challenge Briefing

Provide a clean, encouraging response with the review link:

```markdown
✦ **Spot the Difference: Lux Playground is live at http://127.0.0.1:4320**

**The Challenge:**
The design spec is on the left; the live build on the right has several visual flaws.
- Use **Edit (`E`)** or **Comment (`C`)** to tag discrepancies on the live card (typos, badges, broken metric card).
- Use **Shift + Click** to multi-pin elements across the grid.

When you're finished, return here and run **/lux**. I will read your visual review, fix `lux-demo/index.html` to match the spec, and your browser will hot-reload live!
```

### 4. Applying the Demo Review

When the user returns and runs `/lux` (or asks you to apply the changes):
1. Call `lux_get_pending_review` with `workspaceDir: process.cwd()`.
2. Inspect the annotations and mutations targeting `./lux-demo/index.html`.
3. Modify `./lux-demo/index.html`:
   - Fix the typo in `#live-product-title` (*"Appolo Feild Recurder"* → *"Apollo Field Recorder"*)
   - Align `#live-badge` styling with the target badge `.pill-clean`
   - Reset `#live-broken-spec` styling, height, and margins to match standard `.spec-item`
   - Apply any other requested visual tweaks to make the live build match the target spec
4. Save `./lux-demo/index.html`.
5. The lux file watcher will automatically reload the user's browser, resolve the session to **Implemented**, and complete the interactive loop!

