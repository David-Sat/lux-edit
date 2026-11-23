import './setup.js';
import { h, render } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import {
  GlassMaterialMode,
  LIQUID_GLASS_RECIPES,
  LiquidGlassRecipeId,
  LiquidGlassTuning,
  supportsSvgBackdropFilter,
} from '../src/inspector/liquid-glass.js';
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

const GLASS_MODE_OPTIONS: Array<{ id: GlassMaterialMode; label: string }> = [
  { id: 'svg-refract', label: 'SVG Refract' },
  { id: 'css-liquid', label: 'CSS Fallback' },
];

const RECIPE_IDS: LiquidGlassRecipeId[] = ['apple-clear', 'crystal-drop', 'dark-obsidian'];

interface TuningSliderDef {
  key: keyof Omit<LiquidGlassTuning, 'pointerGlint' | 'surfaceTone' | 'refractPanels'>;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const TUNING_SLIDERS: TuningSliderDef[] = [
  { key: 'refractionStrength', label: 'Refraction', min: 0, max: 3.0, step: 0.05 },
  { key: 'thickness', label: 'Thickness', min: 10, max: 80, step: 1, unit: 'px' },
  { key: 'bezelWidth', label: 'Bezel', min: 6, max: 32, step: 1, unit: 'px' },
  { key: 'heroBlurPx', label: 'Lens Blur', min: 0, max: 12, step: 0.5, unit: 'px' },
  { key: 'panelBlurPx', label: 'Panel Blur', min: 0, max: 28, step: 1, unit: 'px' },
  { key: 'specularOpacity', label: 'Specular', min: 0, max: 1, step: 0.05 },
  { key: 'rimSaturation', label: 'Rim Chroma', min: 1, max: 8, step: 0.25 },
  { key: 'dispersion', label: 'Dispersion', min: 0, max: 1, step: 0.05 },
  { key: 'tintOpacity', label: 'Tint', min: 0.05, max: 0.85, step: 0.02 },
];

function isRecipeActive(current: LiquidGlassTuning, target: LiquidGlassTuning): boolean {
  return (
    current.surfaceTone === target.surfaceTone &&
    current.refractPanels === target.refractPanels &&
    Math.abs(current.refractionStrength - target.refractionStrength) < 0.005 &&
    Math.abs(current.thickness - target.thickness) < 0.05 &&
    Math.abs(current.bezelWidth - target.bezelWidth) < 0.05 &&
    Math.abs(current.heroBlurPx - target.heroBlurPx) < 0.05 &&
    Math.abs(current.panelBlurPx - target.panelBlurPx) < 0.05 &&
    Math.abs(current.specularOpacity - target.specularOpacity) < 0.005 &&
    Math.abs(current.rimSaturation - target.rimSaturation) < 0.05 &&
    Math.abs(current.dispersion - target.dispersion) < 0.005 &&
    Math.abs(current.tintOpacity - target.tintOpacity) < 0.005
  );
}

function getInitialQueryParams(): {
  presetId: string;
  backdrop: WorkbenchBackdrop;
  glassMode: GlassMaterialMode;
  showSidebar: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  const presetParam = params.get('preset');
  const backdropParam = params.get('backdrop');
  const glassParam = params.get('glass');
  const chromeParam = params.get('chrome');

  const validPreset = WORKBENCH_PRESETS.some((p) => p.id === presetParam)
    ? (presetParam as string)
    : WORKBENCH_PRESETS[2].id; // Default to Dock Expanded (Batch Mode)

  const validBackdrop: WorkbenchBackdrop =
    backdropParam === 'light' ||
    backdropParam === 'dark' ||
    backdropParam === 'gradient' ||
    backdropParam === 'editorial'
      ? backdropParam
      : 'dark';

  const validGlassMode: GlassMaterialMode =
    glassParam === 'css-liquid' || glassParam === 'svg-refract'
      ? glassParam
      : 'svg-refract';

  return {
    presetId: validPreset,
    backdrop: validBackdrop,
    glassMode: validGlassMode,
    showSidebar: chromeParam !== '0',
  };
}

function WorkbenchApp() {
  const initial = useMemo(() => getInitialQueryParams(), []);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initial.presetId);
  const [backdrop, setBackdrop] = useState<WorkbenchBackdrop>(initial.backdrop);
  const [glassMode, setGlassMode] = useState<GlassMaterialMode>(initial.glassMode);
  const [showTuning, setShowTuning] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [showSidebar, setShowSidebar] = useState<boolean>(initial.showSidebar);
  const [searchQuery, setSearchQuery] = useState('');
  const [hostEpoch, setHostEpoch] = useState(0);
  const [, setStateTick] = useState(0);

  const state = OverlayStateManager.getInstance();
  const svgSupported = useMemo(() => supportsSvgBackdropFilter(), []);

  useEffect(() => {
    return state.subscribe(() => setStateTick((t) => t + 1));
  }, [state]);

  useEffect(() => {
    state.setGlassMode(glassMode);
  }, [state, glassMode]);

