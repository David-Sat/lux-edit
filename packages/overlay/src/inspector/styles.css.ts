export const OVERLAY_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  color: #e2e8f0;
  line-height: 1.4;
  user-select: none;
  -webkit-font-smoothing: antialiased;
  z-index: 2147483647;
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* --- Canvas Highlight Overlays --- */
.ve-highlight-box {
  position: fixed;
  pointer-events: none;
  border: 2px solid #3b82f6;
  background-color: rgba(59, 130, 246, 0.08);
  border-radius: 4px;
  transition: all 0.06s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 2147483640;
}

.ve-highlight-box.ve-comment-mode {
  border: 2px dashed #a855f7;
  background-color: rgba(168, 85, 247, 0.1);
}

.ve-highlight-box.ve-active {
  border: 2px solid #6366f1;
  background-color: rgba(99, 102, 241, 0.12);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2), 0 4px 20px rgba(99, 102, 241, 0.35);
}

.ve-badge {
  position: absolute;
  top: -24px;
  left: -2px;
  background: #1e1b4b;
  color: #a5b4fc;
  border: 1px solid #4338ca;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.ve-badge-dim {
  color: #94a3b8;
  font-weight: normal;
  margin-left: 4px;
}

/* --- Floating Bottom Launcher & Dock --- */
.ve-launcher-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3);
  z-index: 2147483646;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.ve-launcher-btn:hover {
  transform: scale(1.08);
  background: #4f46e5;
  box-shadow: 0 10px 28px rgba(99, 102, 241, 0.6);
}

.ve-launcher-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #0f172a;
}

.ve-dock-menu {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(51, 65, 85, 0.85);
  border-radius: 9999px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
  z-index: 2147483646;
  backdrop-filter: blur(16px);
  animation: veSlideUp 0.15s ease-out;
}

@keyframes veSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.ve-dock-item {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.ve-dock-item:hover {
  color: #f8fafc;
  background: rgba(51, 65, 85, 0.7);
  transform: scale(1.04);
}

.ve-dock-item.ve-active {
  background: #6366f1;
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.5);
}

.ve-dock-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #ef4444;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #0f172a;
}

.ve-dock-close {
  color: #64748b;
  width: 32px;
  height: 32px;
}

.ve-dock-close:hover {
  background: rgba(51, 65, 85, 0.85);
  color: #f8fafc;
  transform: none;
}

/* --- Comment Composer Popover --- */
.ve-comment-popover {
  position: fixed;
  background: #0f172a;
  border: 1px solid #4338ca;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.3);
  width: 320px;
  z-index: 2147483647;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: vePopIn 0.12s ease-out;
}

@keyframes vePopIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.ve-comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #a5b4fc;
  font-weight: 600;
}

.ve-comment-textarea {
  background: #1e293b;
  border: 1px solid #475569;
  color: #f8fafc;
  font-size: 12px;
  font-family: inherit;
  padding: 8px 10px;
  border-radius: 8px;
  outline: none;
  resize: vertical;
  min-height: 64px;
  line-height: 1.4;
}

.ve-comment-textarea:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
}

.ve-comment-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ve-hint {
  font-size: 10px;
  color: #64748b;
}

/* --- Comment Pin on Elements --- */
.ve-pin {
  position: fixed;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #a855f7;
  border: 2px solid #ffffff;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  pointer-events: auto;
  z-index: 2147483642;
  transform: translate(-50%, -50%);
  transition: transform 0.15s ease;
}

.ve-pin:hover {
  transform: translate(-50%, -50%) scale(1.2);
  background: #9333ea;
}

.ve-pin-tooltip {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  border: 1px solid #334155;
  color: #f8fafc;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  max-width: 240px;
  white-space: normal;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

/* --- Floating Toolbar --- */
.ve-toolbar {
  position: fixed;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
  width: 340px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  z-index: 2147483645;
  color: #f8fafc;
  overflow: hidden;
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
}

.ve-toolbar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  font-size: 11px;
  font-weight: 600;
  box-sizing: border-box;
}

