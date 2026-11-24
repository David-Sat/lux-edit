export const COMPOSER_CSS = `
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
}

.ve-comment-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #f8fafc;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.48);
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
  gap: 8px;
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
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #ffffff;
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
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--ve-transition-fast);

  &:hover {
    color: #ffffff;
  }
}

.ve-pins-layer {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  inline-size: 0;
  block-size: 0;
  pointer-events: none;
}

.ve-pins-svg-overlay {
  position: absolute;
  pointer-events: none;
  z-index: calc(var(--ve-z-pin) - 1);
  overflow: visible;
}

.ve-hint {
  font-size: 11px;
  color: #f1f5f9;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.48);
  display: inline-flex;
  align-items: center;
  gap: 3px;

  & strong {
    color: #ffffff;
    font-weight: 600;
  }
}

/* Comment Pins on Canvas */
.ve-pin {
  position: absolute;
  border-radius: 50%;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: none;
  pointer-events: auto;
  z-index: var(--ve-z-pin);
  transform: translate(-50%, -50%);
  transition: transform var(--ve-transition-smooth), box-shadow var(--ve-transition-fast), background var(--ve-transition-fast);
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
  position: absolute;
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
  border: 1px solid transparent;
  color: var(--ve-text-primary);
  padding-block: 10px;
  padding-inline: 14px;
  border-radius: 14px;
  font-size: 12px;
  min-inline-size: 240px;
  max-inline-size: 360px;
  white-space: normal;
  pointer-events: auto;
  cursor: default;
  z-index: var(--ve-z-tooltip);

  &.ve-pin-tooltip-above {
    inset-block-end: 28px;
    inset-block-start: auto;

    &::after {
      content: '';
      position: absolute;
      inset-block-end: -4px;
      inset-inline: -8px;
      block-size: 5px;
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
      inset-block-start: -4px;
      inset-inline: -8px;
      block-size: 5px;
      background: transparent;
      pointer-events: auto;
    }
  }
}

.ve-comment-header.is-multi {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.ve-comment-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ve-comment-header-label {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-comment-screenshot-title {
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.ve-comment-screenshot-tag {
  color: #ffffff;
}

.ve-comment-multi-title {
  font-weight: 600;
  color: #ffffff;
}

.ve-comment-accent-strong {
  color: #ffffff;
}

.ve-comment-selected-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-comment-selected-strong {
  color: #ffffff;
}

.ve-close-btn--compact {
  inline-size: 20px;
  block-size: 20px;
}

.ve-comment-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.ve-composer-screenshot-box {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.45);
}

.ve-composer-screenshot-img {
  display: block;
  width: 100%;
  max-height: 120px;
  object-fit: contain;
  background: #090d16;
}

.ve-composer-screenshot-detach {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #ffffff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
}

.ve-comment-footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.ve-composer-snap-btn {
  background: rgba(12, 18, 32, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 6px;
  color: #f8fafc;
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.ve-composer-hint {
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ve-composer-reload-ready {
  color: #ffffff;
  font-weight: 600;
}

.ve-composer-submit-btn {
  padding: 5px 12px;
  font-size: 11px;
  white-space: nowrap;
}

.ve-pin-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}

.ve-pin-tooltip-title {
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
}

.ve-pin-tooltip-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}

.ve-pin-tooltip-edit-btn,
.ve-pin-tooltip-resolve-btn {
  inline-size: 22px;
  block-size: 22px;
  padding: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.26);
  color: #f8fafc;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.24);
    border-color: rgba(255, 255, 255, 0.45);
    color: #ffffff;
  }
}

.ve-pin-tooltip-quote {
  font-size: 11px;
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.08);
  border-left: 2px solid rgba(255, 255, 255, 0.55);
  padding: 3px 6px;
  border-radius: 2px;
  margin-bottom: 6px;
  font-style: italic;
  word-break: break-word;
}

.ve-pin-edit-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ve-pin-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.ve-pin-edit-cancel-btn {
  background: none;
  border: none;
  color: rgba(241, 245, 249, 0.82);
  font-size: 10px;
  cursor: pointer;
  padding: 2px 6px;

  &:hover {
    color: #ffffff;
  }
}

.ve-pin-edit-save-btn {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.7);
  color: #ffffff;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  padding: 3px 10px;
}

.ve-pin-tooltip-body {
  color: #f8fafc;
  font-size: 12px;
  cursor: pointer;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
}
`;
