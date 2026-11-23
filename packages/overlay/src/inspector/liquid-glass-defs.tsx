import { h } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_LIQUID_GLASS_TUNING,
  LiquidGlassFilterConfigOptions,
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

const DEFAULT_DOCK_SIZE: Size2D = { width: 328, height: 52 };
const DEFAULT_DRAWER_SIZE: Size2D = { width: 416, height: 528 };
const DEFAULT_TOOLBAR_SIZE: Size2D = { width: 344, height: 288 };
const DEFAULT_COMPOSER_SIZE: Size2D = { width: 360, height: 192 };
const DEFAULT_SWITCHER_SIZE: Size2D = { width: 472, height: 112 };
const DEFAULT_TOOLTIP_SIZE: Size2D = { width: 280, height: 112 };
const DOCK_BOOST_DURATION_MS = 220;

function readExactSize(el: HTMLElement | null): Size2D | null {
  if (!el) return null;
  const w = Math.round(el.offsetWidth);
  const h = Math.round(el.offsetHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16) return null;
  return { width: w, height: h };
}

function readQuantizedSize(el: HTMLElement | null, step = 16): Size2D | null {
  const exact = readExactSize(el);
  if (!exact) return null;
  return {
    width: Math.max(32, Math.round(exact.width / step) * step),
    height: Math.max(32, Math.round(exact.height / step) * step),
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
  filterOptions?: number | LiquidGlassFilterConfigOptions
) {
  if (!map) return null;

  const cfg = buildLiquidGlassFilterConfig(map, tuning, filterOptions);
  const baseInput = cfg.blurStdDev > 0.05 ? 'blurred' : 'SourceGraphic';
  const includeCaustic = cfg.useCausticRim && Boolean(map.causticMaskUrl);
  const postCausticInput = includeCaustic ? 'withCaustic' : 'interior';
  const includeSpecular = cfg.specularOpacity > 0.005 && Boolean(map.specularUrl);

  return (
    <filter key={id} id={id} color-interpolation-filters="sRGB">
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
        x="0"
        y="0"
        width={map.width}
        height={map.height}
        preserveAspectRatio="none"
        result="dispMap"
      />

      {cfg.useDispersion ? (
        <>
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
        </>
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
        <>
          <feColorMatrix
            in="displaced"
            type="saturate"
            values={String(cfg.rimSaturation)}
            result="rimSaturated"
          />

          <feImage
            href={map.causticMaskUrl}
            x="0"
            y="0"
            width={map.width}
            height={map.height}
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
        </>
      )}

      {includeSpecular && (
        <>
          <feImage
            href={map.specularUrl}
            x="0"
            y="0"
            width={map.width}
            height={map.height}
            preserveAspectRatio="none"
            result="specRaw"
          />

          <feComponentTransfer in="specRaw" result="spec">
            <feFuncA type="linear" slope={cfg.specularOpacity} />
          </feComponentTransfer>

          <feBlend in="spec" in2={postCausticInput} mode="screen" />
        </>
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
  const [dockSize, setDockSize] = useState<Size2D>(DEFAULT_DOCK_SIZE);
  const [drawerSize, setDrawerSize] = useState<Size2D>(DEFAULT_DRAWER_SIZE);
  const [toolbarSize, setToolbarSize] = useState<Size2D>(DEFAULT_TOOLBAR_SIZE);
  const [composerSize, setComposerSize] = useState<Size2D>(DEFAULT_COMPOSER_SIZE);
  const [switcherSize, setSwitcherSize] = useState<Size2D>(DEFAULT_SWITCHER_SIZE);
  const [tooltipSize, setTooltipSize] = useState<Size2D>(DEFAULT_TOOLTIP_SIZE);

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
      if (
        (prev.launcher || !activeSurfaces.launcher) &&
        (prev.dock || !activeSurfaces.dock) &&
        (prev.pins || !activeSurfaces.pins) &&
        (prev.voicePins || !activeSurfaces.voicePins) &&
        (prev.drawer || !activeSurfaces.drawer) &&
        (prev.toolbar || !activeSurfaces.toolbar) &&
        (prev.composer || !activeSurfaces.composer) &&
        (prev.switcher || !activeSurfaces.switcher)
      ) {
        return prev;
      }
      return {
        launcher: prev.launcher || activeSurfaces.launcher,
        dock: prev.dock || activeSurfaces.dock,
        pins: prev.pins || activeSurfaces.pins,
        voicePins: prev.voicePins || activeSurfaces.voicePins,
        drawer: prev.drawer || activeSurfaces.drawer,
        toolbar: prev.toolbar || activeSurfaces.toolbar,
        composer: prev.composer || activeSurfaces.composer,
        switcher: prev.switcher || activeSurfaces.switcher,
      };
    });
  }, [
    enabled,
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

    const observed = new Map<string, HTMLElement>();
    let resizeObserver: ResizeObserver | null = null;
    let syncRafId = 0;

    const syncElements = () => {
      const dockEl = shadowRoot.querySelector('.ve-dock-menu') as HTMLElement | null;
      const drawerEl = refractPanels
        ? (shadowRoot.querySelector('.ve-drawer') as HTMLElement | null)
        : null;
      const toolbarEl = refractPanels
        ? (shadowRoot.querySelector('.ve-toolbar') as HTMLElement | null)
        : null;
      const composerEl = refractPanels
        ? (shadowRoot.querySelector('.ve-comment-popover') as HTMLElement | null)
        : null;
      const switcherEl = refractPanels
        ? (shadowRoot.querySelector('.ve-variant-switcher-bar') as HTMLElement | null)
        : null;
      const tooltipEl = refractPanels
        ? (shadowRoot.querySelector('.ve-pin-tooltip, .ve-voice-pin-tooltip') as HTMLElement | null)
        : null;

      const entries: Array<[string, HTMLElement | null, boolean, number]> = [
        ['dock', dockEl, true, 1],
        ['drawer', drawerEl, false, 16],
        ['toolbar', toolbarEl, false, 16],
        ['composer', composerEl, false, 16],
        ['switcher', switcherEl, false, 16],
        ['tooltip', tooltipEl, false, 16],
      ];

      for (const [key, nextEl, exact, step] of entries) {
        const prevEl = observed.get(key) ?? null;
        if (prevEl !== nextEl) {
          if (resizeObserver && prevEl) {
            resizeObserver.unobserve(prevEl);
          }
          if (nextEl) {
            observed.set(key, nextEl);
            resizeObserver?.observe(nextEl);
          } else {
            observed.delete(key);
          }
        }

        const measured = exact ? readExactSize(nextEl) : readQuantizedSize(nextEl, step);
        if (!measured) continue;
        if (key === 'dock') {
          setDockSize((prev) => (sizesEqual(prev, measured) ? prev : measured));
        } else if (key === 'drawer') {
          setDrawerSize((prev) => (sizesEqual(prev, measured) ? prev : measured));
        } else if (key === 'toolbar') {
          setToolbarSize((prev) => (sizesEqual(prev, measured) ? prev : measured));
        } else if (key === 'composer') {
          setComposerSize((prev) => (sizesEqual(prev, measured) ? prev : measured));
        } else if (key === 'switcher') {
          setSwitcherSize((prev) => (sizesEqual(prev, measured) ? prev : measured));
        } else if (key === 'tooltip') {
          setTooltipSize((prev) => (sizesEqual(prev, measured) ? prev : measured));
        }
      }
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
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(scheduleSync)
        : null;

    mutationObserver?.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      if (syncRafId !== 0 && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(syncRafId);
      }
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [enabled, shadowRoot, refractPanels]);

  const needLauncher = enabled && (activeSurfaces.launcher || seenSurfaces.launcher || warmStage >= 1);
  const needDock = enabled && (activeSurfaces.dock || seenSurfaces.dock || warmStage >= 1);
  const needPins = enabled && (activeSurfaces.pins || seenSurfaces.pins || warmStage >= 1);
  const needVoicePins =
    enabled && (activeSurfaces.voicePins || seenSurfaces.voicePins || warmStage >= 1);
  const needTabPill = enabled && (activeSurfaces.toolbar || seenSurfaces.toolbar || warmStage >= 2);
  const needToolbar = enabled && refractPanels && (activeSurfaces.toolbar || seenSurfaces.toolbar || warmStage >= 2);
  const needTooltip =
    enabled &&
    refractPanels &&
    (activeSurfaces.pins ||
      activeSurfaces.voicePins ||
      seenSurfaces.pins ||
      seenSurfaces.voicePins ||
      warmStage >= 2);
  const needComposer =
    enabled && refractPanels && (activeSurfaces.composer || seenSurfaces.composer || warmStage >= 3);
  const needSwitcher =
    enabled && refractPanels && (activeSurfaces.switcher || seenSurfaces.switcher || warmStage >= 3);
  const needDrawer =
    enabled && refractPanels && (activeSurfaces.drawer || seenSurfaces.drawer || warmStage >= 4);

  const launcherMap = useMemo(() => {
    if (!needLauncher) return null;
    return generateLiquidGlassMaps({
      width: 52,
      height: 52,
      radius: 26,
      tuning: {
        ...mapTuning,
        bezelWidth: 25,
        thickness: Math.max(72, thickness * 1.45),
      },
      exact: true,
    });
  }, [needLauncher, mapTuning, thickness]);

  const dockMap = useMemo(() => {
    if (!needDock) return null;
    return generateLiquidGlassMaps({
      width: dockSize.width,
      height: dockSize.height,
      radius: Math.round(dockSize.height / 2),
      tuning: mapTuning,
      exact: true,
    });
  }, [needDock, dockSize.width, dockSize.height, mapTuning]);

  dockMapRef.current = dockMap;

  const focusLensMap = useMemo(() => {
    if (!needDock) return null;
    return generateLiquidGlassMaps({
      width: 52,
      height: 48,
      radius: 24,
      tuning: {
        ...mapTuning,
        ior: Math.max(1.58, ior + 0.08),
        bezelWidth: 22,
        thickness: Math.max(82, thickness * 1.65),
      },
      exact: true,
    });
  }, [needDock, mapTuning, ior, thickness]);

  const bubbleMap = useMemo(() => {
    if (!needDock) return null;
    return generateLiquidGlassMaps({
      width: 40,
      height: 40,
      radius: 20,
      tuning: {
        ...mapTuning,
        ior: Math.max(1.56, ior + 0.06),
        bezelWidth: 19,
        thickness: Math.max(68, thickness * 1.4),
      },
      exact: true,
    });
  }, [needDock, mapTuning, ior, thickness]);

  const pillActiveMap = useMemo(() => {
    if (!needDock) return null;
    return generateLiquidGlassMaps({
      width: 54,
      height: 28,
      radius: 14,
      tuning: {
        ...mapTuning,
        bezelWidth: 14,
        thickness: Math.max(56, thickness * 1.25),
      },
      exact: true,
    });
  }, [needDock, mapTuning, thickness]);

  const tabPillMap = useMemo(() => {
    if (!needTabPill) return null;
    return generateLiquidGlassMaps({
      width: 52,
      height: 28,
      radius: 9,
      tuning: {
        ...mapTuning,
        bezelWidth: 13,
        thickness: Math.max(54, thickness * 1.2),
      },
      exact: true,
    });
  }, [needTabPill, mapTuning, thickness]);

  const pinMap = useMemo(() => {
    if (!needPins) return null;
    return generateLiquidGlassMaps({
      width: 30,
      height: 30,
      radius: 15,
      shapeProfile: 'lens',
      includeSpecular: false,
      includeCaustic: false,
      tuning: {
        ...mapTuning,
        ior: Math.max(1.55, ior + 0.05),
        thickness: Math.max(52, thickness),
      },
      exact: true,
    });
  }, [needPins, mapTuning, ior, thickness]);

  const voicePinMap = useMemo(() => {
    if (!needVoicePins) return null;
    return generateLiquidGlassMaps({
      width: 82,
      height: 24,
      radius: 12,
      tuning: {
        ...mapTuning,
        bezelWidth: 11,
        thickness: Math.max(40, thickness),
      },
      exact: true,
    });
  }, [needVoicePins, mapTuning, thickness]);

  const drawerMap = useMemo(() => {
    if (!needDrawer) return null;
    return generateLiquidGlassMaps({
      width: drawerSize.width,
      height: drawerSize.height,
      radius: 22,
      tuning: {
        ...mapTuning,
        bezelWidth: Math.min(bezelWidth, 28),
        thickness: Math.min(thickness, 62),
      },
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    });
  }, [needDrawer, drawerSize, mapTuning, bezelWidth, thickness]);

  const toolbarMap = useMemo(() => {
    if (!needToolbar) return null;
    return generateLiquidGlassMaps({
      width: toolbarSize.width,
      height: toolbarSize.height,
      radius: 20,
      tuning: panelMapTuning,
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    });
  }, [needToolbar, toolbarSize, panelMapTuning]);

  const composerMap = useMemo(() => {
    if (!needComposer) return null;
    return generateLiquidGlassMaps({
      width: composerSize.width,
      height: composerSize.height,
      radius: 20,
      tuning: panelMapTuning,
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    });
  }, [needComposer, composerSize, panelMapTuning]);

  const switcherMap = useMemo(() => {
    if (!needSwitcher) return null;
    return generateLiquidGlassMaps({
      width: switcherSize.width,
      height: switcherSize.height,
      radius: 14,
      tuning: panelMapTuning,
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    });
  }, [needSwitcher, switcherSize, panelMapTuning]);

  const tooltipMap = useMemo(() => {
    if (!needTooltip) return null;
    return generateLiquidGlassMaps({
      width: tooltipSize.width,
      height: tooltipSize.height,
      radius: 14,
      tuning: {
        ...mapTuning,
        bezelWidth: Math.min(bezelWidth, 22),
        thickness: Math.min(thickness, 48),
      },
      dpr: 1,
      exact: false,
      quantizeStep: 16,
    });
  }, [needTooltip, tooltipSize, mapTuning, bezelWidth, thickness]);

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

  const panelBlurOverride = tuning.panelBlurPx > 0 ? Math.max(2.0, tuning.panelBlurPx * 0.58) : 0;

  const launcherFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-launcher', launcherMap, tuning, {
        blurOverridePx: Math.min(3.2, tuning.heroBlurPx * 0.72),
        scaleMultiplier: 1.85,
        rimSaturationMultiplier: 1.35,
      }),
    [launcherMap, tuning]
  );

  const dockFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-dock', dockMap, tuning, {
        blurOverridePx: tuning.heroBlurPx * 1.35,
        scaleMultiplier: initialBoostScale,
      }),
    [dockMap, tuning, initialBoostScale]
  );

  const focusFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-focus', focusLensMap, tuning, {
        blurOverridePx: Math.min(0.8, tuning.heroBlurPx * 0.22),
        scaleMultiplier: 2.35,
        rimSaturationMultiplier: 1.75,
      }),
    [focusLensMap, tuning]
  );

  const bubbleFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-bubble', bubbleMap, tuning, {
        blurOverridePx: Math.min(0.9, tuning.heroBlurPx * 0.24),
        scaleMultiplier: 2.0,
        rimSaturationMultiplier: 1.55,
      }),
    [bubbleMap, tuning]
  );

  const pillActiveFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-pill-active', pillActiveMap, tuning, {
        blurOverridePx: Math.min(1.0, tuning.heroBlurPx * 0.26),
        scaleMultiplier: 1.85,
        rimSaturationMultiplier: 1.5,
      }),
    [pillActiveMap, tuning]
  );

  const tabPillFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-tab-pill', tabPillMap, tuning, {
        blurOverridePx: Math.min(0.9, tuning.heroBlurPx * 0.24),
        scaleMultiplier: 1.95,
        rimSaturationMultiplier: 1.5,
      }),
    [tabPillMap, tuning]
  );

  const pinFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-pin', pinMap, tuning, {
        blurOverridePx: Math.min(1.15, tuning.heroBlurPx * 0.32),
        scaleMultiplier: 1.95,
        specularOpacityMultiplier: 0,
        disableCausticRim: true,
        disableDispersion: true,
      }),
    [pinMap, tuning]
  );

  const voicePinFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-voice-pin', voicePinMap, tuning, {
        blurOverridePx: Math.min(2.8, tuning.heroBlurPx * 0.65),
        scaleMultiplier: 1.45,
        rimSaturationMultiplier: 1.25,
      }),
    [voicePinMap, tuning]
  );

  const drawerFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-drawer', drawerMap, tuning, {
        blurOverridePx: panelBlurOverride,
        scaleMultiplier: 1.45,
        rimSaturationMultiplier: 1.25,
        disableDispersion: true,
      }),
    [drawerMap, tuning, panelBlurOverride]
  );

  const toolbarFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-toolbar', toolbarMap, tuning, {
        blurOverridePx: panelBlurOverride,
        scaleMultiplier: 1.45,
        rimSaturationMultiplier: 1.25,
        disableDispersion: true,
      }),
    [toolbarMap, tuning, panelBlurOverride]
  );

  const composerFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-composer', composerMap, tuning, {
        blurOverridePx: panelBlurOverride,
        scaleMultiplier: 1.45,
        rimSaturationMultiplier: 1.25,
        disableDispersion: true,
      }),
    [composerMap, tuning, panelBlurOverride]
  );

  const switcherFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-switcher', switcherMap, tuning, {
        blurOverridePx: panelBlurOverride,
        scaleMultiplier: 1.45,
        rimSaturationMultiplier: 1.25,
        disableDispersion: true,
      }),
    [switcherMap, tuning, panelBlurOverride]
  );

  const tooltipFilter = useMemo(
    () =>
      renderGlassFilter('lux-glass-tooltip', tooltipMap, tuning, {
        blurOverridePx: panelBlurOverride,
        scaleMultiplier: 1.45,
        rimSaturationMultiplier: 1.25,
        disableDispersion: true,
      }),
    [tooltipMap, tuning, panelBlurOverride]
  );

  const hasAnyMap = Boolean(
    launcherMap ||
      dockMap ||
      focusLensMap ||
      bubbleMap ||
      pillActiveMap ||
      tabPillMap ||
      pinMap ||
      voicePinMap ||
      drawerMap ||
      toolbarMap ||
      composerMap ||
      switcherMap ||
      tooltipMap
  );

  if (!enabled || !hasAnyMap) {
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
      <defs>
        {launcherFilter}
        {dockFilter}
        {focusFilter}
        {bubbleFilter}
        {pillActiveFilter}
        {tabPillFilter}
        {pinFilter}
        {voicePinFilter}
        {drawerFilter}
        {toolbarFilter}
        {composerFilter}
        {switcherFilter}
        {tooltipFilter}
      </defs>
    </svg>
  );
}
