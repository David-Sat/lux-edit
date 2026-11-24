// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import {
  DEFAULT_LIQUID_GLASS_TUNING,
  buildLiquidGlassFilterConfig,
  clearLiquidGlassMapCache,
  computeLiquidDragDeformation,
  computeLiquidRimAngle,
  computeRefractionProfile,
  computeSphericalLensProfile,
  createLiquidDragDeformer,
  generateLiquidGlassMaps,
  useLiquidGlassMotion,
} from '../inspector/liquid-glass.js';
import { LiquidGlassDefs } from '../inspector/liquid-glass-defs.js';
import { OverlayRoot } from '../overlay-root.js';
import { OverlayStateManager } from '../inspector/state.js';
import { LIQUID_GLASS_BASE_CSS } from '../inspector/styles/liquid-glass-base.css.js';
import { LIQUID_GLASS_COMPONENTS_CSS } from '../inspector/styles/liquid-glass-components.css.js';
import { LIQUID_GLASS_SVG_CSS } from '../inspector/styles/liquid-glass-svg.css.js';
import { LIQUID_GLASS_CSS } from '../inspector/styles/liquid-glass.css.js';

describe('liquid-glass refraction math & filter config', () => {
  beforeEach(() => {
    clearLiquidGlassMapCache();
  });

  it('computes a substantial monotonic Snell refraction profile for thick glass with zero center shift', () => {
    const { displacements, maxDisplacement } = computeRefractionProfile(64, 1.5, 24, 42);

    expect(displacements.length).toBe(64);
    expect(displacements[0]).toBeGreaterThan(25);
    expect(displacements[16]).toBeGreaterThan(5); // ~t = 0.25 visible bevel should refract substantially
    expect(displacements[displacements.length - 1]).toBe(0);
    expect(maxDisplacement).toBeGreaterThan(25);

    for (let i = 0; i < displacements.length - 1; i++) {
      expect(displacements[i]).toBeGreaterThanOrEqual(displacements[i + 1]);
    }
  });

  it('scales refraction displacement with index of refraction and thickness', () => {
    const lowIor = computeRefractionProfile(32, 1.2, 24, 42);
    const highIor = computeRefractionProfile(32, 1.8, 24, 42);
    expect(highIor.maxDisplacement).toBeGreaterThan(lowIor.maxDisplacement);

    const thin = computeRefractionProfile(32, 1.5, 24, 14);
    const thick = computeRefractionProfile(32, 1.5, 24, 52);
    expect(thick.maxDisplacement).toBeGreaterThan(thin.maxDisplacement);
  });

  it('builds dispersion channel scales, blur stdDeviation, rim saturation, and single-pass panel options correctly', () => {
    const mockMap = {
      width: 52,
      height: 52,
      radius: 26,
      displacementUrl: 'data:image/png;base64,abc',
      specularUrl: 'data:image/png;base64,def',
      causticMaskUrl: 'data:image/png;base64,ghi',
      maxDisplacement: 8,
    };

    const withDispersion = buildLiquidGlassFilterConfig(mockMap, {
      ...DEFAULT_LIQUID_GLASS_TUNING,
      refractionStrength: 1.25,
      dispersion: 0.5,
      heroBlurPx: 4,
      saturatePct: 210,
      rimSaturation: 5.0,
      specularOpacity: 0.75,
    });

    expect(withDispersion.scale).toBeCloseTo(20, 5);
    expect(withDispersion.useDispersion).toBe(true);
    expect(withDispersion.rScale).toBeGreaterThan(withDispersion.gScale);
    expect(withDispersion.gScale).toBeGreaterThan(withDispersion.bScale);
    expect(withDispersion.blurStdDev).toBeCloseTo(2.2, 5);
    expect(withDispersion.saturateRatio).toBeCloseTo(2.1, 5);
    expect(withDispersion.rimSaturation).toBeCloseTo(5.0, 5);
    expect(withDispersion.specularOpacity).toBeCloseTo(0.75, 5);

    const singlePassPanel = buildLiquidGlassFilterConfig(
      mockMap,
      {
        ...DEFAULT_LIQUID_GLASS_TUNING,
        dispersion: 0.6,
      },
      {
        blurOverridePx: 10,
        disableDispersion: true,
      }
    );

    expect(singlePassPanel.useDispersion).toBe(false);
    expect(singlePassPanel.blurStdDev).toBeCloseTo(5.5, 5);

    expect(DEFAULT_LIQUID_GLASS_TUNING.refractionStrength).toBeGreaterThan(1);
    expect(DEFAULT_LIQUID_GLASS_TUNING.thickness).toBeGreaterThanOrEqual(56);
    expect(DEFAULT_LIQUID_GLASS_TUNING.panelBlurPx).toBeLessThanOrEqual(12);

    const boosted = buildLiquidGlassFilterConfig(mockMap, DEFAULT_LIQUID_GLASS_TUNING, {
      blurOverridePx: 1.5,
      scaleMultiplier: 1.45,
      rimSaturationMultiplier: 1.25,
    });
    expect(boosted.scale).toBeCloseTo(
      8 * 2 * DEFAULT_LIQUID_GLASS_TUNING.refractionStrength * 1.45,
      5
    );
    expect(boosted.rimSaturation).toBeCloseTo(
      DEFAULT_LIQUID_GLASS_TUNING.rimSaturation * 1.25,
      5
    );
    expect(boosted.blurStdDev).toBeCloseTo(1.5 * 0.55, 5);

    const nanGuarded = buildLiquidGlassFilterConfig(mockMap, DEFAULT_LIQUID_GLASS_TUNING, {
      scaleMultiplier: Number.NaN,
      rimSaturationMultiplier: Number.NaN,
      specularOpacityMultiplier: Number.NaN,
    });
    expect(Number.isFinite(nanGuarded.scale)).toBe(true);
    expect(Number.isFinite(nanGuarded.rimSaturation)).toBe(true);
    expect(Number.isFinite(nanGuarded.specularOpacity)).toBe(true);

    const attenuatedSpecular = buildLiquidGlassFilterConfig(
      mockMap,
      { ...DEFAULT_LIQUID_GLASS_TUNING, specularOpacity: 0.8 },
      { specularOpacityMultiplier: 0.28 }
    );
    expect(attenuatedSpecular.specularOpacity).toBeCloseTo(0.8 * 0.28, 5);
    expect(attenuatedSpecular.useCausticRim).toBe(true);

    const lensFilterCfg = buildLiquidGlassFilterConfig(
      mockMap,
      { ...DEFAULT_LIQUID_GLASS_TUNING, specularOpacity: 0.8 },
      { specularOpacityMultiplier: 0, disableCausticRim: true }
    );
    expect(lensFilterCfg.useCausticRim).toBe(false);
    expect(lensFilterCfg.specularOpacity).toBe(0);
  });

  it('computes a smooth spherical magnifying lens profile with zero inversion and monotonic bend', () => {
    const { displacements, maxDisplacement } = computeSphericalLensProfile(64, 1.55, 15, 58);

    expect(displacements.length).toBe(64);
    expect(displacements[0]).toBe(0);
    expect(displacements[32]).toBeGreaterThan(0);
    expect(maxDisplacement).toBeGreaterThan(0);
    expect(maxDisplacement).toBeLessThan(15);

    for (let i = 0; i < displacements.length - 1; i++) {
      expect(displacements[i + 1]).toBeGreaterThanOrEqual(displacements[i]);
    }

    const higherIor = computeSphericalLensProfile(64, 1.8, 15, 58);
    expect(higherIor.maxDisplacement).toBeGreaterThan(maxDisplacement);
  });

  it('returns null gracefully when 2D canvas context is unavailable', () => {
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);

    const result = generateLiquidGlassMaps({
      width: 52,
      height: 52,
      radius: 26,
      tuning: DEFAULT_LIQUID_GLASS_TUNING,
    });

    expect(result).toBeNull();
    getContextSpy.mockRestore();
  });
});

