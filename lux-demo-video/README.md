# Lux Product Demo Video (Remotion)

This directory contains the complete source code for the official 40-second product demo video for **Lux** (`lux-edit`), built using [Remotion](https://www.remotion.dev/).

It is completely isolated from the core npm packages and runs 100% locally.

---

## Video Specifications

- **Resolution:** 1920 × 1080 (1080p Full HD)
- **Framerate:** 30 fps
- **Duration:** 1200 frames (40.0 seconds)
- **Output Size:** ~1.7 MB (`out/lux-demo.mp4`)
- **Theme:** Apple visionOS Liquid Glass (`#38bdf8` electric cyan, frosted backdrop blur, specular rim lines)

---

## Scenes Structure

1. **Scene 1: Terminal Init (`Scene1TerminalInit.tsx`, 5.0s / 150f)**
   - Agent terminal view (`Claude Code` / `Antigravity`).
   - Quick `/lux` invocation, connecting live MCP stdio bridge and injecting the overlay.
2. **Scene 2: Browser Session (`Scene2BrowserSession.tsx`, 22.5s / 675f)**
   - Continuous, zero-jump in-browser session:
     - **Comment Tool (`C`):** Hovering over `<h1>` displays the `.ve-highlight-box` outline (`💬 <h1> (Hero.tsx:18) [960 × 68]`), drops Pin #1, and types review comment.
     - **Visual Edit Tool (`V`):** Clicking CTA button pops open the authentic `LuxToolbar` floating editor; dynamically adjusts padding, radius, and label to `Start Free Trial →`.
     - **Voice Walkthrough (`R`):** Bottom-right dock transforms into recording capsule; spoken prompt embeds interactive `[🎯 Target 1: button]` and `[🎯 Target 2: card]` tags directly into the transcript upon clicking elements.
3. **Scene 3: Agent Sync (`Scene3AgentSync.tsx`, 8.5s / 255f)**
   - Terminal syncs with MCP session, displays structured git diffs to `src/components/Hero.tsx`, and hot-reloads the browser in 24ms.
4. **Scene 4: Clean Outro (`Scene4Outro.tsx`, 5.5s / 165f)**
   - Minimalist outro on pure black with glowing Lux emblem, `$ npx lux-edit init` command pill, and GitHub quality badges (`npm package`, `CI passing`, `CodeQL passing`, `MCP stdio`, `License MIT`).

---

## Commands

```bash
# 1. Install dependencies
npm install

# 2. Start Remotion Studio (interactive timeline on localhost:3000)
npm run dev

# 3. Render MP4 locally
npx remotion render src/index.ts LuxProductDemo out/lux-demo.mp4

# 4. Render a single still frame
npx remotion still src/index.ts LuxProductDemo out/preview.png --frame=450
```
