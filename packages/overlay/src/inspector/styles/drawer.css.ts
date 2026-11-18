export const DRAWER_CSS = `
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

.ve-verification-halo-box--fetched {
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.22), 0 0 24px rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.08);
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

.ve-verification-halo-badge--inside {
  top: 4px;
  left: 4px;
}
`;
