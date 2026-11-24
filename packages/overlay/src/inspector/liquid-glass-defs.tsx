import { Fragment, h } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_LIQUID_GLASS_TUNING,
  LiquidGlassFilterConfigOptions,
  LiquidGlassMapRequest,
  LiquidGlassMapResult,
  LiquidGlassTuning,
  buildLiquidGlassFilterConfig,
  generateLiquidGlassMaps,
  prefersReducedMotion,
} from './liquid-glass.js';

export interface ActiveGlassSurfaces {
  launcher: boolean;
  dock: boolean;
  pins: boolean;
  voicePins: boolean;
  drawer: boolean;
  toolbar: boolean;
  composer: boolean;
  switcher: boolean;
}

const SURFACE_KEYS = [
  'launcher',
  'dock',
  'pins',
  'voicePins',
  'drawer',
  'toolbar',
  'composer',
  'switcher',
] as const;

const DEFAULT_ACTIVE_SURFACES: ActiveGlassSurfaces = {
  launcher: true,
  dock: false,
  pins: false,
  voicePins: false,
  drawer: false,
  toolbar: false,
  composer: false,
  switcher: false,
};

/**
 * Shared decoupled Liquid Glass layers nested inside overlay panels, pills, and pins.
 */
export function GlassChrome() {
  return (
    <Fragment>
      <span class="ve-glass-surface" aria-hidden="true" />
      <span class="ve-glass-bevel" aria-hidden="true" />
    </Fragment>
  );
}

interface LiquidGlassDefsProps {
  shadowRoot: ShadowRoot;
  tuning: LiquidGlassTuning;
  enabled: boolean;
  activeBoost?: boolean;
  activeSurfaces?: ActiveGlassSurfaces;
}

interface Size2D {
  width: number;
  height: number;
}

type ObservedSurfaceKey = 'dock' | 'drawer' | 'toolbar' | 'composer' | 'switcher' | 'tooltip';
type SurfaceSizes = Record<ObservedSurfaceKey, Size2D>;

const INITIAL_SURFACE_SIZES: SurfaceSizes = {
  dock: { width: 328, height: 52 },
  drawer: { width: 416, height: 528 },
  toolbar: { width: 344, height: 288 },
  composer: { width: 360, height: 192 },
  switcher: { width: 472, height: 112 },
  tooltip: { width: 280, height: 112 },
};

const OBSERVED_SURFACE_SPECS: Array<{
  key: ObservedSurfaceKey;
  selector: string;
  exact?: boolean;
  requiresPanelRefract?: boolean;
}> = [
  { key: 'dock', selector: '.ve-dock-menu', exact: true },
  { key: 'drawer', selector: '.ve-drawer', requiresPanelRefract: true },
  { key: 'toolbar', selector: '.ve-toolbar', requiresPanelRefract: true },
  { key: 'composer', selector: '.ve-comment-popover', requiresPanelRefract: true },
  { key: 'switcher', selector: '.ve-variant-switcher-bar', requiresPanelRefract: true },
  { key: 'tooltip', selector: '.ve-pin-tooltip, .ve-voice-pin-tooltip', requiresPanelRefract: true },
];

const DOCK_BOOST_DURATION_MS = 220;

interface FilterBuildContext {
  tuning: LiquidGlassTuning;
  mapTuning: LiquidGlassTuning;
  panelMapTuning: LiquidGlassTuning;
  sizes: SurfaceSizes;
  initialBoostScale: number;
  panelFilterOptions: LiquidGlassFilterConfigOptions;
  isSurfaceActive: (key: keyof ActiveGlassSurfaces, minWarmStage: number) => boolean;
}

interface GlassFilterSpec {
  id: string;
  isNeeded: (ctx: FilterBuildContext) => boolean;
  buildRequest: (ctx: FilterBuildContext) => LiquidGlassMapRequest;
  buildFilterOptions: (ctx: FilterBuildContext) => LiquidGlassFilterConfigOptions;
  stretchToBounds?: boolean;
}