describe('OverlayStateManager liquid glass state', () => {
  beforeEach(() => {
    OverlayStateManager.resetInstance();
    OverlayStateManager.setWorkbenchMode(true);
  });

  afterEach(() => {
    OverlayStateManager.resetInstance();
    OverlayStateManager.setWorkbenchMode(false);
  });

  it('defaults to svg-refract mode, notifies subscribers on changes, and preserves glass settings across resetForWorkbench', () => {
    const state = OverlayStateManager.getInstance();
    const listener = vi.fn();
    const unsub = state.subscribe(listener);

    expect(state.glassMode).toBe('svg-refract');
    expect(state.glassTuning).toEqual(DEFAULT_LIQUID_GLASS_TUNING);
    expect(state.glassTuning.tintOpacity).toBe(0.35);

    state.setGlassMode('css-liquid');
    expect(state.glassMode).toBe('css-liquid');
    expect(listener).toHaveBeenCalledTimes(1);

    state.setGlassTuning({ tintOpacity: 0.2, surfaceTone: 'dark' });
    expect(state.glassTuning.tintOpacity).toBe(0.2);
    expect(state.glassTuning.surfaceTone).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(2);

    state.resetForWorkbench();
    expect(state.glassMode).toBe('css-liquid');
    expect(state.glassTuning.tintOpacity).toBe(0.2);
    expect(state.glassTuning.surfaceTone).toBe('dark');

    state.resetGlassTuning();
    expect(state.glassTuning).toEqual(DEFAULT_LIQUID_GLASS_TUNING);
    unsub();
  });

  it('uses opacity-free entrance animations and complete liquid motion keyframes with reduced-motion fallback', () => {
    const entranceKeyframes = [
      'veLiquidDockMorph',
      'veLiquidOrbSettle',
      'veLiquidJellySettle',
      'veLiquidSlideUp',
      'veLiquidSlideDown',
      'veLiquidPopIn',
      'veLiquidPinDrop',
      'veLiquidTooltipBloom',
      'veLiquidGlide',
    ];

    for (const name of entranceKeyframes) {
      const match = LIQUID_GLASS_CSS.match(
        new RegExp(`@keyframes\\s+${name}\\s*\\{[\\s\\S]*?\\n\\}`)
      )?.[0];
      expect(match, `expected @keyframes ${name}`).toBeDefined();
      expect(match, `@keyframes ${name} must not animate opacity`).not.toMatch(/opacity/i);
    }

    expect(LIQUID_GLASS_CSS).toContain('--ve-ease-liquid: cubic-bezier(0.2, 0.9, 0.25, 1)');
    expect(LIQUID_GLASS_CSS).toContain('.ve-root.ve-glass-liquid .ve-dock-focus-pill');
    expect(LIQUID_GLASS_CSS).toContain('.ve-root.ve-glass-liquid .ve-dock-focus-pill::before');
    expect(LIQUID_GLASS_CSS).toContain('url(#lux-glass-focus)');
    const ringRule =
      LIQUID_GLASS_CSS.match(
        /\/\* Opposing Double-Arc Pure White Fresnel Specular Rim[\s\S]*?\}/
      )?.[0] ?? '';
    expect(ringRule).not.toBe('');
    expect(ringRule).not.toContain('.ve-pin::before');
    expect(LIQUID_GLASS_CSS).toMatch(/\.ve-root\.ve-glass-liquid\s+\.ve-pin::before\s*\{[^}]*radial-gradient/);
    const pinRule =
      LIQUID_GLASS_CSS.match(
        /\.ve-root\.ve-glass-liquid \.ve-pin,\s*\.ve-root\.ve-glass-liquid \.ve-pin\.ve-pin-multi\s*\{[\s\S]*?\}/
      )?.[0] ?? '';
    expect(pinRule).not.toBe('');
    expect(pinRule).not.toMatch(/\binset\s+0\b/);
    const pinSurfaceRule =
      LIQUID_GLASS_CSS.match(
        /\.ve-root\.ve-glass-liquid \.ve-pin > \.ve-glass-surface\s*\{[\s\S]*?\}/
      )?.[0] ?? '';
    expect(pinSurfaceRule).not.toBe('');
    expect(pinSurfaceRule).not.toContain('radial-gradient');
    expect(LIQUID_GLASS_CSS).toContain('@keyframes veLiquidTapGlow');
    expect(LIQUID_GLASS_CSS).toContain('@keyframes veLiquidSheenSweep');
    expect(LIQUID_GLASS_CSS).toContain('var(--ve-rim-angle, 135deg)');
    expect(LIQUID_GLASS_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(LIQUID_GLASS_CSS).toContain('.ve-root.ve-glass-liquid .ve-drawer');
    expect(LIQUID_GLASS_CSS).toContain('.ve-root.ve-glass-liquid .ve-dock-menu');
    expect(LIQUID_GLASS_CSS).toContain('.ve-root.ve-glass-liquid .ve-voice-recording-dock');
    expect(LIQUID_GLASS_CSS).toContain('.ve-root.ve-glass-liquid .ve-comment-popover');
    expect(LIQUID_GLASS_CSS).toMatch(/animation:\s*veLiquidSlideUp\b/);
    expect(LIQUID_GLASS_CSS).toMatch(/animation:\s*veLiquidPopIn\b/);
  });

  it('computes volume-conserving drag jelly deformation and cursor-tracked Fresnel rim angle', () => {
    expect(computeLiquidDragDeformation(0.2, -0.1)).toEqual({
      scaleX: 1,
      scaleY: 1,
      rotateDeg: 0,
    });

    const horiz = computeLiquidDragDeformation(24, 0);
    expect(horiz.scaleX).toBeGreaterThan(1);
    expect(horiz.scaleY).toBeLessThan(1);
    expect(horiz.scaleX * horiz.scaleY).toBeCloseTo(1, 2);
    expect(horiz.scaleX).toBeLessThanOrEqual(1.04);
    expect(horiz.scaleY).toBeGreaterThanOrEqual(0.96);
    expect(horiz.rotateDeg).toBeGreaterThan(0);
    expect(horiz.rotateDeg).toBeLessThanOrEqual(1.5);

    const vert = computeLiquidDragDeformation(0, -30);
    expect(vert.scaleY).toBeGreaterThan(1);
    expect(vert.scaleX).toBeLessThan(1);
    expect(vert.scaleX * vert.scaleY).toBeCloseTo(1, 2);
    expect(vert.rotateDeg).toBeLessThanOrEqual(1.5);
    expect(vert.rotateDeg).toBeGreaterThanOrEqual(-1.5);

    expect(computeLiquidRimAngle(50, 50)).toBeCloseTo(135, 1);
    const shifted = computeLiquidRimAngle(100, 0);
    expect(shifted).toBeGreaterThanOrEqual(107);
    expect(shifted).toBeLessThanOrEqual(163);
    expect(shifted).not.toBe(135);
    const opposite = computeLiquidRimAngle(0, 100);
    expect(opposite).toBeGreaterThanOrEqual(107);
    expect(opposite).toBeLessThan(135);
  });

  it('createLiquidDragDeformer applies CSS custom properties on push and clears them on clear', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const deformer = createLiquidDragDeformer(el);

    deformer.push(28, 0);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(el.style.getPropertyValue('--ve-drag-sx')).not.toBe('');
    expect(el.style.getPropertyValue('--ve-drag-sy')).not.toBe('');
    expect(el.style.getPropertyValue('--ve-drag-rot')).not.toBe('');

    deformer.clear();
    expect(el.style.getPropertyValue('--ve-drag-sx')).toBe('');
    expect(el.style.getPropertyValue('--ve-drag-sy')).toBe('');
    expect(el.style.getPropertyValue('--ve-drag-rot')).toBe('');
  });
});

