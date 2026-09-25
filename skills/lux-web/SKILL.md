---
name: lux-web
description: In-browser visual inspection, teardown, discussion, and explanation of external, third-party websites, online articles, and competitor designs using lux. Use EXCLUSIVELY for external sources and remote internet pages that are NOT hosted by the user and where there is no local codebase to modify. Do NOT use for user-hosted apps, local dev servers, or local HTML files (use /lux instead).
---

# lux-web: Web Research, UI Teardown & Article Discussion

> [!IMPORTANT]
> **External Sources Only:** `lux-web` is strictly for inspecting, discussing, and tearing down **external, third-party websites, online articles, and design references** on the internet where there is no local codebase to modify. If the user wants to visually edit, review, or modify an application or website hosted by themselves (e.g., `localhost`, dev servers, or local files), use `/lux` instead.

`lux-web` proxies live external websites, online articles, and public web apps through lux's in-browser overlay, allowing users to drop comment pins, highlight phrases, and discuss the design, architecture, or content directly with an AI coding agent.

## Workflow for `/lux-web`

When the user runs `/lux-web` or asks to inspect/discuss an external URL:

### 1. Starting or Pointing `lux` at an External Web Target

1. Identify the external target URL (e.g. `https://example.com`, `https://news.ycombinator.com`, `https://overreacted.io`).
   - If the user has not specified a URL, ask them for the target URL.
2. Check for an available port (default `4320`, fallback to `4330` or next free port if `4320` is already in use by another session).
3. Start the `lux` review server in the background:
   ```bash
   lux <url> --port <port>
   ```
4. Tell the user:
   "The lux web review server is running at `http://127.0.0.1:<port>` targeting `<url>`.
   - Press **C** to drop comment pins on specific elements (headers, cards, buttons) or highlight text to comment on exact passages.
   - Press **V** to inspect computed styles, layout rules, and DOM elements.
   - When finished, click **Submit Review** in the bottom drawer, then run `/lux-web` (or ask me to review)!"

### 2. Reviewing Comments & In-Browser Discussion

When the user asks to review, or runs `/lux-web`:

1. Call `lux_get_pending_review` (or probe the live server API `http://127.0.0.1:<port>/__visual_edit__/api/pending`).
2. **Crucial distinction from local `/lux`:**
   - **DO NOT attempt to find or edit local files** for external websites.
   - Treat the user's pins, selectors, and style edits as grounds for **technical analysis, design explanation, or content discussion**:
     - **For UI / Design Teardowns:** Explain the layout technique (Flexbox/Grid), CSS properties (transforms, shadows, backdrop-filters, custom properties), or interactive patterns. Provide clean, modular code snippets (e.g., React + Tailwind or CSS) showing how the user can replicate the effect in their own project.
     - **For Articles & Documentation:** Address the user's questions, break down complex concepts, summarize highlighted text, or clarify difficult equations/theorems based on the pinned DOM context.
3. Respond in structured markdown referencing each pinned element's selector and text snippet.
