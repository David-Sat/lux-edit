export const OVERLAY_STYLES = `
/* ==========================================================================
   Design Tokens & CSS Variables
   ========================================================================== */
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
  --ve-z-tooltip: 2147483648;
}

/* ==========================================================================
   Host & Root Isolation
   ========================================================================== */
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
.ve-drawer,
.ve-theme-panel {
  pointer-events: auto !important;
}

/* ==========================================================================
   Shared Component Primitives
   ========================================================================== */

/* Universal Glass Panels */
.ve-dock-menu,
.ve-comment-popover,
.ve-toolbar,
.ve-theme-panel,
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

/* ==========================================================================
   Animations
   ========================================================================== */
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

/* ==========================================================================
   Canvas Highlight Overlays & Target Badges
   ========================================================================== */
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

/* ==========================================================================
   Floating Launcher Button & Dock Menu
   ========================================================================== */
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
  cursor: pointer;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.35),
    0 8px 24px -4px rgba(0, 0, 0, 0.35),
    0 18px 44px -8px rgba(0, 0, 0, 0.45);
  backdrop-filter: var(--ve-glass-backdrop);
  -webkit-backdrop-filter: var(--ve-glass-backdrop);
  z-index: var(--ve-z-launcher);
  transition: all 0.22s var(--ve-ease-spring);
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

/* ==========================================================================
   Comment Composer Popover
   ========================================================================== */
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

/* ==========================================================================
   Comment Pins on Canvas
   ========================================================================== */
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

/* ==========================================================================
   Floating Toolbar
   ========================================================================== */
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

/* ==========================================================================
   Theme Drawer & Settings Panel
   ========================================================================== */
.ve-theme-panel {
  position: fixed;
  inset-block-end: 78px;
  inset-inline-end: 20px;
  inline-size: 380px;
  max-inline-size: calc(100vw - 40px);
  max-block-size: calc(100vh - 100px);
  border-radius: 22px;
  z-index: var(--ve-z-panel);
  display: flex;
  flex-direction: column;
  animation: veSlideUp 0.16s ease-out;
}

/* ==========================================================================
   Edit Review Drawer
   ========================================================================== */
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
`;