  // Lightweight rAF FPS sampler for testing drag/refraction performance
  useEffect(() => {
    let rafId = 0;
    let frameCount = 0;
    let lastSample = performance.now();

    const tick = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastSample;
      if (elapsed >= 400) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastSample = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

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
      url.searchParams.set('glass', glassMode);
      url.searchParams.set('chrome', showSidebar ? '1' : '0');
      window.history.replaceState(null, '', url.toString());
    } catch (err) {
      console.debug('[lux-workbench] Failed to sync preset query params:', err);
    }
  }, [selectedPresetId, backdrop, glassMode, showSidebar]);

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

  const selectPreset = useCallback((id: string) => {
    setSelectedPresetId(id);
    setHostEpoch((e) => e + 1);
  }, []);

  const stepPreset = useCallback(
    (delta: -1 | 1) => {
      const idx = WORKBENCH_PRESETS.findIndex((p) => p.id === selectedPresetId);
      const nextIdx = (idx + delta + WORKBENCH_PRESETS.length) % WORKBENCH_PRESETS.length;
      selectPreset(WORKBENCH_PRESETS[nextIdx].id);
    },
    [selectedPresetId, selectPreset]
  );

  const cycleGlassMode = useCallback(() => {
    setGlassMode((prev) => {
      const idx = GLASS_MODE_OPTIONS.findIndex((m) => m.id === prev);
      return GLASS_MODE_OPTIONS[(idx + 1) % GLASS_MODE_OPTIONS.length].id;
    });
  }, []);

  // Keyboard shortcuts for preset stepping (`[` / `]`), glass cycling (`G`), and hiding chrome (`Cmd/Ctrl+\`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setShowSidebar((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        cycleGlassMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepPreset, cycleGlassMode]);

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
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(['light', 'dark', 'gradient', 'editorial'] as WorkbenchBackdrop[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBackdrop(b)}
                    style={{
                      padding: '3px 7px',
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

            {/* Liquid Glass Lab (A/B Switcher + Live Tuning) */}
            <div
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 700 }}>
                  Liquid Glass Lab <span style={{ color: '#64748b', fontWeight: 500 }}>(G)</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'ui-monospace, monospace',
                      color: fps >= 50 ? '#6ee7b7' : '#fcd34d',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                    }}
                  >
                    {fps} fps
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background:
                        glassMode === 'svg-refract'
                          ? svgSupported
                            ? 'rgba(16, 185, 129, 0.16)'
                            : 'rgba(245, 158, 11, 0.18)'
                          : 'rgba(255, 255, 255, 0.06)',
                      color:
                        glassMode === 'svg-refract'
                          ? svgSupported
                            ? '#6ee7b7'
                            : '#fcd34d'
                          : '#94a3b8',
                      border:
                        glassMode === 'svg-refract'
                          ? svgSupported
                            ? '1px solid rgba(52, 211, 153, 0.35)'
                            : '1px solid rgba(251, 191, 36, 0.35)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {glassMode === 'svg-refract' && svgSupported ? 'SVG Active' : 'CSS Fallback'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '3px',
                  padding: '2px',
                  borderRadius: '7px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {GLASS_MODE_OPTIONS.map((opt) => {
                  const active = glassMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setGlassMode(opt.id)}
                      style={{
                        padding: '4px 4px',
                        borderRadius: '5px',
                        border: active ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid transparent',
                        background: active ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: active ? '#f8fafc' : '#94a3b8',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {RECIPE_IDS.map((recipeId) => {
                    const recipe = LIQUID_GLASS_RECIPES[recipeId];
                    const active = isRecipeActive(state.glassTuning, recipe.tuning);
                    return (
                      <button
                        key={recipeId}
                        onClick={() => state.setGlassTuning(recipe.tuning)}
                        style={{
                          flex: 1,
                          padding: '3px 4px',
                          borderRadius: '5px',
                          border: active
                            ? '1px solid rgba(56, 189, 248, 0.55)'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          background: active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                          color: active ? '#38bdf8' : '#cbd5e1',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {recipe.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setShowTuning((v) => !v)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: showTuning ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      color: '#e2e8f0',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {showTuning ? 'Tune ▴' : 'Tune ▾'}
                  </button>
                </div>

                {showTuning && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      paddingTop: '4px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {TUNING_SLIDERS.map((slider) => {
                      const val = state.glassTuning[slider.key];
                      return (
                        <label
                          key={slider.key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '64px 1fr 38px',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '10.5px',
                            color: '#cbd5e1',
                          }}
                        >
                          <span>{slider.label}</span>
                          <input
                            type="range"
                            min={slider.min}
                            max={slider.max}
                            step={slider.step}
                            value={val}
                            onInput={(e) => {
                              const next = parseFloat((e.target as HTMLInputElement).value);
                              if (!Number.isNaN(next)) {
                                state.setGlassTuning({ [slider.key]: next });
                              }
                            }}
                            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              textAlign: 'right',
                              fontFamily: 'ui-monospace, monospace',
                              color: '#38bdf8',
                              fontSize: '10px',
                            }}
                          >
                            {Number.isInteger(slider.step) ? val : val.toFixed(2)}
                            {slider.unit || ''}
                          </span>
                        </label>
                      );
                    })}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginTop: '2px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            color: '#cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={state.glassTuning.refractPanels}
                            onChange={(e) =>
                              state.setGlassTuning({
                                refractPanels: (e.target as HTMLInputElement).checked,
                              })
                            }
                            style={{ accentColor: '#38bdf8' }}
                          />
                          <span>Refract Panels</span>
                        </label>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            color: '#cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={state.glassTuning.pointerGlint}
                            onChange={(e) =>
                              state.setGlassTuning({
                                pointerGlint: (e.target as HTMLInputElement).checked,
                              })
                            }
                            style={{ accentColor: '#38bdf8' }}
                          />
                          <span>Glint</span>
                        </label>
                      </div>
                      <button
                        onClick={() => state.resetGlassTuning()}
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.14)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#cbd5e1',
                          fontSize: '10px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
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
