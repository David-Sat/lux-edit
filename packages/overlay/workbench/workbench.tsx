import './setup.js';
import { h, render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { OverlayStateManager } from '../src/inspector/state.js';
import '../src/index.js';
import { MockHostPage, WorkbenchBackdrop } from './mock-host.js';
import { PresetGroup, WORKBENCH_PRESETS, WorkbenchPreset } from './presets.js';

const PRESET_GROUPS: PresetGroup[] = [
  'Dock & Voice',
  'Toolbar & Selection',
  'Comments & Pins',
  'Variants & Verification',
  'Review Drawer',
];

function getInitialQueryParams(): {
  presetId: string;
  backdrop: WorkbenchBackdrop;
  showSidebar: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  const presetParam = params.get('preset');
  const backdropParam = params.get('backdrop');
  const chromeParam = params.get('chrome');

  const validPreset = WORKBENCH_PRESETS.some((p) => p.id === presetParam)
    ? (presetParam as string)
    : WORKBENCH_PRESETS[2].id; // Default to Dock Expanded (Batch Mode)

  const validBackdrop: WorkbenchBackdrop =
    backdropParam === 'light' || backdropParam === 'dark' || backdropParam === 'gradient'
      ? backdropParam
      : 'dark';

  return {
    presetId: validPreset,
    backdrop: validBackdrop,
    showSidebar: chromeParam !== '0',
  };
}

function WorkbenchApp() {
  const initial = useMemo(() => getInitialQueryParams(), []);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initial.presetId);
  const [backdrop, setBackdrop] = useState<WorkbenchBackdrop>(initial.backdrop);
  const [showSidebar, setShowSidebar] = useState<boolean>(initial.showSidebar);
  const [searchQuery, setSearchQuery] = useState('');
  const [hostEpoch, setHostEpoch] = useState(0);
  const [, setStateTick] = useState(0);

  const state = OverlayStateManager.getInstance();

  useEffect(() => {
    return state.subscribe(() => setStateTick((t) => t + 1));
  }, [state]);

  const activePreset: WorkbenchPreset = useMemo(
    () => WORKBENCH_PRESETS.find((p) => p.id === selectedPresetId) || WORKBENCH_PRESETS[0],
    [selectedPresetId]
  );

  // Sync URL query params for bookmarkable / shareable state views
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('preset', selectedPresetId);
      url.searchParams.set('backdrop', backdrop);
      url.searchParams.set('chrome', showSidebar ? '1' : '0');
      window.history.replaceState(null, '', url.toString());
    } catch {}
  }, [selectedPresetId, backdrop, showSidebar]);

  // Apply selected preset after MockHostPage renders fresh DOM
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        activePreset.apply(state, document);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activePreset, hostEpoch, state]);

  const selectPreset = (id: string) => {
    setSelectedPresetId(id);
    setHostEpoch((e) => e + 1);
  };

  const stepPreset = (delta: -1 | 1) => {
    const idx = WORKBENCH_PRESETS.findIndex((p) => p.id === selectedPresetId);
    const nextIdx = (idx + delta + WORKBENCH_PRESETS.length) % WORKBENCH_PRESETS.length;
    selectPreset(WORKBENCH_PRESETS[nextIdx].id);
  };

  // Keyboard shortcuts for fast preset stepping (`[` / `]`) & hiding workbench chrome (`Cmd/Ctrl+\`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setShowSidebar((v) => !v);
        return;
      }
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;

      if (e.key === '[') {
        e.preventDefault();
        stepPreset(-1);
      } else if (e.key === ']') {
        e.preventDefault();
        stepPreset(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPresetId]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return WORKBENCH_PRESETS;
    return WORKBENCH_PRESETS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const sidebarWidth = showSidebar ? 304 : 0;

  return (
    <div>
      <MockHostPage key={hostEpoch} backdrop={backdrop} sidebarOffsetPx={sidebarWidth} />

      {/* Workbench Chrome (explicitly ignored by OverlayRoot hit-testing via data-lux-workbench-ui) */}
      {!showSidebar ? (
        <button
          data-lux-workbench-ui
          onClick={() => setShowSidebar(true)}
          title="Show UX Workbench (Cmd/Ctrl+\)"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            zIndex: 2147483640,
            padding: '7px 12px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(12px)',
            color: '#f8fafc',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          Workbench ({activePreset.title})
        </button>
      ) : (
        <aside
          data-lux-workbench-ui
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '304px',
            zIndex: 2147483640,
            background: 'rgba(9, 13, 22, 0.94)',
            backdropFilter: 'blur(16px)',
            borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            fontSize: '12px',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 14px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>LUX UX Workbench</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {WORKBENCH_PRESETS.length} presets • Shadow DOM live
              </div>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              title="Hide sidebar (Cmd/Ctrl+\)"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Hide
            </button>
          </div>

          {/* Environment Controls */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>Backdrop</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['light', 'dark', 'gradient'] as WorkbenchBackdrop[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBackdrop(b)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border:
                        backdrop === b
                          ? '1px solid rgba(56, 189, 248, 0.6)'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                      background: backdrop === b ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                      color: backdrop === b ? '#38bdf8' : '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>Dock</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() =>
                    state.setDockPosition({
                      ...state.dockPosition,
                      side: state.dockPosition.side === 'right' ? 'left' : 'right',
                    })
                  }
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Side: {state.dockPosition.side}
                </button>
                <button
                  onClick={() =>
                    state.setDockPosition({
                      ...state.dockPosition,
                      verticalAnchor: state.dockPosition.verticalAnchor === 'bottom' ? 'top' : 'bottom',
                    })
                  }
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Anchor: {state.dockPosition.verticalAnchor}
                </button>
              </div>
            </div>

            {/* Stepper + Search */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="search"
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                placeholder="Filter states..."
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => stepPreset(-1)}
                title="Previous preset ([)"
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                ←
              </button>
              <button
                onClick={() => stepPreset(1)}
                title="Next preset (])"
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                →
              </button>
              <button
                onClick={() => setHostEpoch((e) => e + 1)}
                title="Re-apply current preset"
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                ↻
              </button>
            </div>
          </div>

          {/* Preset List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 16px' }}>
            {PRESET_GROUPS.map((group) => {
              const items = filteredPresets.filter((p) => p.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#64748b',
                      padding: '4px 6px',
                    }}
                  >
                    {group}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {items.map((preset) => {
                      const isActive = preset.id === activePreset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => selectPreset(preset.id)}
                          style={{
                            textAlign: 'left',
                            padding: '7px 8px',
                            borderRadius: '7px',
                            border: isActive
                              ? '1px solid rgba(56, 189, 248, 0.5)'
                              : '1px solid transparent',
                            background: isActive ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
                            color: isActive ? '#f8fafc' : '#cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: isActive ? 600 : 500, fontSize: '12px' }}>
                            {preset.title}
                          </div>
                          {isActive && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', lineHeight: 1.35 }}>
                              {preset.description}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live State Summary Footer */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0, 0, 0, 0.25)',
              fontSize: '11px',
              color: '#94a3b8',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span>Tool: <strong style={{ color: '#e2e8f0' }}>{state.activeTool}</strong></span>
            <span>Mode: <strong style={{ color: '#e2e8f0' }}>{state.reviewMode}</strong></span>
            <span>Edits: <strong style={{ color: '#e2e8f0' }}>{state.mutations.length}</strong></span>
            <span>Pins: <strong style={{ color: '#e2e8f0' }}>{state.annotations.length}</strong></span>
          </div>
        </aside>
      )}
    </div>
  );
}

const mountEl = document.getElementById('workbench-app');
if (mountEl) {
  render(<WorkbenchApp />, mountEl);
}
