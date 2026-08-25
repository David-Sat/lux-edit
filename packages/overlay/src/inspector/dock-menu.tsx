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
        title="Open LUX Tools (V / C)"
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
    <div
      class="ve-dock-menu"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
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

      {/* Global App Theme & Design Tokens Button */}
      <button
        class={`ve-dock-item ${state.isThemePanelOpen ? 've-active' : ''}`}
        onClick={() => state.setThemePanelOpen(!state.isThemePanelOpen)}
        title="App Theme & Design Tokens"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      </button>

      {/* Review Changes Drawer Toggle */}
      <button
        class={`ve-dock-item ${state.isDrawerOpen ? 've-active' : ''}`}
        style={{ position: 'relative' }}
        onClick={() => state.setDrawerOpen(!state.isDrawerOpen)}
        title={`Review Changes (${totalCount})`}
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
