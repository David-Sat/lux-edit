import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_LIQUID_GLASS_TUNING,
  LiquidGlassFilterConfigOptions,
  LiquidGlassMapResult,
  LiquidGlassTuning,
  buildLiquidGlassFilterConfig,
  generateLiquidGlassMaps,
  prefersReducedMotion,
} from './liquid-glass.js';

interface LiquidGlassDefsProps {
  shadowRoot: ShadowRoot;
  tuning: LiquidGlassTuning;
  enabled: boolean;
  activeBoost?: boolean;
  interactionPulse?: number;
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
const INTERACTION_PULSE_DURATION_MS = 240;

function readExactSize(el: HTMLElement | null): Size2D | null {
  if (!el) return null;
  const w = Math.round(el.offsetWidth);
  const h = Math.round(el.offsetHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16) return null;
  return { width: w, height: h };
}

function readQuantizedSize(el: HTMLElement | null, step = 8): Size2D | null {
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
  const postCausticInput = cfg.useCausticRim ? 'withCaustic' : 'interior';
  const includeSpecular = cfg.specularOpacity > 0.005;

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

      {cfg.useCausticRim && (
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

export function LiquidGlassDefs({
  shadowRoot,
  tuning,
  enabled,
  activeBoost = false,
  interactionPulse = 0,
}: LiquidGlassDefsProps) {
  const [dockSize, setDockSize] = useState<Size2D>(DEFAULT_DOCK_SIZE);
  const [drawerSize, setDrawerSize] = useState<Size2D>(DEFAULT_DRAWER_SIZE);
  const [toolbarSize, setToolbarSize] = useState<Size2D>(DEFAULT_TOOLBAR_SIZE);
  const [composerSize, setComposerSize] = useState<Size2D>(DEFAULT_COMPOSER_SIZE);
  const [switcherSize, setSwitcherSize] = useState<Size2D>(DEFAULT_SWITCHER_SIZE);
  const [tooltipSize, setTooltipSize] = useState<Size2D>(DEFAULT_TOOLTIP_SIZE);

  const initialBoostScale = activeBoost ? 1.58 : 1.2;
  const [dockScaleMultiplier, setDockScaleMultiplier] = useState<number>(initialBoostScale);
  const dockScaleRef = useRef<number>(initialBoostScale);
  const [pulseMultiplier, setPulseMultiplier] = useState<number>(1);

  const { ior, bezelWidth, thickness, dispersion, refractPanels } = tuning;

  useEffect(() => {
    if (
      !enabled ||
      interactionPulse <= 0 ||
      prefersReducedMotion() ||
      typeof requestAnimationFrame === 'undefined'
    ) {
      setPulseMultiplier(1);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - startTime) / INTERACTION_PULSE_DURATION_MS));
      if (t >= 1) {
        setPulseMultiplier(1);
        rafId = 0;
        return;
      }
      const envelope = 0.1 * Math.sin(Math.pow(t, 0.72) * Math.PI);
      setPulseMultiplier(Number.isFinite(envelope) ? 1 + envelope : 1);
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, interactionPulse]);

  useEffect(() => {
    const target = enabled && activeBoost ? 1.58 : 1.2;
    const startVal = dockScaleRef.current;
    if (Math.abs(target - startVal) < 0.002) {
      dockScaleRef.current = target;
      setDockScaleMultiplier(target);
      return;
    }

    if (!enabled || typeof requestAnimationFrame === 'undefined') {
      dockScaleRef.current = target;
      setDockScaleMultiplier(target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startTime) / DOCK_BOOST_DURATION_MS));
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startVal + (target - startVal) * eased;
      dockScaleRef.current = next;
      setDockScaleMultiplier(next);
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

  useEffect(() => {
    if (!enabled || !shadowRoot) return;

    const observed = new Map<string, HTMLElement>();
    let resizeObserver: ResizeObserver | null = null;

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
        ['toolbar', toolbarEl, false, 8],
        ['composer', composerEl, false, 8],
        ['switcher', switcherEl, false, 8],
        ['tooltip', tooltipEl, false, 8],
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

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncElements();
      });
    }

    syncElements();

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            syncElements();
          })
        : null;