.ve-target-tag {
  color: #38bdf8;
  font-family: ui-monospace, monospace;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-toolbar-tabs {
  display: flex;
  border-bottom: 1px solid #334155;
  background: #0f172a;
  padding: 2px 4px;
  gap: 2px;
  box-sizing: border-box;
}

.ve-tab-btn {
  flex: 1;
  background: none;
  border: none;
  color: #94a3b8;
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
  text-align: center;
  box-sizing: border-box;
}

.ve-tab-btn:hover {
  color: #f1f5f9;
  background: #1e293b;
}

.ve-tab-btn.ve-active {
  color: #38bdf8;
  background: #1e293b;
  font-weight: 600;
}

.ve-toolbar-content {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

/* Controls */
.ve-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.ve-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
  min-width: 60px;
  flex-shrink: 0;
}

.ve-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  background: #1e293b;
  border: 1px solid #475569;
  color: #f8fafc;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  outline: none;
  flex: 1;
  transition: border-color 0.15s ease;
}

.ve-input:focus {
  border-color: #38bdf8;
}

.ve-btn-group {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
}

.ve-mini-btn {
  background: #1e293b;
  border: 1px solid #475569;
  color: #cbd5e1;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  text-align: center;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.ve-mini-btn:hover {
  background: #334155;
  color: #ffffff;
}

.ve-mini-btn.ve-active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
}

/* Spacing Visual Box */
.ve-box-model {
  background: #1e293b;
  border: 1px dashed #475569;
  border-radius: 8px;
  padding: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.ve-box-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.ve-box-field span {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Slider Controls with Origin Indicator */
.ve-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.ve-slider-wrap {
  display: flex;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 0;
}

.ve-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #334155;
  outline: none;
  cursor: pointer;
  margin: 0;
  transition: background 0.15s ease;
}

.ve-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #38bdf8;
  border: 2px solid #0f172a;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transition: transform 0.1s ease;
}

.ve-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.ve-slider-val {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #38bdf8;
  font-weight: 600;
  min-width: 38px;
  text-align: right;
  cursor: pointer;
  flex-shrink: 0;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgba(30, 41, 59, 0.6);
}

.ve-slider-val:hover {
  background: #334155;
}

.ve-origin-tick {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 10px;
  background: #a855f7;
  border-radius: 1px;
  pointer-events: none;
  opacity: 0.85;
}

/* Theme Drawer / Settings Panel */
.ve-theme-panel {
  position: fixed;
  bottom: 78px;
  right: 20px;
  width: 380px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 100px);
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(51, 65, 85, 0.9);
  border-radius: 16px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(24px);
  animation: veSlideUp 0.16s ease-out;
}

/* Edit Review Drawer / Floating Panel Above Dock */
.ve-drawer {
  position: fixed;
  bottom: 78px;
  right: 20px;
  width: 420px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 100px);
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(51, 65, 85, 0.9);
  border-radius: 16px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(24px);
  animation: veSlideUp 0.16s ease-out;
}

.ve-drawer-header {
  padding: 12px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ve-drawer-title {
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ve-status-tag {
  font-size: 10px;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  background: #334155;
  color: #94a3b8;
}

.ve-status-tag.draft { background: #3b82f6; color: #fff; }
.ve-status-tag.submitted { background: #eab308; color: #000; }
.ve-status-tag.in_progress { background: #a855f7; color: #fff; }
.ve-status-tag.implemented { background: #22c55e; color: #fff; }

.ve-drawer-body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ve-mutation-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.ve-mut-target {
  color: #38bdf8;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.ve-mut-diff {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
}

.ve-mut-before {
  color: #ef4444;
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
  background: #1e293b;
  border: 1px solid #475569;
  color: #f8fafc;
  font-size: 12px;
  padding: 8px;
  border-radius: 8px;
  outline: none;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.ve-textarea:focus {
  border-color: #6366f1;
}

.ve-drawer-footer {
  padding: 12px 16px;
  background: #1e293b;
  border-top: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.ve-btn {
  background: #475569;
  border: none;
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ve-btn:hover {
  background: #64748b;
}

.ve-btn.primary {
  background: #6366f1;
}

.ve-btn.primary:hover {
  background: #4f46e5;
}

.ve-btn.danger {
  background: #dc2626;
}

.ve-btn.danger:hover {
  background: #b91c1c;
}

.ve-replies-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  border-top: 1px solid #334155;
  padding-top: 8px;
}

.ve-reply-item {
  background: #1e1b4b;
  border: 1px solid #4338ca;
  border-radius: 6px;
  padding: 8px;
  font-size: 11px;
}

.ve-reply-author {
  font-weight: 700;
  color: #a5b4fc;
  margin-bottom: 2px;
}
`;
