export const BASE_CSS = `
/* Design Tokens & CSS Variables */
:host, .ve-root {
  /* Color Palette */
  --ve-accent: #ffffff;
  --ve-accent-hover: #e2e8f0;
  --ve-accent-text: #ffffff;
  --ve-amber-text: #f1f5f9;
  --ve-green-text: #ffffff;
  --ve-danger: #ef4444;
  --ve-danger-hover: #dc2626;

  /* Typography & Contrast Colors */
  --ve-text-primary: #ffffff;
  --ve-text-secondary: #f1f5f9;
  --ve-text-muted: rgba(241, 245, 249, 0.78);

  /* Card Substrates */
  --ve-card-bg: rgba(255, 255, 255, 0.07);
  --ve-card-border: rgba(255, 255, 255, 0.14);

  /* Solid Text Substrates (Universal Contrast Backing) */
  --ve-input-bg: rgba(8, 12, 22, 0.92);
  --ve-input-bg-focus: #080c18;
  --ve-input-border: rgba(255, 255, 255, 0.18);
  --ve-input-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  --ve-input-focus-ring: 0 0 0 2px rgba(56, 189, 248, 0.25);

  /* Animation & Motion */
  --ve-ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ve-transition-fast: 0.15s ease;
  --ve-transition-smooth: 0.18s cubic-bezier(0.16, 1, 0.3, 1);

  /* Stacking Context Layers */
  --ve-z-highlight: 2147483640;
  --ve-z-pin: 2147483642;
  --ve-z-toolbar: 2147483645;
  --ve-z-launcher: 2147483646;
  --ve-z-panel: 2147483647;
  --ve-z-tooltip: 2147483647;
}

/* Host & Root Isolation */
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  color: var(--ve-text-primary, #f8fafc);
  line-height: 1.4;
  user-select: none;
  -webkit-font-smoothing: antialiased;
  z-index: 2147483647;
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  inline-size: 0;
  block-size: 0;
  pointer-events: none !important;
}

.ve-root {
  pointer-events: none !important;
  color: var(--ve-text-primary, #f8fafc);
}

*, *::before, *::after {
  box-sizing: border-box;
}

.ve-launcher-btn,
.ve-dock-menu,
.ve-toolbar,
.ve-comment-popover,
.ve-pin,
.ve-pin-tooltip,
.ve-drawer {
  pointer-events: auto !important;
}

/* Shared Component Primitives */

/* Universal Glass Panels */
.ve-dock-menu,
.ve-comment-popover,
.ve-toolbar,
.ve-drawer {
  border: 1px solid transparent;
  color: var(--ve-text-primary);
  overflow: hidden;
}

/* High-Contrast Input & Textarea Substrates */
.ve-input,
.ve-textarea,
.ve-textarea-adaptive,
.ve-comment-textarea {
  background: var(--ve-input-bg);
  border: 1px solid var(--ve-input-border);
  box-shadow: var(--ve-input-shadow);
  color: var(--ve-text-primary);
  font-family: inherit;
  font-size: 12px;
  border-radius: 8px;
  outline: none;
  transition: border-color var(--ve-transition-fast), background var(--ve-transition-fast), box-shadow var(--ve-transition-fast);

  &:focus,
  &:focus-visible {
    border-color: var(--ve-accent);
    background: var(--ve-input-bg-focus);
    box-shadow: var(--ve-input-shadow), var(--ve-input-focus-ring);
  }

  &::placeholder {
    color: var(--ve-text-muted);
    opacity: 1;
  }
}

/* Unified High-Contrast Keyboard Focus Rings (Never Shown on Mouse Click) */
.ve-root button:focus:not(:focus-visible),
.ve-root [role="button"]:focus:not(:focus-visible),
.ve-root [tabindex]:focus:not(:focus-visible),
.ve-root input[type="color"]:focus:not(:focus-visible) {
  outline: none;
}

.ve-root button:focus-visible,
.ve-root [role="button"]:focus-visible,
.ve-root [tabindex]:focus-visible,
.ve-root input[type="color"]:focus-visible {
  outline: 2px solid var(--ve-accent, #ffffff);
  outline-offset: 2px;
}

.ve-pin-tooltip textarea:focus-visible {
  border-color: #ffffff !important;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
}

/* Unified Modern Scrollbars */
.ve-comment-textarea,
.ve-textarea-adaptive,
.ve-toolbar-content,
.ve-drawer-body {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.28) transparent;

  &::-webkit-scrollbar {
    inline-size: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.28);
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.45);
    }
  }
}

/* Animations */
@keyframes vePulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.5;
  }
}

@keyframes veSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.ve-spin {
  animation: veSpin 0.9s linear infinite;
}

/* Canvas Highlight Overlays & Target Badges */
.ve-selection-layer {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  inline-size: 0;
  block-size: 0;
  pointer-events: none;
}

.ve-highlight-box {
  position: absolute;
  pointer-events: none;
  border: 1.5px solid rgba(56, 189, 248, 0.85);
  background-color: rgba(56, 189, 248, 0.08);
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.3);
  border-radius: 6px;
  transition: border-color 0.08s ease, background-color 0.08s ease, box-shadow 0.08s ease;
  z-index: var(--ve-z-highlight);

  &.ve-comment-mode {
    border: 2px dashed rgba(255, 255, 255, 0.9);
    background-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 18px rgba(255, 255, 255, 0.3);
  }

  &.ve-screenshot-mode {
    border: 2px solid #f59e0b;
    background-color: rgba(245, 158, 11, 0.12);
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
  }

  &.ve-active {
    border: 2px solid #ffffff;
    background-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.9), 0 0 24px rgba(56, 189, 248, 0.45);
  }
}

.ve-badge {
  position: absolute;
  inset-block-start: -26px;
  inset-inline-start: -2px;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  border: 1px solid transparent;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  padding-block: 2px;
  padding-inline: 8px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ve-badge--inside {
  inset-block-start: 4px;
  inset-inline-start: 4px;
}

.ve-badge-dim {
  color: rgba(241, 245, 249, 0.78);
  font-weight: normal;
  margin-inline-start: 4px;
}

/* Floating Launcher Button & Dock Menu */
.ve-launcher-btn {
  position: fixed;
  inset-block-end: 24px;
  inset-inline-end: 24px;
  inline-size: 52px;
  block-size: 52px;
  border-radius: 50%;
  border: 1px solid transparent;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  z-index: var(--ve-z-launcher);
  overflow: visible;

  & > svg {
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }

  &:active {
    cursor: grabbing;
  }
}

.ve-launcher-badge {
  position: absolute;
  inset-block-start: -3px;
  inset-inline-end: -3px;
  background: #ff3b30;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  font-size: 11px;
  font-weight: 700;
  min-inline-size: 18px;
  block-size: 18px;
  padding-inline: 4px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.45),
    0 0 0 2px rgba(255, 255, 255, 0.95);
  pointer-events: none;
  z-index: 10;
  line-height: 1;
}

.ve-dock-menu {
  position: fixed;
  inset-block-end: 20px;
  inset-inline-end: 20px;
  border-radius: 9999px;
  padding-block: 6px;
  padding-inline: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: var(--ve-z-launcher);
  touch-action: none;
}

.ve-dock-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 16px;
  block-size: 26px;
  cursor: grab;
  touch-action: none;
  color: var(--ve-text-muted);
  opacity: 0.6;
  border-radius: 6px;
  margin-inline-end: 2px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  transition: opacity var(--ve-transition-fast), background var(--ve-transition-fast), color var(--ve-transition-fast);

  &:hover {
    opacity: 1;
    color: var(--ve-text-primary);
    background: rgba(255, 255, 255, 0.08);
  }

  &:active {
    cursor: grabbing;
    background: rgba(255, 255, 255, 0.15);
  }
}

.ve-dragging,
.ve-dragging * {
  cursor: grabbing !important;
}

.ve-dragging {
  transition: none !important;
  user-select: none !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.3) !important;
}

/* Dock Edge-snapping Positional Rules */
.ve-dock-right .ve-launcher-btn,
.ve-dock-right .ve-dock-menu {
  inset-inline-end: 20px;
  inset-inline-start: auto;
}

.ve-dock-left .ve-launcher-btn,
.ve-dock-left .ve-dock-menu {
  inset-inline-start: 20px;
  inset-inline-end: auto;
}

.ve-dock-bottom .ve-launcher-btn {
  inset-block-end: var(--ve-dock-offset-y, 24px);
  inset-block-start: auto;
}

.ve-dock-bottom .ve-dock-menu {
  inset-block-end: var(--ve-dock-offset-y, 20px);
  inset-block-start: auto;
}

.ve-dock-top .ve-launcher-btn {
  inset-block-start: var(--ve-dock-offset-y, 24px);
  inset-block-end: auto;
}

.ve-dock-top .ve-dock-menu {
  inset-block-start: var(--ve-dock-offset-y, 20px);
  inset-block-end: auto;
}

.ve-dock-item {
  position: relative;
  z-index: 2;
  background: transparent;
  border: 1px solid transparent;
  inline-size: 40px;
  block-size: 40px;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ve-dock-badge {
  position: absolute;
  inset-block-start: -3px;
  inset-inline-end: -3px;
  background: #ff3b30;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  font-size: 10px;
  font-weight: 700;
  min-inline-size: 16px;
  block-size: 16px;
  padding-inline: 3px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.4),
    0 0 0 1.5px rgba(255, 255, 255, 0.95);
  pointer-events: none;
  z-index: 10;
  line-height: 1;
}

.ve-dock-close {
  color: rgba(255, 255, 255, 0.55);
  inline-size: 34px;
  block-size: 34px;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
    transform: none;
  }
}

/* Voice Walkthrough Dock Bar */
.ve-voice-done-btn {
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #ffffff;
  border-radius: 14px;
  padding-block: 0;
  padding-inline: 12px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 2px 8px rgba(220, 38, 38, 0.35);
  transition: all var(--ve-transition-fast);
  flex-shrink: 0;
  inline-size: auto;
  block-size: 28px;
  min-inline-size: 64px;
  white-space: nowrap;
  font-family: inherit;

  &:hover:not(:disabled) {
    background: linear-gradient(180deg, #f87171 0%, #ef4444 100%);
    box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.6), 0 4px 12px rgba(239, 68, 68, 0.45);
    transform: scale(1.02);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &.ve-finishing {
    background: rgba(239, 68, 68, 0.65);
    border-color: rgba(255, 255, 255, 0.2);
    min-inline-size: 92px;
    cursor: default;
    pointer-events: none;
    box-shadow: none;
  }
}

.ve-voice-cancel-btn {
  position: relative;
  z-index: 2;
  background: transparent;
  border: 1px solid transparent;
  color: var(--ve-text-muted, #94a3b8);
  border-radius: 50%;
  inline-size: 26px;
  block-size: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--ve-transition-fast);
  flex-shrink: 0;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }
}

.ve-voice-recording-dock {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 24px;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ve-dock-grip-svg {
  pointer-events: none;
}

.ve-voice-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #f59e0b;
  animation: vePulse 0.6s infinite ease-in-out;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

.ve-voice-status-dot.is-ready {
  background-color: #ef4444;
  animation: vePulse 1.2s infinite ease-in-out;
}

.ve-voice-timer {
  font-size: 12px;
  font-weight: 700;
  color: #f8fafc;
  font-variant-numeric: tabular-nums;
}

.ve-voice-transcript-preview {
  font-size: 11px;
  color: #f8fafc;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
  font-weight: 600;
}

.ve-voice-transcript-preview.is-ready {
  color: #f1f5f9;
  font-weight: 400;
}

.ve-voice-transcript-preview.is-live-text {
  font-style: normal;
}

.ve-voice-pin-badge {
  font-size: 10px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  padding: 2px 7px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
}

.ve-mode-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 0 8px;
  border-radius: 12px;
  width: auto;
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #f1f5f9;
}

.ve-mode-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
  flex-shrink: 0;
}

.ve-dock-item--relative {
  position: relative;
}
`;
