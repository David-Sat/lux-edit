import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

export function DockMenu() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  const totalCount = state.mutations.length + state.annotations.length;
  const isAgentListening = state.isAgentListening;

  if (!state.isDockMenuOpen && state.activeTool === 'none') {
    return (
      <button
        class="ve-launcher-btn"
        title="Open LUX Tools (V / C / R)"
        onClick={() => state.setDockMenuOpen(true)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        {totalCount > 0 && <span class="ve-launcher-badge">{totalCount}</span>}
      </button>
    );
  }

  return (
    <div class="ve-dock-menu">
      {/* Visual Edit Mode Button - Clear Pencil / Edit Tool Icon */}
      <button
        class={`ve-dock-item ${state.activeTool === 'edit' ? 've-active' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'edit' ? 'none' : 'edit')}
        title="Visual Edit Mode (V)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {/* Comment Pin Mode Button */}
      <button
        class={`ve-dock-item ${state.activeTool === 'comment' ? 've-active' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'comment' ? 'none' : 'comment')}
        title="Comment Pin Mode (C)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Review Changes Drawer Toggle */}
      <button
        class={`ve-dock-item ${state.isDrawerOpen ? 've-active' : ''}`}
        style={{ position: 'relative' }}
        onClick={() => state.setDrawerOpen(!state.isDrawerOpen)}
        title={`Review Changes (${totalCount}) (R)`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        {totalCount > 0 && <span class="ve-dock-badge">{totalCount}</span>}
      </button>

      {/* Trigger Mode: Direct Send to Agent Button in Pill (Only shown when Agent is actively listening) */}
      {isAgentListening && (
        <button
          class="ve-dock-item"
          style={{ background: '#6366f1', color: '#ffffff' }}
          onClick={() => state.submitBatch()}
          disabled={totalCount === 0 && !state.userPrompt.trim()}
          title="Send to Agent (Cmd+Enter)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      )}

      {/* Close / Collapse Button */}
      <button
        class="ve-dock-item ve-dock-close"
        onClick={() => {
          state.setTool('none');
          state.setDockMenuOpen(false);
          state.setDrawerOpen(false);
        }}
        title="Minimize (Esc)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
