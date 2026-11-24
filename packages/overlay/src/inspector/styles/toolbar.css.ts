export const TOOLBAR_CSS = `
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
  padding: 3px 4px;
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
    font-weight: 600;
  }

  &:focus-visible {
    outline: 2px solid #7dd3fc;
    outline-offset: -2px;
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

  &:focus-visible {
    box-shadow: 0 0 0 2px #0f172a, 0 0 0 4px rgba(56, 189, 248, 0.9);
  }

  &:focus-visible::-webkit-slider-thumb {
    transform: scale(1.18);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9);
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
  padding: 5px 4px;
}

.ve-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  flex-shrink: 0;
}

.ve-swatch:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
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
`;