    mutationObserver?.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [enabled, shadowRoot, refractPanels]);

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

  const launcherMap = useMemo(() => {
    if (!enabled) return null;
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
  }, [enabled, mapTuning, thickness]);

  const dockMap = useMemo(() => {
    if (!enabled) return null;
    return generateLiquidGlassMaps({
      width: dockSize.width,
      height: dockSize.height,
      radius: Math.round(dockSize.height / 2),
      tuning: mapTuning,
      exact: true,
    });
  }, [enabled, dockSize.width, dockSize.height, mapTuning]);

  const focusLensMap = useMemo(() => {
    if (!enabled) return null;
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
  }, [enabled, mapTuning, ior, thickness]);

  const bubbleMap = useMemo(() => {
    if (!enabled) return null;
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
  }, [enabled, mapTuning, ior, thickness]);

  const pillActiveMap = useMemo(() => {
    if (!enabled) return null;
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
  }, [enabled, mapTuning, thickness]);

  const tabPillMap = useMemo(() => {
    if (!enabled) return null;
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
  }, [enabled, mapTuning, thickness]);

  const pinMap = useMemo(() => {
    if (!enabled) return null;
    return generateLiquidGlassMaps({
      width: 30,
      height: 30,
      radius: 15,
      shapeProfile: 'lens',
      tuning: {
        ...mapTuning,
        ior: Math.max(1.55, ior + 0.05),
        thickness: Math.max(52, thickness),
      },
      exact: true,
    });
  }, [enabled, mapTuning, ior, thickness]);

  const voicePinMap = useMemo(() => {
    if (!enabled) return null;
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
  }, [enabled, mapTuning, thickness]);

  const drawerMap = useMemo(() => {
    if (!enabled || !refractPanels) return null;
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
  }, [enabled, refractPanels, drawerSize, mapTuning, bezelWidth, thickness]);

  const toolbarMap = useMemo(() => {
    if (!enabled || !refractPanels) return null;
    return generateLiquidGlassMaps({
      width: toolbarSize.width,
      height: toolbarSize.height,
      radius: 20,
      tuning: panelMapTuning,
      dpr: 1,
      exact: false,
    });
  }, [enabled, refractPanels, toolbarSize, panelMapTuning]);

  const composerMap = useMemo(() => {
    if (!enabled || !refractPanels) return null;
    return generateLiquidGlassMaps({
      width: composerSize.width,
      height: composerSize.height,
      radius: 20,
      tuning: panelMapTuning,
      dpr: 1,
      exact: false,
    });
  }, [enabled, refractPanels, composerSize, panelMapTuning]);

  const switcherMap = useMemo(() => {
    if (!enabled || !refractPanels) return null;
    return generateLiquidGlassMaps({
      width: switcherSize.width,
      height: switcherSize.height,
      radius: 14,
      tuning: panelMapTuning,
      dpr: 1,
      exact: false,
    });
  }, [enabled, refractPanels, switcherSize, panelMapTuning]);

  const tooltipMap = useMemo(() => {
    if (!enabled || !refractPanels) return null;
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
    });
  }, [enabled, refractPanels, tooltipSize, mapTuning, bezelWidth, thickness]);

  if (!enabled || (!launcherMap && !dockMap)) {
    return null;
  }

  const panelBlurOverride = tuning.panelBlurPx > 0 ? Math.max(2.0, tuning.panelBlurPx * 0.58) : 0;

  return (
    <svg
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
        {renderGlassFilter('lux-glass-launcher', launcherMap, tuning, {
          blurOverridePx: Math.min(3.2, tuning.heroBlurPx * 0.72),
          scaleMultiplier: 1.85 * pulseMultiplier,
          rimSaturationMultiplier: 1.35,
        })}
        {renderGlassFilter('lux-glass-dock', dockMap, tuning, {
          blurOverridePx: tuning.heroBlurPx * 1.35,
          scaleMultiplier: dockScaleMultiplier * pulseMultiplier,
        })}
        {renderGlassFilter('lux-glass-focus', focusLensMap, tuning, {
          blurOverridePx: Math.min(0.8, tuning.heroBlurPx * 0.22),
          scaleMultiplier: 2.35 * pulseMultiplier,
          rimSaturationMultiplier: 1.75,
        })}
        {renderGlassFilter('lux-glass-bubble', bubbleMap, tuning, {
          blurOverridePx: Math.min(0.9, tuning.heroBlurPx * 0.24),
          scaleMultiplier: 2.0 * pulseMultiplier,
          rimSaturationMultiplier: 1.55,
        })}
        {renderGlassFilter('lux-glass-pill-active', pillActiveMap, tuning, {
          blurOverridePx: Math.min(1.0, tuning.heroBlurPx * 0.26),
          scaleMultiplier: 1.85 * pulseMultiplier,
          rimSaturationMultiplier: 1.5,
        })}
        {renderGlassFilter('lux-glass-tab-pill', tabPillMap, tuning, {
          blurOverridePx: Math.min(0.9, tuning.heroBlurPx * 0.24),
          scaleMultiplier: 1.95 * pulseMultiplier,
          rimSaturationMultiplier: 1.5,
        })}
        {renderGlassFilter('lux-glass-pin', pinMap, tuning, {
          blurOverridePx: Math.min(1.15, tuning.heroBlurPx * 0.32),
          scaleMultiplier: 1.95,
          specularOpacityMultiplier: 0,
          disableCausticRim: true,
        })}
        {renderGlassFilter('lux-glass-voice-pin', voicePinMap, tuning, {
          blurOverridePx: Math.min(2.8, tuning.heroBlurPx * 0.65),
          scaleMultiplier: 1.45,
          rimSaturationMultiplier: 1.25,
        })}
        {renderGlassFilter('lux-glass-drawer', drawerMap, tuning, {
          blurOverridePx: panelBlurOverride,
          scaleMultiplier: 1.45,
          rimSaturationMultiplier: 1.25,
          disableDispersion: true,
        })}
        {renderGlassFilter('lux-glass-toolbar', toolbarMap, tuning, {
          blurOverridePx: panelBlurOverride,
          scaleMultiplier: 1.45,
          rimSaturationMultiplier: 1.25,
          disableDispersion: true,
        })}
        {renderGlassFilter('lux-glass-composer', composerMap, tuning, {
          blurOverridePx: panelBlurOverride,
          scaleMultiplier: 1.45,
          rimSaturationMultiplier: 1.25,
          disableDispersion: true,
        })}
        {renderGlassFilter('lux-glass-switcher', switcherMap, tuning, {
          blurOverridePx: panelBlurOverride,
          scaleMultiplier: 1.45,
          rimSaturationMultiplier: 1.25,
          disableDispersion: true,
        })}
        {renderGlassFilter('lux-glass-tooltip', tooltipMap, tuning, {
          blurOverridePx: panelBlurOverride,
          scaleMultiplier: 1.45,
          rimSaturationMultiplier: 1.25,
          disableDispersion: true,
        })}
      </defs>
    </svg>
  );
}