function hasButtonSurfaces(ctx: FilterBuildContext): boolean {
  return (
    ctx.isSurfaceActive('drawer', 2) ||
    ctx.isSurfaceActive('toolbar', 2) ||
    ctx.isSurfaceActive('composer', 2) ||
    ctx.isSurfaceActive('switcher', 2) ||
    ctx.isSurfaceActive('pins', 2) ||
    ctx.isSurfaceActive('voicePins', 2) ||
    ctx.isSurfaceActive('dock', 2)
  );
}

const GLASS_FILTER_SPECS: GlassFilterSpec[] = [
  {
    id: 'lux-glass-launcher',
    isNeeded: (ctx) => ctx.isSurfaceActive('launcher', 1),
    buildRequest: (ctx) => ({
      width: 52,
      height: 52,
      radius: 26,
      tuning: {
        ...ctx.mapTuning,
        bezelWidth: 25,
        thickness: Math.max(72, ctx.tuning.thickness * 1.45),
      },
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: Math.min(3.2, ctx.tuning.heroBlurPx * 0.72),
      scaleMultiplier: 1.85,
      rimSaturationMultiplier: 1.35,
    }),
  },
  {
    id: 'lux-glass-dock',
    isNeeded: (ctx) => ctx.isSurfaceActive('dock', 1),
    buildRequest: (ctx) => ({
      width: ctx.sizes.dock.width,
      height: ctx.sizes.dock.height,
      radius: Math.round(ctx.sizes.dock.height / 2),
      tuning: ctx.mapTuning,
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: ctx.tuning.heroBlurPx * 1.35,
      scaleMultiplier: ctx.initialBoostScale,
    }),
  },
  {
    id: 'lux-glass-focus',
    isNeeded: (ctx) => ctx.isSurfaceActive('dock', 1),
    buildRequest: (ctx) => ({
      width: 52,
      height: 48,
      radius: 24,
      tuning: {
        ...ctx.mapTuning,
        ior: Math.max(1.58, ctx.tuning.ior + 0.08),
        bezelWidth: 22,
        thickness: Math.max(82, ctx.tuning.thickness * 1.65),
      },
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: Math.min(0.8, ctx.tuning.heroBlurPx * 0.22),
      scaleMultiplier: 2.35,
      rimSaturationMultiplier: 1.75,
    }),
  },
  {
    id: 'lux-glass-bubble',
    isNeeded: (ctx) => ctx.isSurfaceActive('dock', 1),
    buildRequest: (ctx) => ({
      width: 40,
      height: 40,
      radius: 20,
      tuning: {
        ...ctx.mapTuning,
        ior: Math.max(1.56, ctx.tuning.ior + 0.06),
        bezelWidth: 19,
        thickness: Math.max(68, ctx.tuning.thickness * 1.4),
      },
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: Math.min(0.9, ctx.tuning.heroBlurPx * 0.24),
      scaleMultiplier: 2.0,
      rimSaturationMultiplier: 1.55,
    }),
  },
  {
    id: 'lux-glass-pill-active',
    isNeeded: (ctx) => ctx.isSurfaceActive('dock', 1),
    buildRequest: (ctx) => ({
      width: 54,
      height: 28,
      radius: 14,
      tuning: {
        ...ctx.mapTuning,
        bezelWidth: 14,
        thickness: Math.max(56, ctx.tuning.thickness * 1.25),
      },
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: Math.min(1.0, ctx.tuning.heroBlurPx * 0.26),
      scaleMultiplier: 1.85,
      rimSaturationMultiplier: 1.5,
    }),
  },
  {
    id: 'lux-glass-tab-pill',
    isNeeded: (ctx) => ctx.isSurfaceActive('toolbar', 2),
    buildRequest: (ctx) => ({
      width: 52,
      height: 28,
      radius: 9,
      tuning: {
        ...ctx.mapTuning,
        bezelWidth: 13,
        thickness: Math.max(54, ctx.tuning.thickness * 1.2),
      },
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: Math.min(0.9, ctx.tuning.heroBlurPx * 0.24),
      scaleMultiplier: 1.95,
      rimSaturationMultiplier: 1.5,
    }),
  },
  {
    id: 'lux-glass-pin',
    isNeeded: (ctx) => ctx.isSurfaceActive('pins', 1),
    buildRequest: (ctx) => ({
      width: 30,
      height: 30,
      radius: 15,
      shapeProfile: 'lens',
      includeSpecular: false,
      includeCaustic: false,
      tuning: {
        ...ctx.mapTuning,
        ior: Math.max(1.55, ctx.tuning.ior + 0.05),
        thickness: Math.max(52, ctx.tuning.thickness),
      },
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: Math.min(1.15, ctx.tuning.heroBlurPx * 0.32),
      scaleMultiplier: 1.95,
      specularOpacityMultiplier: 0,
      disableCausticRim: true,
      disableDispersion: true,
    }),
  },
  {
    id: 'lux-glass-voice-pin',
    isNeeded: (ctx) => ctx.isSurfaceActive('voicePins', 1),
    buildRequest: (ctx) => ({
      width: 82,
      height: 24,
      radius: 12,
      tuning: {
        ...ctx.mapTuning,
        bezelWidth: 11,
        thickness: Math.max(40, ctx.tuning.thickness),
      },
      exact: true,
    }),
    buildFilterOptions: (ctx) => ({
      blurOverridePx: Math.min(2.8, ctx.tuning.heroBlurPx * 0.65),
      scaleMultiplier: 1.45,
      rimSaturationMultiplier: 1.25,
    }),
  },
  {
    id: 'lux-glass-drawer',
    isNeeded: (ctx) => ctx.tuning.refractPanels && ctx.isSurfaceActive('drawer', 4),
    buildRequest: (ctx) => ({
      width: ctx.sizes.drawer.width,
      height: ctx.sizes.drawer.height,
      radius: 22,
      tuning: {
        ...ctx.mapTuning,
        bezelWidth: Math.min(ctx.tuning.bezelWidth, 28),
        thickness: Math.min(ctx.tuning.thickness, 62),
      },
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    }),
    buildFilterOptions: (ctx) => ctx.panelFilterOptions,
  },
  {
    id: 'lux-glass-toolbar',
    isNeeded: (ctx) => ctx.tuning.refractPanels && ctx.isSurfaceActive('toolbar', 2),
    buildRequest: (ctx) => ({
      width: ctx.sizes.toolbar.width,
      height: ctx.sizes.toolbar.height,
      radius: 20,
      tuning: ctx.panelMapTuning,
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    }),
    buildFilterOptions: (ctx) => ctx.panelFilterOptions,
  },
  {
    id: 'lux-glass-composer',
    isNeeded: (ctx) => ctx.tuning.refractPanels && ctx.isSurfaceActive('composer', 3),
    buildRequest: (ctx) => ({
      width: ctx.sizes.composer.width,
      height: ctx.sizes.composer.height,
      radius: 20,
      tuning: ctx.panelMapTuning,
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    }),
    buildFilterOptions: (ctx) => ctx.panelFilterOptions,
  },
  {
    id: 'lux-glass-switcher',
    isNeeded: (ctx) => ctx.tuning.refractPanels && ctx.isSurfaceActive('switcher', 3),
    buildRequest: (ctx) => ({
      width: ctx.sizes.switcher.width,
      height: ctx.sizes.switcher.height,
      radius: 14,
      tuning: ctx.panelMapTuning,
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    }),
    buildFilterOptions: (ctx) => ctx.panelFilterOptions,
  },
  {
    id: 'lux-glass-tooltip',
    isNeeded: (ctx) =>
      ctx.tuning.refractPanels &&
      (ctx.isSurfaceActive('pins', 2) || ctx.isSurfaceActive('voicePins', 2)),
    buildRequest: (ctx) => ({
      width: ctx.sizes.tooltip.width,
      height: ctx.sizes.tooltip.height,
      radius: 14,
      tuning: {
        ...ctx.mapTuning,
        bezelWidth: Math.min(ctx.tuning.bezelWidth, 22),
        thickness: Math.min(ctx.tuning.thickness, 48),
      },
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    }),
    buildFilterOptions: (ctx) => ctx.panelFilterOptions,
  },
  {
    id: 'lux-glass-btn',
    isNeeded: hasButtonSurfaces,
    stretchToBounds: true,
    buildRequest: (ctx) => ({
      width: 116,
      height: 32,
      radius: 10,
      includeCaustic: false,
      includeSpecular: true,
      tuning: {
        ...ctx.mapTuning,
        ior: Math.max(1.54, ctx.tuning.ior + 0.04),
        bezelWidth: 11,
        thickness: Math.max(54, ctx.tuning.thickness * 1.1),
      },
      exact: true,
    }),
    buildFilterOptions: () => ({
      blurOverridePx: 0,
      scaleMultiplier: 1.85,
      specularOpacityMultiplier: 0.78,
      disableDispersion: true,
      disableCausticRim: true,
    }),
  },
  {
    id: 'lux-glass-btn-icon',
    isNeeded: hasButtonSurfaces,
    stretchToBounds: true,
    buildRequest: (ctx) => ({
      width: 28,
      height: 28,
      radius: 8,
      includeCaustic: false,
      includeSpecular: true,
      tuning: {
        ...ctx.mapTuning,
        ior: Math.max(1.55, ctx.tuning.ior + 0.05),
        bezelWidth: 10,
        thickness: Math.max(52, ctx.tuning.thickness * 1.05),
      },
      exact: true,
    }),
    buildFilterOptions: () => ({
      blurOverridePx: 0,
      scaleMultiplier: 1.9,
      specularOpacityMultiplier: 0.8,
      disableDispersion: true,
      disableCausticRim: true,
    }),
  },
];

