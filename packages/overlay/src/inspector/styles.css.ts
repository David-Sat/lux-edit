export const OVERLAY_STYLES = `
/* Design Tokens & CSS Variables */
:host, .ve-root {
  /* Color Palette */
  --ve-accent: #38bdf8;
  --ve-accent-hover: #0284c7;
  --ve-accent-text: #38bdf8;
  --ve-amber-text: #fbbf24;
  --ve-green-text: #4ade80;
  --ve-danger: #ef4444;
  --ve-danger-hover: #dc2626;

  /* Typography & Contrast Colors */
  --ve-text-primary: #f8fafc;
  --ve-text-secondary: #cbd5e1;
  --ve-text-muted: #94a3b8;

  /* Card Substrates */
  --ve-card-bg: rgba(255, 255, 255, 0.07);
  --ve-card-border: rgba(255, 255, 255, 0.14);

  /* Apple visionOS Liquid Glass Surface Tokens */
  --ve-glass-bg: linear-gradient(180deg, rgba(20, 28, 44, 0.58) 0%, rgba(12, 16, 26, 0.66) 100%);
  --ve-glass-border: rgba(255, 255, 255, 0.18);
  --ve-glass-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.28),
    0 12px 36px -4px rgba(0, 0, 0, 0.35),
    0 24px 56px -8px rgba(0, 0, 0, 0.45);
  --ve-glass-backdrop: blur(24px) saturate(190%) brightness(105%);

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
  position: fixed;
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
  background: var(--ve-glass-bg);
  border: 1px solid var(--ve-glass-border);
  box-shadow: var(--ve-glass-shadow);
  backdrop-filter: var(--ve-glass-backdrop);
  -webkit-backdrop-filter: var(--ve-glass-backdrop);
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
@keyframes veSlideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes vePopIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

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
.ve-highlight-box {
  position: fixed;
  pointer-events: none;
  border: 1.5px solid rgba(56, 189, 248, 0.85);
  background-color: rgba(56, 189, 248, 0.08);
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.3);
  border-radius: 6px;
  transition: all 0.06s var(--ve-ease-spring);
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
  background: rgba(15, 23, 42, 0.75);
  color: var(--ve-accent-text, #38bdf8);
  border: 1px solid rgba(255, 255, 255, 0.3);
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
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.ve-badge-dim {
  color: rgba(255, 255, 255, 0.6);
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
  background: linear-gradient(180deg, rgba(24, 32, 48, 0.58) 0%, rgba(12, 16, 26, 0.66) 100%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.35),
    0 8px 24px -4px rgba(0, 0, 0, 0.35),
    0 18px 44px -8px rgba(0, 0, 0, 0.45);
  backdrop-filter: var(--ve-glass-backdrop);
  -webkit-backdrop-filter: var(--ve-glass-backdrop);
  z-index: var(--ve-z-launcher);
  transition:
    inset-inline-start 0.28s var(--ve-ease-spring),
    inset-inline-end 0.28s var(--ve-ease-spring),
    inset-block-start 0.28s var(--ve-ease-spring),
    inset-block-end 0.28s var(--ve-ease-spring),
    transform 0.22s var(--ve-ease-spring),
    background 0.22s var(--ve-ease-spring),
    border-color 0.22s var(--ve-ease-spring),
    box-shadow 0.22s var(--ve-ease-spring);
  overflow: visible;

  & > svg {
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }

  &:hover {
    transform: scale(1.06);
    background: linear-gradient(180deg, rgba(32, 42, 64, 0.68) 0%, rgba(16, 22, 36, 0.76) 100%);
    border-color: rgba(255, 255, 255, 0.28);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.5),
      0 12px 32px -4px rgba(0, 0, 0, 0.4),
      0 22px 52px -8px rgba(0, 0, 0, 0.5);
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
  animation: veSlideUp 0.15s ease-out;
  touch-action: none;
  transition:
    inset-inline-start 0.28s var(--ve-ease-spring),
    inset-inline-end 0.28s var(--ve-ease-spring),
    inset-block-start 0.28s var(--ve-ease-spring),
    inset-block-end 0.28s var(--ve-ease-spring);
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
  color: rgba(255, 255, 255, 0.7);
  inline-size: 40px;
  block-size: 40px;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--ve-transition-smooth);
  flex-shrink: 0;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.25);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4);
    transform: scale(1.06);
  }

  &.ve-active {
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.55);
    color: #ffffff;
    box-shadow:
      inset 0 1.5px 2px rgba(255, 255, 255, 0.8),
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 0 14px rgba(255, 255, 255, 0.3);
    transform: scale(1.04);
  }

  &.ve-dock-send {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.14) 100%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    color: #ffffff;
    box-shadow: inset 0 1.5px 2px rgba(255, 255, 255, 0.75), 0 4px 16px rgba(0, 0, 0, 0.35);
  }
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

/* Comment Composer Popover */
.ve-comment-popover {
  position: fixed;
  border-radius: 20px;
  inline-size: 360px;
  max-inline-size: calc(100vw - 32px);
  z-index: var(--ve-z-panel);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: vePopIn 0.12s ease-out;
}

.ve-comment-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ve-comment-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ve-text-primary);
}

.ve-comment-textarea {
  position: relative;
  z-index: 2;
  font-size: 13px;
  padding-block: 8px;
  padding-inline: 10px;
  border-radius: 10px;
  resize: none;
  min-block-size: 72px;
  max-block-size: 240px;
  line-height: 1.45;
  inline-size: 100%;
  overflow-y: auto;
}

.ve-comment-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ve-comment-targets-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-block: 2px;
}

.ve-comment-target-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: var(--ve-accent-text, #38bdf8);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 500;
  padding-block: 2px;
  padding-inline: 6px;
  border-radius: 6px;
  max-inline-size: 150px;
  white-space: nowrap;
}

.ve-chip-remove {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--ve-transition-fast);

  &:hover {
    color: #f43f5e;
  }
}

.ve-pins-svg-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: calc(var(--ve-z-pin) - 1);
  inline-size: 100vw;
  block-size: 100vh;
}

.ve-hint {
  font-size: 11px;
  color: var(--ve-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 3px;

  & strong {
    color: var(--ve-text-primary);
    font-weight: 600;
  }
}

/* Comment Pins on Canvas */
.ve-pin {
  position: fixed;
  inline-size: 26px;
  block-size: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border: 2px solid #ffffff;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 3px 10px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.3),
    inset 0 1px 1.5px rgba(255, 255, 255, 0.4);
  cursor: pointer;
  pointer-events: auto;
  z-index: var(--ve-z-pin);
  transform: translate(-50%, -50%);
  transition: transform var(--ve-transition-smooth), box-shadow var(--ve-transition-fast), background var(--ve-transition-fast);

  &:hover {
    transform: translate(-50%, -50%) scale(1.15);
    background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
    box-shadow:
      0 5px 16px rgba(2, 132, 199, 0.6),
      0 0 0 1px rgba(0, 0, 0, 0.35);
  }

  &.ve-pin-multi {
    background: linear-gradient(135deg, #0284c7 0%, #4338ca 100%);
    border: 2px solid #38bdf8;
    box-shadow:
      0 3px 12px rgba(56, 189, 248, 0.45),
      0 0 0 1px rgba(0, 0, 0, 0.3),
      inset 0 1px 1.5px rgba(255, 255, 255, 0.5);

    &:hover {
      background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
      box-shadow:
        0 6px 18px rgba(56, 189, 248, 0.7),
        0 0 0 1px rgba(0, 0, 0, 0.35);
    }
  }
}

.ve-pin-link-badge {
  position: absolute;
  inset-block-start: -5px;
  inset-inline-end: -5px;
  inline-size: 13px;
  block-size: 13px;
  border-radius: 50%;
  background: #0284c7;
  border: 1.5px solid #38bdf8;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.ve-pin-target-highlight {
  position: fixed;
  pointer-events: none;
  border: 2px dashed #38bdf8;
  background-color: rgba(56, 189, 248, 0.12);
  border-radius: 6px;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.35);
  z-index: calc(var(--ve-z-pin) - 2);
  transition: all 0.08s ease-out;
}

.ve-pin-tooltip {
  position: absolute;
  background: rgba(12, 18, 32, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--ve-text-primary);
  padding-block: 10px;
  padding-inline: 14px;
  border-radius: 14px;
  font-size: 12px;
  min-inline-size: 240px;
  max-inline-size: 360px;
  white-space: normal;
  box-shadow: inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.35), 0 16px 40px rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  pointer-events: auto;
  cursor: default;
  z-index: var(--ve-z-tooltip);

  &.ve-pin-tooltip-above {
    inset-block-end: 28px;
    inset-block-start: auto;

    &::after {
      content: '';
      position: absolute;
      inset-block-end: -16px;
      inset-inline: -20px;
      block-size: 20px;
      background: transparent;
      pointer-events: auto;
    }
  }

  &.ve-pin-tooltip-below {
    inset-block-start: 28px;
    inset-block-end: auto;

    &::after {
      content: '';
      position: absolute;
      inset-block-start: -16px;
      inset-inline: -20px;
      block-size: 20px;
      background: transparent;
      pointer-events: auto;
    }
  }
}

/* Floating Toolbar */
.ve-toolbar {
  position: fixed;
  border-radius: 20px;
  inline-size: 340px;
  max-inline-size: calc(100vw - 32px);
  z-index: var(--ve-z-toolbar);
  display: flex;
  flex-direction: column;
  transition: inline-size var(--ve-transition-fast);

  &.ve-toolbar-wide {
    inline-size: 390px;
  }
}

.ve-toolbar-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block: 8px;
  padding-inline: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-weight: 600;
}

.ve-toolbar-tabs,
.ve-toolbar-content {
  position: relative;
  z-index: 2;
}

.ve-target-tag {
  color: var(--ve-accent-text, #38bdf8);
  font-family: ui-monospace, monospace;
  max-inline-size: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-toolbar-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
  padding: 3px 4px;
  gap: 2px;
}

.ve-tab-btn {
  flex: 1;
  background: none;
  border: none;
  color: var(--ve-text-muted);
  padding-block: 6px;
  padding-inline: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all var(--ve-transition-fast);
  text-align: center;

  &:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.08);
  }

  &.ve-active {
    color: var(--ve-accent-text, #38bdf8);
    background: rgba(255, 255, 255, 0.14);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
    font-weight: 600;
  }
}

.ve-toolbar-content {
  padding: 12px;
  max-block-size: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Controls & Form Elements */
.ve-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  inline-size: 100%;
  min-inline-size: 0;
}

.ve-label {
  font-size: 11px;
  color: var(--ve-text-muted);
  font-weight: 500;
  min-inline-size: 60px;
  flex-shrink: 0;
}

.ve-input {
  inline-size: 100%;
  min-inline-size: 0;
  padding-block: 6px;
  padding-inline: 10px;
  flex: 1;
}

.ve-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  inline-size: 100%;
}

.ve-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
}

.ve-badge-subtle {
  font-size: 10px;
  color: var(--ve-text-muted);
  background: rgba(255, 255, 255, 0.08);
  padding-block: 1px;
  padding-inline: 5px;
  border-radius: 4px;
  font-weight: 500;
}

.ve-textarea-adaptive {
  inline-size: 100%;
  min-inline-size: 0;
  line-height: 1.45;
  padding-block: 7px;
  padding-inline: 9px;
  resize: none;
  overflow-y: auto;
}

.ve-btn-group {
  display: flex;
  gap: 4px;
  flex: 1;
  min-inline-size: 0;
}

.ve-mini-btn {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--ve-text-secondary);
  font-size: 11px;
  padding-block: 4px;
  padding-inline: 8px;
  border-radius: 6px;
  cursor: pointer;
  flex: 1;
  min-inline-size: 0;
  text-align: center;
  transition: all var(--ve-transition-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  &.ve-active {
    background: #0284c7;
    border-color: #38bdf8;
    color: #ffffff;
  }
}

.ve-close-btn {
  inline-size: 24px;
  block-size: 24px;
  padding: 0;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--ve-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  box-sizing: border-box;
  transition: all var(--ve-transition-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
}

/* Spacing Visual Box */
.ve-box-model {
  background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  inline-size: 100%;
}

.ve-box-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-inline-size: 0;
  inline-size: 100%;

  & span {
    font-size: 10px;
    color: var(--ve-text-muted);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Slider Controls with Origin Indicator */
.ve-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  inline-size: 100%;
}

.ve-slider-wrap {
  display: flex;
  align-items: center;
  position: relative;
  flex: 1;
  min-inline-size: 0;
}

.ve-slider {
  -webkit-appearance: none;
  appearance: none;
  inline-size: 100%;
  block-size: 6px;
  border-radius: 3px;
  background: #334155;
  outline: none;
  cursor: pointer;
  margin: 0;
  transition: background var(--ve-transition-fast);

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    inline-size: 14px;
    block-size: 14px;
    border-radius: 50%;
    background: #38bdf8;
    border: 2px solid #0f172a;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: transform 0.1s ease;

    &:hover {
      transform: scale(1.2);
    }
  }
}

.ve-slider-val {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--ve-accent-text, #38bdf8);
  font-weight: 600;
  min-inline-size: 38px;
  text-align: right;
  cursor: pointer;
  flex-shrink: 0;
  padding-block: 2px;
  padding-inline: 4px;
  border-radius: 4px;
  background: rgba(30, 41, 59, 0.6);

  &:hover {
    background: #334155;
  }
}

.ve-origin-tick {
  position: absolute;
  inset-block-start: 50%;
  transform: translateY(-50%);
  inline-size: 3px;
  block-size: 10px;
  background: var(--ve-accent, #38bdf8);
  border-radius: 1px;
  pointer-events: none;
  opacity: 0.85;
}

/* Edit Review Drawer */
.ve-drawer {
  position: fixed;
  inset-block-end: 78px;
  inset-inline-end: 20px;
  inline-size: 420px;
  max-inline-size: calc(100vw - 40px);
  max-block-size: calc(100vh - 100px);
  border-radius: 22px;
  z-index: var(--ve-z-panel);
  display: flex;
  flex-direction: column;
  animation: veSlideUp 0.16s ease-out;
  transition:
    inset-inline-start 0.28s var(--ve-ease-spring),
    inset-inline-end 0.28s var(--ve-ease-spring),
    inset-block-start 0.28s var(--ve-ease-spring),
    inset-block-end 0.28s var(--ve-ease-spring);
}

.ve-dock-right .ve-drawer {
  inset-inline-end: 20px;
  inset-inline-start: auto;
}

.ve-dock-left .ve-drawer {
  inset-inline-start: 20px;
  inset-inline-end: auto;
}

.ve-dock-bottom .ve-drawer {
  inset-block-end: var(--ve-panel-offset-y, 78px);
  inset-block-start: auto;
  max-block-size: calc(100vh - var(--ve-panel-offset-y, 78px) - 20px);
}

.ve-dock-top .ve-drawer {
  inset-block-start: var(--ve-panel-offset-y, 78px);
  inset-block-end: auto;
  max-block-size: calc(100vh - var(--ve-panel-offset-y, 78px) - 20px);
}

.ve-drawer-header {
  position: relative;
  z-index: 2;
  padding-block: 12px;
  padding-inline: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ve-drawer-body,
.ve-drawer-footer {
  position: relative;
  z-index: 2;
}

.ve-drawer-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ve-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.ve-status-tag {
  font-size: 10px;
  text-transform: uppercase;
  padding-block: 2px;
  padding-inline: 6px;
  border-radius: 4px;
  font-weight: 700;
  background: #334155;
  color: var(--ve-text-muted);

  &.draft { background: #3b82f6; color: #ffffff; }
  &.submitted { background: #eab308; color: #000000; }
  &.in_progress { background: #a855f7; color: #ffffff; }
  &.implemented { background: #22c55e; color: #ffffff; }
}

.ve-drawer-body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ve-mutation-card {
  background: var(--ve-card-bg, rgba(0, 0, 0, 0.35));
  border: 1px solid var(--ve-card-border, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.ve-mut-target {
  color: var(--ve-accent-text, #38bdf8);
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.ve-mut-diff {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ve-text-secondary, #cbd5e1);
}

.ve-mut-before {
  color: var(--ve-danger, #ef4444);
  text-decoration: line-through;
  opacity: 0.8;
}

.ve-mut-after {
  color: #22c55e;
  font-weight: 600;
}

.ve-prompt-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ve-textarea {
  padding-block: 8px;
  padding-inline: 10px;
  resize: vertical;
  min-block-size: 60px;
}

.ve-drawer-footer {
  padding-block: 12px;
  padding-inline: 16px;
  background: rgba(255, 255, 255, 0.04);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.ve-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25);
  color: #ffffff;
  padding-block: 8px;
  padding-inline: 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--ve-transition-smooth);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.35);
    transform: translateY(-0.5px);
  }

  &.primary {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%);
    border: 1px solid rgba(255, 255, 255, 0.45);
    box-shadow: inset 0 1.5px 1.5px rgba(255, 255, 255, 0.75), 0 6px 20px rgba(0, 0, 0, 0.4);
    color: #ffffff;

    &:hover {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.2) 100%);
      border-color: rgba(255, 255, 255, 0.65);
      box-shadow: inset 0 2px 2px rgba(255, 255, 255, 0.9), 0 8px 26px rgba(0, 0, 0, 0.5);
      transform: translateY(-0.5px);
    }
  }

  &.danger {
    background: #dc2626;

    &:hover {
      background: #b91c1c;
    }
  }
}

.ve-replies-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-block-start: 8px;
  border-top: 1px solid #334155;
  padding-block-start: 8px;
}

.ve-reply-item {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding-block: 8px;
  padding-inline: 10px;
  font-size: 11px;
}

.ve-reply-author {
  font-weight: 700;
  color: var(--ve-accent-text, #38bdf8);
  margin-block-end: 2px;
}

/* Shared Drawer & Card Helpers */
.ve-drawer-badge {
  font-size: 11px;
  color: var(--ve-accent-text, #38bdf8);
  font-weight: 600;
  background: rgba(56, 189, 248, 0.12);
  padding: 1px 6px;
  border-radius: 10px;
}

.ve-drawer-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ve-mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.ve-mode-pill.is-live {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(52, 211, 153, 0.45);
}

.ve-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #34d399;
  box-shadow: 0 0 6px #34d399;
}

.ve-status-dot--live {
  background-color: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
}

.ve-status-dot--accent {
  background-color: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
}

.ve-mode-label {
  font-size: 11px;
  font-weight: 600;
  color: #cbd5e1;
}

.ve-mode-label.is-live {
  color: #6ee7b7;
}

.ve-mode-track {
  width: 22px;
  height: 13px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  display: inline-flex;
  align-items: center;
  padding: 1.5px;
  box-sizing: border-box;
  transition: background 0.15s ease;
  margin-left: 2px;
}

.ve-mode-track.is-live {
  background: rgba(52, 211, 153, 0.35);
}

.ve-mode-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
  transform: translateX(0);
  transition: transform 0.15s ease;
}

.ve-mode-thumb.is-live {
  background: #34d399;
  transform: translateX(9px);
}

.ve-drawer-empty {
  padding: 36px 0;
  text-align: center;
}

.ve-drawer-empty-text {
  font-weight: 500;
  font-size: 13px;
  color: var(--ve-text-muted, #94a3b8);
}

.ve-drawer-sections {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ve-drawer-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ve-drawer-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ve-drawer-section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--ve-text-primary, #f8fafc);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ve-drawer-section-title--accent {
  color: var(--ve-accent-text, #38bdf8);
}

.ve-drawer-section-title--green {
  color: #10b981;
}

.ve-drawer-autosave-bar {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.25);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ve-text-muted, #94a3b8);
  font-weight: 500;
  user-select: none;
}

.ve-drawer-autosave-status {
  display: flex;
  align-items: center;
  gap: 7px;
}

.ve-update-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.4);
  color: #38bdf8;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ve-drawer-version {
  font-size: 10px;
  color: var(--ve-text-muted, #64748b);
  font-weight: 500;
}

.ve-drawer-footer--compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
}

.ve-footer-btn {
  flex: 1;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
}

.ve-footer-btn--submit {
  flex: 1.3;
}

.ve-route-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--ve-text-muted, #94a3b8);
  font-family: monospace;
}

.ve-route-badge.is-current {
  background: rgba(56, 189, 248, 0.15);
  color: var(--ve-accent-text, #38bdf8);
}

.ve-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.ve-card-top--center {
  align-items: center;
  margin-bottom: 4px;
}

.ve-card-target-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ve-card-target-ellipsis {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.ve-card-link {
  background: none;
  border: none;
  color: var(--ve-text-muted, #94a3b8);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 0 2px;
}

.ve-card-link--danger {
  color: #f43f5e;
}

.ve-card-link--muted {
  color: #64748b;
}

.ve-card-pill-btn {
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.1s ease;
}

.ve-card-pill-btn--accent {
  background: rgba(56, 189, 248, 0.16);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  padding: 2px 8px;
}

.ve-card-pill-btn--blue {
  background: rgba(59, 130, 246, 0.18);
  border: 1px solid rgba(96, 165, 250, 0.35);
  color: #93c5fd;
}

.ve-card-pill-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #fca5a5;
}

.ve-mut-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ve-mut-added {
  color: #22c55e;
}

.ve-mut-removed {
  color: #ef4444;
}

.ve-mut-reordered {
  color: var(--ve-accent-text, #0284c7);
}

.ve-mut-tw {
  color: var(--ve-accent-text, #0284c7);
  margin-left: 6px;
  font-size: 11px;
}

.ve-card--voice {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.ve-card--screenshot {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.ve-card--proposal {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  gap: 8px;
}

.ve-card--decision {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ve-card-type-label {
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ve-card-type-label--voice {
  color: #fca5a5;
}

.ve-card-type-label--screenshot {
  color: #f59e0b;
}

.ve-target-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.ve-target-chip {
  font-size: 10px;
  font-family: ui-monospace, monospace;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--ve-accent-text, #38bdf8);
  padding: 1px 5px;
  border-radius: 4px;
}

.ve-target-chip--voice {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.35);
  color: #fca5a5;
}

.ve-card-quote {
  font-size: 11px;
  color: var(--ve-amber-text, #d97706);
  background: rgba(251, 191, 36, 0.14);
  border-left: 2px solid var(--ve-amber-text, #d97706);
  padding: 3px 6px;
  border-radius: 2px;
  margin-bottom: 4px;
  font-style: italic;
  word-break: break-word;
}

.ve-card-edit-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.ve-card-edit-textarea {
  background: rgba(0, 0, 0, 0.45);
  color: var(--ve-text-primary, #f8fafc);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  padding: 6px;
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
  min-height: 48px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.ve-card-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.ve-card-save-btn {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.7);
  color: #ffffff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 3px 10px;
}

.ve-voice-section {
  background: rgba(0, 0, 0, 0.22);
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.ve-voice-section-title {
  color: #fca5a5;
  font-weight: 600;
  font-size: 10px;
}

.ve-card-comment-text {
  color: var(--ve-text-primary, #f8fafc);
  font-size: 12px;
  cursor: pointer;
}

.ve-card-screenshot-wrap {
  margin-top: 6px;
  margin-bottom: 4px;
}

.ve-card-screenshot-img {
  width: 100%;
  max-height: 140px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.4);
  cursor: zoom-in;
  display: block;
}

.ve-proposal-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
}

.ve-decision-name {
  font-size: 12px;
  color: #4ade80;
  font-weight: 600;
}

/* Shared Toolbar Helpers */
.ve-toolbar-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ve-toolbar-stack--lg {
  gap: 10px;
}

.ve-toolbar-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ve-edited-pill {
  font-size: 9px;
  background: #3b82f6;
  color: #fff;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 700;
}

.ve-row--spaced {
  margin-top: 8px;
}

.ve-swatch-row {
  display: flex;
  gap: 4px;
  align-items: center;
  flex: 1;
  overflow-x: auto;
  padding: 2px 0;
}

.ve-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  flex-shrink: 0;
}

.ve-swatch.is-active {
  border: 2px solid #38bdf8;
}

.ve-color-picker {
  width: 32px;
  height: 26px;
  border: none;
  background: none;
  cursor: pointer;
}

.ve-color-picker--sm {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.ve-action-ribbon {
  border-top: 1px solid #334155;
  padding-top: 8px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.ve-icon-btn {
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ve-icon-btn--accent {
  color: var(--ve-accent-text, #0284c7);
}

.ve-icon-btn--danger {
  color: #f43f5e;
}

.ve-class-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.ve-class-chip {
  font-size: 11px;
  background: #1e293b;
  border: 1px solid #475569;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ve-class-chip-remove {
  background: none;
  border: none;
  color: #f43f5e;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}

.ve-variant-switcher-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: var(--ve-z-toolbar, 999999);
}

.ve-variant-bounds {
  position: fixed;
  pointer-events: none;
  box-sizing: border-box;
}

.ve-variant-corner {
  position: absolute;
  width: 7px;
  height: 7px;
  border-color: rgba(255, 255, 255, 0.45);
  border-style: solid;
  border-width: 0;
}

.ve-variant-corner--tl {
  top: 0;
  left: 0;
  border-top-width: 1.5px;
  border-left-width: 1.5px;
  border-top-left-radius: 2px;
}

.ve-variant-corner--tr {
  top: 0;
  right: 0;
  border-top-width: 1.5px;
  border-right-width: 1.5px;
  border-top-right-radius: 2px;
}

.ve-variant-corner--bl {
  bottom: 0;
  left: 0;
  border-bottom-width: 1.5px;
  border-left-width: 1.5px;
  border-bottom-left-radius: 2px;
}

.ve-variant-corner--br {
  bottom: 0;
  right: 0;
  border-bottom-width: 1.5px;
  border-right-width: 1.5px;
  border-bottom-right-radius: 2px;
}

.ve-variant-switcher-bar {
  position: fixed;
  pointer-events: auto;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 8px 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 470px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
}

.ve-variant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ve-variant-drag-handle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: grab;
  flex-shrink: 0;
}

.ve-variant-drag-icon {
  flex-shrink: 0;
}

.ve-variant-title {
  font-size: 11px;
  font-weight: 600;
  color: #f1f5f9;
  letter-spacing: 0.01em;
}

.ve-variant-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ve-variant-close-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ve-variant-decided-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 0;
}

.ve-variant-decided-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.ve-variant-applied-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
  border: 1px solid rgba(52, 211, 153, 0.35);
  flex-shrink: 0;
}

.ve-variant-decided-name {
  font-size: 12px;
  font-weight: 600;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-variant-decided-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ve-variant-change-btn {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(96, 165, 250, 0.4);
  color: #93c5fd;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.1s ease;
}

.ve-variant-delete-btn {
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fca5a5;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.1s ease;
}

.ve-variant-options-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.ve-variant-option-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: none;
  transition: all 0.1s ease;
  flex: 1 1 0;
  text-align: center;
}

.ve-variant-option-btn.is-selected {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.45);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.ve-variant-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 6px;
  min-height: 26px;
  height: 26px;
  box-sizing: border-box;
}

.ve-variant-rationale {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-variant-rationale.is-active {
  color: #cbd5e1;
  font-style: normal;
}

.ve-variant-apply-btn {
  background: rgba(16, 185, 129, 0.22);
  border: 1px solid rgba(52, 211, 153, 0.45);
  border-radius: 6px;
  color: #6ee7b7;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.18);
  transition: all 0.1s ease;
  flex-shrink: 0;
}

.ve-variant-original-badge {
  font-size: 10px;
  color: #475569;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.ve-verification-halo-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: var(--ve-z-overlay, 999998);
}

.ve-verification-halo-box {
  position: fixed;
  border: 2px solid #10b981;
  border-radius: 8px;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.28), 0 0 24px rgba(16, 185, 129, 0.45);
  background: rgba(16, 185, 129, 0.06);
  pointer-events: none;
  transition: all 0.25s ease;
}

.ve-verification-halo-badge {
  position: absolute;
  top: -24px;
  left: 0;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.4);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
`;
