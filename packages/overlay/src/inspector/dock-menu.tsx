import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

export function DockMenu() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  const totalCount = state.mutations.length + state.annotations.length;

  if (!state.isDockMenuOpen && state.activeTool === 'none') {
    return (
      <button
        class="ve-launcher-btn"
        title="Open Visual Edit & Comment Tools"
        onClick={() => state.setDockMenuOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        {totalCount > 0 && <span class="ve-launcher-badge">{totalCount}</span>}
      </button>
    );
  }

  return (
    <div class="ve-dock-menu">
      <button
        class={`ve-dock-item ${state.activeTool === 'edit' ? 've-active' : ''}`}
        onClick={() => state.setTool('edit')}
        title="Visual Edit Mode: Click to tweak CSS, double-click text to rewrite"
      >
        <span>⚡</span> Visual Edit
      </button>

      <button
        class={`ve-dock-item ${state.activeTool === 'comment' ? 've-active' : ''}`}
        onClick={() => state.setTool('comment')}
        title="Comment Mode: Click an element to attach a feedback pin"
      >
        <span>💬</span> Comment
      </button>

      <button
        class={`ve-dock-item ${state.isDrawerOpen ? 've-active' : ''}`}
        onClick={() => state.setDrawerOpen(!state.isDrawerOpen)}
        title="Open Review Tray & Submit to Agent"
      >
        <span>📋</span> Changes {totalCount > 0 && `(${totalCount})`}
      </button>

      <button
        class="ve-dock-item ve-dock-close"
        onClick={() => {
          state.setTool('none');
          state.setDockMenuOpen(false);
          state.setDrawerOpen(false);
        }}
        title="Close & Exit Review Mode"
      >
        ✕
      </button>
    </div>
  );
}
