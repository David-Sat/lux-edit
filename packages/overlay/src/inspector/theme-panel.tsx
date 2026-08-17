import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

export function ThemePanel() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  if (!state.isThemePanelOpen) return null;

  const tokens = state.themeTokens;

  return (
    <div
      class="ve-theme-panel"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div class="ve-drawer-header">
        <div class="ve-drawer-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
          <span>App Theme & Design Tokens</span>
        </div>

        <button
          class="ve-mini-btn"
          style={{
            width: '24px',
            height: '24px',
            padding: '0',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => state.setThemePanelOpen(false)}
          title="Close (Esc)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="ve-drawer-body" style={{ padding: '16px', gap: '14px' }}>
        {/* Brand Colors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Brand Colors
          </span>

          <div class="ve-row">
            <span class="ve-label">Primary</span>
            <input
              type="color"
              style={{ width: '32px', height: '26px', border: 'none', background: 'none', cursor: 'pointer' }}
              value={tokens.primary}
              onChange={(e) => state.updateThemeToken('primary', (e.target as HTMLInputElement).value)}
            />
            <input
              class="ve-input"
              value={tokens.primary}
              onChange={(e) => state.updateThemeToken('primary', (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="ve-row">
            <span class="ve-label">Accent</span>
            <input
              type="color"
              style={{ width: '32px', height: '26px', border: 'none', background: 'none', cursor: 'pointer' }}
              value={tokens.accent}
              onChange={(e) => state.updateThemeToken('accent', (e.target as HTMLInputElement).value)}
            />
            <input
              class="ve-input"
              value={tokens.accent}
              onChange={(e) => state.updateThemeToken('accent', (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="ve-row">
            <span class="ve-label">Background</span>
            <input
              type="color"
              style={{ width: '32px', height: '26px', border: 'none', background: 'none', cursor: 'pointer' }}
              value={tokens.background}
              onChange={(e) => state.updateThemeToken('background', (e.target as HTMLInputElement).value)}
            />
            <input
              class="ve-input"
              value={tokens.background}
              onChange={(e) => state.updateThemeToken('background', (e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        {/* Global Corner Radius */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Corner Radius Scale
          </span>

          <div class="ve-row">
            <div class="ve-btn-group">
              {[
                { val: '0px', label: 'Sharp' },
                { val: '4px', label: 'Minimal' },
                { val: '8px', label: 'Standard' },
                { val: '16px', label: 'Large' },
                { val: '9999px', label: 'Pill' },
              ].map((r) => (
                <button
                  key={r.val}
                  class={`ve-mini-btn ${tokens.radius === r.val ? 've-active' : ''}`}
                  onClick={() => state.updateThemeToken('radius', r.val)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Typography Theme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Base Typography
          </span>

          <div class="ve-row">
            <span class="ve-label">Font Family</span>
            <input
              class="ve-input"
              value={tokens.fontFamily}
              onChange={(e) => state.updateThemeToken('fontFamily', (e.target as HTMLInputElement).value)}
              placeholder="e.g. Inter, system-ui, sans-serif"
            />
          </div>
        </div>
      </div>

      <div class="ve-drawer-footer" style={{ justifyContent: 'flex-end' }}>
        <button
          class="ve-btn primary"
          style={{ flex: 1, background: '#6366f1' }}
          onClick={() => state.setThemePanelOpen(false)}
        >
          Done
        </button>
      </div>
    </div>
  );
}
