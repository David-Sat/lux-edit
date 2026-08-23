# lux-edit Roadmap

Planned features and architectural enhancements for upcoming releases.

## 1. Bi-Directional Agent Feedback & Visual Verification

- **Live Agent Status Pill**: When an AI agent claims an edit session or is processing changes, show a subtle "Agent implementing..." status in the browser overlay dock.
- **Visual Diff Highlight (Green Halo)**: When the live file watcher reloads the page following an agent's code edits, briefly highlight the modified elements with a temporary green outline/pulse (3 seconds) to verify changes visually.

## 2. Framework Source Code Mapping (Dev Server Plugin)

- **Optional Vite / Next.js Plugin (`lux-edit/vite`)**:
  - Automatically injects `data-source-file="src/components/Hero.tsx:42"` attributes during development.
  - Allows coding agents to receive exact file paths and line numbers directly from the DOM without selector ambiguity.

## 3. DOM Hierarchy Breadcrumbs

- **Inspector Breadcrumb Bar**: Display the parent element chain in the floating toolbar:
  `div.card > div.content > button.btn > [span.icon]`
- Clicking any parent node shifts the inspector focus directly to that element.

## 4. Responsive Viewport Testing

- **Device Switcher**: Quick toggle between Desktop (100%), Tablet (768px), and Mobile (375px) directly from the dock.
- Allows placing mobile-specific comment pins and testing media query styling.