function readMeasuredSize(el: HTMLElement | null, exact: boolean, step = 16): Size2D | null {
  if (!el) return null;
  const w = Math.round(el.offsetWidth);
  const h = Math.round(el.offsetHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16) return null;
  if (exact) return { width: w, height: h };
  return {
    width: Math.max(32, Math.round(w / step) * step),
    height: Math.max(32, Math.round(h / step) * step),
  };
}

function sizesEqual(a: Size2D | null, b: Size2D | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.width === b.width && a.height === b.height;
}

function renderGlassFilter(
  id: string,
  map: LiquidGlassMapResult | null,
  tuning: LiquidGlassTuning,
  filterOptions?: LiquidGlassFilterConfigOptions,
  stretchToBounds = false
) {
  if (!map) return null;

  const cfg = buildLiquidGlassFilterConfig(map, tuning, filterOptions);
  const baseInput = cfg.blurStdDev > 0.05 ? 'blurred' : 'SourceGraphic';
  const includeCaustic = cfg.useCausticRim && Boolean(map.causticMaskUrl);
  const postCausticInput = includeCaustic ? 'withCaustic' : 'interior';
  const includeSpecular = cfg.specularOpacity > 0.005 && Boolean(map.specularUrl);
  const feImageBounds = stretchToBounds
    ? {}
    : { x: '0', y: '0', width: map.width, height: map.height };

  return (
    <filter
      key={id}
      id={id}
      {...(stretchToBounds
        ? {
            x: '0%',
            y: '0%',
            width: '100%',
            height: '100%',
            filterUnits: 'objectBoundingBox',
            primitiveUnits: 'userSpaceOnUse',
          }
        : {})}
      color-interpolation-filters="sRGB"
    >
      {cfg.blurStdDev > 0.05 && (
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={cfg.blurStdDev}
          edgeMode="duplicate"
          result="blurred"
        />
      )}

      <feImage
        href={map.displacementUrl}
        {...feImageBounds}
        preserveAspectRatio="none"
        result="dispMap"
      />

      {cfg.useDispersion ? (
        <Fragment>
          <feDisplacementMap
            in={baseInput}
            in2="dispMap"
            scale={cfg.rScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispR"
          />
          <feDisplacementMap
            in={baseInput}
            in2="dispMap"
            scale={cfg.gScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispG"
          />
          <feDisplacementMap
            in={baseInput}
            in2="dispMap"
            scale={cfg.bScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispB"
          />
          <feColorMatrix
            in="dispR"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="rOnly"
          />
          <feColorMatrix
            in="dispG"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="gOnly"
          />
          <feColorMatrix
            in="dispB"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="bOnly"
          />
          <feBlend in="rOnly" in2="gOnly" mode="screen" result="rg" />
          <feBlend in="rg" in2="bOnly" mode="screen" result="displaced" />
        </Fragment>
      ) : (
        <feDisplacementMap
          in={baseInput}
          in2="dispMap"
          scale={cfg.scale}
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
      )}

      <feColorMatrix
        in="displaced"
        type="saturate"
        values={String(cfg.saturateRatio)}
        result="interior"
      />

      {includeCaustic && (
        <Fragment>
          <feColorMatrix
            in="displaced"
            type="saturate"
            values={String(cfg.rimSaturation)}
            result="rimSaturated"
          />

          <feImage
            href={map.causticMaskUrl}
            {...feImageBounds}
            preserveAspectRatio="none"
            result="causticMask"
          />

          <feComposite
            in="rimSaturated"
            in2="causticMask"
            operator="in"
            result="rimCaustic"
          />

          <feBlend in="rimCaustic" in2="interior" mode="normal" result="withCaustic" />
        </Fragment>
      )}

      {includeSpecular && (
        <Fragment>
          <feImage
            href={map.specularUrl}
            {...feImageBounds}
            preserveAspectRatio="none"
            result="specRaw"
          />

          <feComponentTransfer in="specRaw" result="spec">
            <feFuncA type="linear" slope={cfg.specularOpacity} />
          </feComponentTransfer>

          <feBlend in="spec" in2={postCausticInput} mode="screen" />
        </Fragment>
      )}
    </filter>
  );
}

function applyDockScaleAttributes(
  svgEl: SVGSVGElement | null,
  dockMap: LiquidGlassMapResult | null,
  tuning: LiquidGlassTuning,
  scaleMultiplier: number
): void {
  if (!svgEl || !dockMap) return;
  const cfg = buildLiquidGlassFilterConfig(dockMap, tuning, {
    blurOverridePx: tuning.heroBlurPx * 1.35,
    scaleMultiplier,
  });
  const dispNodes = svgEl.querySelectorAll('#lux-glass-dock feDisplacementMap');
  if (dispNodes.length === 3 && cfg.useDispersion) {
    dispNodes[0].setAttribute('scale', String(cfg.rScale));
    dispNodes[1].setAttribute('scale', String(cfg.gScale));
    dispNodes[2].setAttribute('scale', String(cfg.bScale));
  } else if (dispNodes.length >= 1) {
    dispNodes[0].setAttribute('scale', String(cfg.scale));
  }
}

export function LiquidGlassDefs({
  shadowRoot,
  tuning,
  enabled,
  activeBoost = false,
  activeSurfaces = DEFAULT_ACTIVE_SURFACES,
}: LiquidGlassDefsProps) {
  const [sizes, setSizes] = useState<SurfaceSizes>(INITIAL_SURFACE_SIZES);
  const [initialBoostScale] = useState<number>(() => (enabled && activeBoost ? 1.58 : 1.2));
  const dockScaleRef = useRef<number>(initialBoostScale);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [warmStage, setWarmStage] = useState<number>(0);
  const [seenSurfaces, setSeenSurfaces] = useState<ActiveGlassSurfaces>(() => ({
    ...activeSurfaces,
  }));

  const { ior, bezelWidth, thickness, dispersion, refractPanels } = tuning;

  const mapTuning = useMemo(
    () => ({ ...DEFAULT_LIQUID_GLASS_TUNING, ior, bezelWidth, thickness, dispersion }),
    [ior, bezelWidth, thickness, dispersion]
  );

  const panelMapTuning = useMemo(
    () => ({
      ...mapTuning,
      bezelWidth: Math.min(bezelWidth, 26),
      thickness: Math.min(thickness, 58),
    }),
    [mapTuning, bezelWidth, thickness]
  );

  const dockMapRef = useRef<LiquidGlassMapResult | null>(null);
  const tuningRef = useRef<LiquidGlassTuning>(tuning);
  tuningRef.current = tuning;

  // Record sticky visibility flags so previously shown surfaces stay warm in the ShadowRoot
  useEffect(() => {
    if (!enabled) return;
    setSeenSurfaces((prev) => {
      const hasNew = SURFACE_KEYS.some((key) => !prev[key] && activeSurfaces[key]);
      if (!hasNew) return prev;
      const next = { ...prev };
      for (const key of SURFACE_KEYS) {
        next[key] = prev[key] || activeSurfaces[key];
      }
      return next;
    });
  }, [
    enabled,
    activeSurfaces,
    activeSurfaces.launcher,
    activeSurfaces.dock,
    activeSurfaces.pins,
    activeSurfaces.voicePins,
    activeSurfaces.drawer,
    activeSurfaces.toolbar,
    activeSurfaces.composer,
    activeSurfaces.switcher,
  ]);

  // Progressive idle pre-warming across 4 stages so initial mount only generates visible maps
  useEffect(() => {
    if (!enabled) {
      setWarmStage(0);
      return;
    }
    setWarmStage(0);

    let currentStage = 0;
    let idleHandle: number | null = null;
    let timerHandle: number | null = null;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled || currentStage >= 4) return;
      const advance = () => {
        if (cancelled) return;
        currentStage += 1;
        setWarmStage(currentStage);
        scheduleNext();
      };

      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(advance, { timeout: 1200 });
      } else if (typeof window !== 'undefined') {
        timerHandle = window.setTimeout(advance, 150);
      }
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (
        idleHandle !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timerHandle !== null && typeof window !== 'undefined') {
        window.clearTimeout(timerHandle);
      }
    };
  }, [enabled, mapTuning]);

  // rAF-throttled ResizeObserver + MutationObserver tracking Shadow DOM surface sizes
  useEffect(() => {
    if (!enabled || !shadowRoot) return;

    const observed = new Map<ObservedSurfaceKey, HTMLElement>();
    let resizeObserver: ResizeObserver | null = null;
    let syncRafId = 0;

    const syncElements = () => {
      const updates: Partial<SurfaceSizes> = {};
      let hasUpdates = false;

      for (const spec of OBSERVED_SURFACE_SPECS) {
        const nextEl =
          spec.requiresPanelRefract && !refractPanels
            ? null
            : (shadowRoot.querySelector(spec.selector) as HTMLElement | null);

        const prevEl = observed.get(spec.key) ?? null;
        if (prevEl !== nextEl) {
          if (resizeObserver && prevEl) {
            resizeObserver.unobserve(prevEl);
          }
          if (nextEl) {
            observed.set(spec.key, nextEl);
            resizeObserver?.observe(nextEl);
          } else {
            observed.delete(spec.key);
          }
        }

        const measured = readMeasuredSize(nextEl, Boolean(spec.exact));
        if (measured) {
          updates[spec.key] = measured;
          hasUpdates = true;
        }
      }

      if (!hasUpdates) return;
      setSizes((prev) => {
        let changed = false;
        const next: SurfaceSizes = { ...prev };
        for (const [key, size] of Object.entries(updates) as Array<[ObservedSurfaceKey, Size2D]>) {
          if (!sizesEqual(prev[key], size)) {
            next[key] = size;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    const scheduleSync = () => {
      if (typeof requestAnimationFrame === 'undefined') {
        syncElements();
        return;
      }
      if (syncRafId !== 0) return;
      syncRafId = requestAnimationFrame(() => {
        syncRafId = 0;
        syncElements();
      });
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleSync);
    }

    syncElements();

    const mutationObserver =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(scheduleSync) : null;
    mutationObserver?.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      if (syncRafId !== 0 && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(syncRafId);
      }
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [enabled, shadowRoot, refractPanels]);

  const panelFilterOptions = useMemo<LiquidGlassFilterConfigOptions>(
    () => ({
      blurOverridePx: tuning.panelBlurPx > 0 ? Math.max(2.0, tuning.panelBlurPx * 0.58) : 0,
      scaleMultiplier: 1.45,
      rimSaturationMultiplier: 1.25,
      disableDispersion: true,
    }),
    [tuning.panelBlurPx]
  );

  const generatedMaps = useMemo(() => {
    const entries = new Map<string, LiquidGlassMapResult | null>();
    if (!enabled) return entries;

    const ctx: FilterBuildContext = {
      tuning,
      mapTuning,
      panelMapTuning,
      sizes,
      initialBoostScale,
      panelFilterOptions,
      isSurfaceActive: (key, minWarmStage) =>
        activeSurfaces[key] || seenSurfaces[key] || warmStage >= minWarmStage,
    };

    for (const spec of GLASS_FILTER_SPECS) {
      if (spec.isNeeded(ctx)) {
        entries.set(spec.id, generateLiquidGlassMaps(spec.buildRequest(ctx)));
      }
    }

    return entries;
  }, [
    enabled,
    tuning,
    mapTuning,
    panelMapTuning,
    sizes,
    initialBoostScale,
    panelFilterOptions,
    activeSurfaces,
    seenSurfaces,
    warmStage,
  ]);

  const dockMap = generatedMaps.get('lux-glass-dock') ?? null;
  dockMapRef.current = dockMap;

  // Animate #lux-glass-dock scale imperatively via SVG DOM attributes (zero Preact re-renders)
  useEffect(() => {
    const target = enabled && activeBoost ? 1.58 : 1.2;
    const startVal = dockScaleRef.current;
    if (
      Math.abs(target - startVal) < 0.002 ||
      !enabled ||
      typeof requestAnimationFrame === 'undefined' ||
      prefersReducedMotion()
    ) {
      dockScaleRef.current = target;
      applyDockScaleAttributes(svgRef.current, dockMapRef.current, tuningRef.current, target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startTime) / DOCK_BOOST_DURATION_MS));
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startVal + (target - startVal) * eased;
      dockScaleRef.current = next;
      applyDockScaleAttributes(svgRef.current, dockMapRef.current, tuningRef.current, next);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        rafId = 0;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, activeBoost]);

  // Re-apply current animated boost scale whenever #lux-glass-dock mounts or recreates
  useLayoutEffect(() => {
    applyDockScaleAttributes(svgRef.current, dockMap, tuning, dockScaleRef.current);
  }, [dockMap, tuning]);

  const renderedFilters = useMemo(() => {
    if (!enabled || generatedMaps.size === 0) return [];
    const ctx: FilterBuildContext = {
      tuning,
      mapTuning,
      panelMapTuning,
      sizes,
      initialBoostScale,
      panelFilterOptions,
      isSurfaceActive: (key, minWarmStage) =>
        activeSurfaces[key] || seenSurfaces[key] || warmStage >= minWarmStage,
    };

    const filters = [];
    for (const spec of GLASS_FILTER_SPECS) {
      const map = generatedMaps.get(spec.id);
      if (map) {
        const node = renderGlassFilter(
          spec.id,
          map,
          tuning,
          spec.buildFilterOptions(ctx),
          Boolean(spec.stretchToBounds)
        );
        if (node) filters.push(node);
      }
    }
    return filters;
  }, [
    enabled,
    generatedMaps,
    tuning,
    mapTuning,
    panelMapTuning,
    sizes,
    initialBoostScale,
    panelFilterOptions,
    activeSurfaces,
    seenSurfaces,
    warmStage,
  ]);

  if (!enabled || renderedFilters.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      width="0"
      height="0"
      color-interpolation-filters="sRGB"
      style={{
        position: 'fixed',
        width: '0px',
        height: '0px',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <defs>{renderedFilters}</defs>
    </svg>
  );
}