describe('liquid-glass performance optimizations', () => {
  let hostEl: HTMLElement | null = null;
  let shadowRoot: ShadowRoot | null = null;

  beforeEach(() => {
    clearLiquidGlassMapCache();
    document.body.innerHTML = '';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      return {
        createImageData: (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      () => 'data:image/png;base64,MOCKPNG'
    );
  });

  afterEach(async () => {
    if (shadowRoot) {
      const root = shadowRoot;
      await act(() => {
        render(null, root);
      });
      shadowRoot = null;
    }
    if (hostEl) {
      hostEl.remove();
      hostEl = null;
    }
    clearLiquidGlassMapCache();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('skips specular & caustic canvases for spherical lens maps and caches separately from bezel maps', () => {
    const createElSpy = vi.spyOn(document, 'createElement');

    const lensResult = generateLiquidGlassMaps({
      width: 30,
      height: 30,
      radius: 15,
      shapeProfile: 'lens',
      tuning: DEFAULT_LIQUID_GLASS_TUNING,
      exact: true,
    });

    const lensCanvasCalls = createElSpy.mock.calls.filter(([tag]) => tag === 'canvas').length;
    expect(lensCanvasCalls).toBe(1);
    expect(lensResult).not.toBeNull();
    expect(lensResult!.displacementUrl).toBe('data:image/png;base64,MOCKPNG');
    expect(lensResult!.specularUrl).toBe('');
    expect(lensResult!.causticMaskUrl).toBe('');

    createElSpy.mockClear();

    const bezelResult = generateLiquidGlassMaps({
      width: 30,
      height: 30,
      radius: 15,
      shapeProfile: 'bezel',
      tuning: DEFAULT_LIQUID_GLASS_TUNING,
      exact: true,
    });

    const bezelCanvasCalls = createElSpy.mock.calls.filter(([tag]) => tag === 'canvas').length;
    expect(bezelCanvasCalls).toBe(3);
    expect(bezelResult).not.toBeNull();
    expect(bezelResult!.specularUrl).toBe('data:image/png;base64,MOCKPNG');
    expect(bezelResult!.causticMaskUrl).toBe('data:image/png;base64,MOCKPNG');
  });

  it('LiquidGlassDefs only mounts active surface filters synchronously, disables pin dispersion, and warms others on idle', async () => {
    const idleCallbacks: Array<() => void> = [];
    const origRequestIdle = (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    const origCancelIdle = (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback;

    Object.defineProperty(window, 'requestIdleCallback', {
      value: (cb: IdleRequestCallback) => {
        idleCallbacks.push(() => cb({ didTimeout: false, timeRemaining: () => 50 }));
        return idleCallbacks.length;
      },
      configurable: true,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      value: () => {},
      configurable: true,
    });

    try {
      hostEl = document.createElement('div');
      shadowRoot = hostEl.attachShadow({ mode: 'open' });
      document.body.appendChild(hostEl);

      await act(() => {
        render(
          h(LiquidGlassDefs, {
            shadowRoot: shadowRoot!,
            tuning: DEFAULT_LIQUID_GLASS_TUNING,
            enabled: true,
            activeSurfaces: {
              launcher: true,
              dock: false,
              pins: false,
              voicePins: false,
              drawer: false,
              toolbar: false,
              composer: false,
              switcher: false,
            },
          }),
          shadowRoot!
        );
      });

      const initialFilters = Array.from(shadowRoot!.querySelectorAll('filter')).map((f) => f.id);
      expect(initialFilters).toEqual(['lux-glass-launcher']);

      // Activating comment pins immediately mounts #lux-glass-pin with 4 primitives (single-pass displacement)
      await act(() => {
        render(
          h(LiquidGlassDefs, {
            shadowRoot: shadowRoot!,
            tuning: DEFAULT_LIQUID_GLASS_TUNING,
            enabled: true,
            activeSurfaces: {
              launcher: true,
              dock: false,
              pins: true,
              voicePins: false,
              drawer: false,
              toolbar: false,
              composer: false,
              switcher: false,
            },
          }),
          shadowRoot!
        );
      });

      const pinFilter = shadowRoot!.querySelector('#lux-glass-pin');
      expect(pinFilter).not.toBeNull();
      expect(pinFilter!.querySelectorAll('feDisplacementMap').length).toBe(1);
      expect(pinFilter!.querySelectorAll('feImage[result="causticMask"]').length).toBe(0);
      expect(pinFilter!.querySelectorAll('feImage[result="specRaw"]').length).toBe(0);
      expect(pinFilter!.children.length).toBe(4);

      // Flush progressive idle warming stages and verify deferred panels warm without blocking mount
      for (let step = 0; step < 6; step += 1) {
        const nextCb = idleCallbacks.shift();
        if (!nextCb) break;
        await act(() => {
          nextCb();
        });
      }

      const warmedIds = Array.from(shadowRoot!.querySelectorAll('filter')).map((f) => f.id);
      expect(warmedIds).toContain('lux-glass-dock');
      expect(warmedIds).toContain('lux-glass-toolbar');
      expect(warmedIds).toContain('lux-glass-drawer');
    } finally {
      Object.defineProperty(window, 'requestIdleCallback', {
        value: origRequestIdle,
        configurable: true,
      });
      Object.defineProperty(window, 'cancelIdleCallback', {
        value: origCancelIdle,
        configurable: true,
      });
    }
  });

  it('useLiquidGlassMotion defers getBoundingClientRect into rAF and triggers pointerdown pulse without OverlayRoot re-renders', async () => {
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    hostEl = document.createElement('div');
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    document.body.appendChild(hostEl);

    function MotionHarness() {
      useLiquidGlassMotion(shadowRoot, true);
      return h('button', { type: 'button', class: 've-launcher-btn' }, 'Open');
    }

    await act(() => {
      render(h(MotionHarness, {}), shadowRoot!);
    });

    const btn = shadowRoot!.querySelector('.ve-launcher-btn') as HTMLElement;
    const rectSpy = vi.fn(
      () => ({ left: 100, top: 100, width: 52, height: 52, right: 152, bottom: 152, x: 100, y: 100, toJSON: () => {} } as DOMRect)
    );
    btn.getBoundingClientRect = rectSpy;

    // 4 rapid pointermove events before the animation frame should not call getBoundingClientRect
    for (let i = 0; i < 4; i += 1) {
      btn.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 110 + i * 5, clientY: 120 })
      );
    }
    expect(rectSpy).not.toHaveBeenCalled();
    expect(rafQueue.length).toBe(1);

    // Flushing rAF executes 1 layout read and updates glint coordinates from the latest pointer position
    rafQueue.shift()!(16);
    expect(rectSpy).toHaveBeenCalledTimes(1);
    expect(btn.dataset.veGlint).toBe('true');
    expect(btn.style.getPropertyValue('--ve-gx')).toBe('48.1%');

    // OverlayRoot does not schedule rAF filter-pulse loops or re-render on pointerdown even in SVG Refract mode
    const origChrome = (window as unknown as { chrome?: unknown }).chrome;
    const origCssSupports = typeof CSS !== 'undefined' ? CSS.supports : undefined;
    Object.defineProperty(window, 'chrome', { value: {}, configurable: true });
    if (typeof CSS !== 'undefined') {
      CSS.supports = () => true;
    }

    try {
      await act(() => {
        render(null, shadowRoot!);
      });
      OverlayStateManager.resetInstance();
      OverlayStateManager.setWorkbenchMode(true);
      let rootCommits = 0;
      function OverlayRenderProbe() {
        rootCommits += 1;
        return h(OverlayRoot, { shadowRoot: shadowRoot! });
      }
      await act(() => {
        render(h(OverlayRenderProbe, {}), shadowRoot!);
      });
      const baselineCommits = rootCommits;
      rafQueue.length = 0;

      const liveLauncher = shadowRoot!.querySelector('.ve-launcher-btn') as HTMLElement;
      expect(liveLauncher).not.toBeNull();
      liveLauncher.getBoundingClientRect = rectSpy;

      await act(() => {
        liveLauncher.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, clientX: 126, clientY: 126 })
        );
      });

      expect(liveLauncher.dataset.vePulse).toBe('true');
      expect(rootCommits).toBe(baselineCommits);
      expect(rafQueue.length).toBe(0);
    } finally {
      Object.defineProperty(window, 'chrome', { value: origChrome, configurable: true });
      if (typeof CSS !== 'undefined' && origCssSupports) {
        CSS.supports = origCssSupports;
      }
      OverlayStateManager.resetInstance();
      OverlayStateManager.setWorkbenchMode(false);
    }
  });

  it('SVG optical backdrop-filter rules are at least as specific as earlier fallback blur rules for every surface', () => {
    interface BackdropRule {
      selector: string;
      specificity: number;
      backdropFilter: string;
    }

    const extractBackdropRules = (css: string): BackdropRule[] => {
      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const result: BackdropRule[] = [];
      for (const match of stripped.matchAll(/([^{}\n;][^{};]*?)\{([^{}]*backdrop-filter\s*:[^}]*)\}/g)) {
        const rawSelectors = match[1].trim();
        if (rawSelectors.startsWith('@')) continue;
        const propMatch = match[2].match(/backdrop-filter:\s*([^;]+)/);
        if (!propMatch) continue;
        const backdropFilter = propMatch[1].trim().replace(/\s+/g, ' ');
        for (const s of rawSelectors.split(',')) {
          const selector = s.trim().replace(/\s+/g, ' ');
          const clean = selector.replace(/:not\([^)]*\)/g, '');
          const specificity = (clean.match(/(\.[a-zA-Z0-9_-]+|\[[^\]]+\]|:[a-zA-Z-]+)/g) || []).length;
          result.push({ selector, specificity, backdropFilter });
        }
      }
      return result;
    };

    const earlierRules = [
      ...extractBackdropRules(LIQUID_GLASS_BASE_CSS),
      ...extractBackdropRules(LIQUID_GLASS_COMPONENTS_CSS),
    ];
    const svgRules = extractBackdropRules(LIQUID_GLASS_SVG_CSS);

    const targets: Array<{ suffix: string; filterId: string }> = [
      { suffix: '.ve-launcher-btn > .ve-glass-surface', filterId: 'lux-glass-launcher' },
      { suffix: '.ve-dock-menu > .ve-glass-surface', filterId: 'lux-glass-dock' },
      { suffix: '.ve-pin > .ve-glass-surface', filterId: 'lux-glass-pin' },
      { suffix: '.ve-voice-pin > .ve-glass-surface', filterId: 'lux-glass-voice-pin' },
      { suffix: '.ve-drawer > .ve-glass-surface', filterId: 'lux-glass-drawer' },
      { suffix: '.ve-toolbar > .ve-glass-surface', filterId: 'lux-glass-toolbar' },
      { suffix: '.ve-comment-popover > .ve-glass-surface', filterId: 'lux-glass-composer' },
      { suffix: '.ve-variant-switcher-bar > .ve-glass-surface', filterId: 'lux-glass-switcher' },
      { suffix: '.ve-pin-tooltip > .ve-glass-surface', filterId: 'lux-glass-tooltip' },
      { suffix: '.ve-voice-pin-tooltip > .ve-glass-surface', filterId: 'lux-glass-tooltip' },
      { suffix: '.ve-dock-focus-pill', filterId: 'lux-glass-focus' },
      { suffix: '.ve-dock-item.ve-active', filterId: 'lux-glass-bubble' },
      { suffix: '.ve-mode-pill.ve-active', filterId: 'lux-glass-pill-active' },
      { suffix: '.ve-tab-indicator', filterId: 'lux-glass-tab-pill' },
    ];

    for (const { suffix, filterId } of targets) {
      const matchingSvg = svgRules.filter(
        (r) => r.selector.endsWith(suffix) && r.backdropFilter.includes(`url(#${filterId})`)
      );
      expect(matchingSvg.length, `expected SVG backdrop-filter rule for ${suffix}`).toBeGreaterThan(0);

      const minSvgSpec = Math.min(...matchingSvg.map((r) => r.specificity));
      const matchingEarlier = earlierRules.filter((r) => r.selector.endsWith(suffix));
      const maxEarlierSpec = matchingEarlier.reduce((acc, r) => Math.max(acc, r.specificity), 0);

      expect(
        minSvgSpec,
        `${suffix} SVG rule specificity (${minSvgSpec}) must be >= fallback blur specificity (${maxEarlierSpec})`
      ).toBeGreaterThanOrEqual(maxEarlierSpec);
    }
  });
});
