import { useEffect } from 'preact/hooks';

export type GlassMaterialMode = 'svg-refract' | 'css-liquid';
export type LiquidGlassRecipeId = 'apple-clear' | 'crystal-drop' | 'dark-obsidian';
export type LiquidGlassSurfaceTone = 'light' | 'dark';
export type LiquidGlassShapeProfile = 'bezel' | 'lens';

export interface LiquidGlassTuning {
  ior: number;
  bezelWidth: number;
  thickness: number;
  refractionStrength: number;
  specularOpacity: number;
  heroBlurPx: number;
  panelBlurPx: number;
  saturatePct: number;
  rimSaturation: number;
  dispersion: number;
  tintOpacity: number;
  surfaceTone: LiquidGlassSurfaceTone;
  refractPanels: boolean;
  pointerGlint: boolean;
}

export const DEFAULT_LIQUID_GLASS_TUNING: LiquidGlassTuning = {
  ior: 1.5,
  bezelWidth: 28,
  thickness: 58,
  refractionStrength: 1.35,
  specularOpacity: 0.78,
  heroBlurPx: 1.5,
  panelBlurPx: 5,
  saturatePct: 180,
  rimSaturation: 5.5,
  dispersion: 0.35,
  tintOpacity: 0.35,
  surfaceTone: 'light',
  refractPanels: true,
  pointerGlint: true,
};

export const LIQUID_GLASS_RECIPES: Record<
  LiquidGlassRecipeId,
  { label: string; tuning: LiquidGlassTuning }
> = {
  'apple-clear': {
    label: 'Apple Glass',
    tuning: {
      ...DEFAULT_LIQUID_GLASS_TUNING,
    },
  },
  'crystal-drop': {
    label: 'Crystal Drop',
    tuning: {
      ...DEFAULT_LIQUID_GLASS_TUNING,
      ior: 1.55,
      bezelWidth: 30,
      thickness: 66,
      refractionStrength: 1.6,
      heroBlurPx: 0.5,
      panelBlurPx: 7,
      specularOpacity: 0.88,
      rimSaturation: 6.5,
      dispersion: 0.65,
      tintOpacity: 0.2,
      surfaceTone: 'light',
    },
  },
  'dark-obsidian': {
    label: 'Dark Glass',
    tuning: {
      ...DEFAULT_LIQUID_GLASS_TUNING,
      ior: 1.5,
      bezelWidth: 26,
      thickness: 54,
      refractionStrength: 1.3,
      heroBlurPx: 4.0,
      panelBlurPx: 12,
      specularOpacity: 0.72,
      rimSaturation: 5.0,
      dispersion: 0.35,
      tintOpacity: 0.56,
      surfaceTone: 'dark',
    },
  },
};

export interface RefractionProfile {
  displacements: Float32Array;
  maxDisplacement: number;
}

export interface LiquidGlassMapRequest {
  width: number;
  height: number;
  radius: number;
  tuning: LiquidGlassTuning;
  shapeProfile?: LiquidGlassShapeProfile;
  includeSpecular?: boolean;
  includeCaustic?: boolean;
  dpr?: number;
  exact?: boolean;
  quantizeStep?: number;
}

export interface LiquidGlassMapResult {
  width: number;
  height: number;
  radius: number;
  displacementUrl: string;
  specularUrl: string;
  causticMaskUrl: string;
  maxDisplacement: number;
}

export interface LiquidGlassFilterConfig {
  scale: number;
  useDispersion: boolean;
  useCausticRim: boolean;
  rScale: number;
  gScale: number;
  bScale: number;
  blurStdDev: number;
  saturateRatio: number;
  rimSaturation: number;
  specularOpacity: number;
}

const MAX_CACHE_ENTRIES = 32;
const mapCache = new Map<string, LiquidGlassMapResult>();

function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return Math.round(v);
}

function normalizeDimension(value: number, exact: boolean, quantizeStep = 8): number {
  const rounded = Math.max(16, Math.round(value));
  if (exact) return rounded;
  const step = Math.max(1, Math.round(quantizeStep));
  return Math.max(16, Math.round(rounded / step) * step);
}

function squircleHeight(x: number): number {
  return Math.pow(Math.max(0, 1 - Math.pow(1 - x, 4)), 0.25);
}

/**
 * Detects whether the current browser supports Chromium-style SVG
 * `backdrop-filter: url(#...)` refraction without reduced-transparency opt-out.
 */
export function supportsSvgBackdropFilter(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof CSS === 'undefined') {
    return false;
  }

  try {
    if (window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches) {
      return false;
    }
  } catch {
    // Ignore matchMedia errors in restricted environments.
  }

  const ua = navigator.userAgent || '';
  if (/Firefox/i.test(ua)) {
    return false;
  }

  const isChromium = 'chrome' in window || /Chrome|Chromium|Edg|OPR|Brave/i.test(ua);
  if (!isChromium) {
    return false;
  }

  try {
    return CSS.supports('backdrop-filter', 'url(#x)') || CSS.supports('-webkit-backdrop-filter', 'url(#x)');
  } catch {
    return false;
  }
}

/**
 * Computes a smooth 1D Snell's Law refraction displacement profile across a convex squircle bezel.
 * Uses finite-difference slope evaluation (matching kube.io's optical curve) so thick-glass refraction
 * bends across the entire visible bezel without an infinite spike at t = 0.
 */
export function computeRefractionProfile(
  samples: number,
  ior: number,
  bezelWidth: number,
  thickness: number
): RefractionProfile {
  const count = Math.max(2, Math.floor(samples));
  const displacements = new Float32Array(count);
  const safeIor = Math.max(1.01, ior);
  const safeBezel = Math.max(1, bezelWidth);
  const safeThickness = Math.max(1, thickness);
  const deltaX = 0.002;

  let maxDisplacement = 0.001;

  for (let i = 0; i < count; i++) {
    const x = i / (count - 1);
    if (x >= 1) {
      displacements[i] = 0;
      continue;
    }

    const xs = 0.02 + x * 0.98;
    const y = squircleHeight(xs);
    const y2 = squircleHeight(Math.min(1, xs + deltaX));
    const dyDx = (y2 - y) / deltaX;

    const theta1 = Math.atan(dyDx);
    const sinTheta2 = Math.min(0.999, Math.sin(theta1) / safeIor);
    const theta2 = Math.asin(sinTheta2);

    const rayHeight = y * safeBezel + safeThickness;
    const disp = rayHeight * Math.tan(theta1 - theta2);

    displacements[i] = disp;
    if (Math.abs(disp) > maxDisplacement) {
      maxDisplacement = Math.abs(disp);
    }
  }

  return { displacements, maxDisplacement };
}

/**
 * Computes a continuous spherical cabochon magnifying-lens refraction profile from center (`r = 0`)
 * to perimeter (`r = 1`), bending rays smoothly across the entire dome without a steep outer bezel cliff.
 */
export function computeSphericalLensProfile(
  samples: number,
  ior: number,
  radius: number,
  thickness: number
): RefractionProfile {
  const count = Math.max(2, Math.floor(samples));
  const displacements = new Float32Array(count);
  const safeIor = Math.max(1.01, ior);
  const safeRadius = Math.max(4, radius);
  const safeThickness = Math.max(1, thickness);
  const k = 0.76;
  const domeRatio = 0.72;
  const baseThickness = safeRadius * (0.18 + 0.22 * Math.min(1.5, safeThickness / 58));

  let maxDisplacement = 0.001;

  for (let i = 0; i < count; i++) {
    const r = i / (count - 1);
    const sqrtTerm = Math.sqrt(Math.max(0.04, 1 - k * r * r));
    const z = safeRadius * domeRatio * sqrtTerm;
    const slope = (domeRatio * k * r) / sqrtTerm;

    const theta1 = Math.atan(slope);
    const sinTheta2 = Math.min(0.999, Math.sin(theta1) / safeIor);
    const theta2 = Math.asin(sinTheta2);

    const disp = (z + baseThickness) * Math.tan(theta1 - theta2);
    displacements[i] = disp;
    if (Math.abs(disp) > maxDisplacement) {
      maxDisplacement = Math.abs(disp);
    }
  }

  return { displacements, maxDisplacement };
}

function sampleProfile(profile: Float32Array, t: number, clampEnd = false): number {
  if (t <= 0) return profile[0];
  const maxIdx = profile.length - 1;
  if (t >= 1) return clampEnd ? profile[maxIdx] : 0;
  const pos = t * maxIdx;
  const lo = Math.floor(pos);
  const hi = Math.min(maxIdx, lo + 1);
  const frac = pos - lo;
  return profile[lo] * (1 - frac) + profile[hi] * frac;
}

/**
 * Generates displacement, opposing double-arc Fresnel specular, and rim caustic mask PNG data URLs
 * for a rounded rectangle or continuous spherical lens. Exact dimensions are kept for hero chrome to avoid edge offset;
 * larger panels quantize to 8px buckets and cache in a bounded LRU map.
 */
export function generateLiquidGlassMaps(request: LiquidGlassMapRequest): LiquidGlassMapResult | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const useExact = request.exact ?? (request.width <= 600 && request.height <= 72);
  const quantizeStep = request.quantizeStep ?? 8;
  const width = normalizeDimension(request.width, useExact, quantizeStep);
  const height = normalizeDimension(request.height, useExact, quantizeStep);
  const radius = Math.max(0, Math.min(Math.round(request.radius), width / 2, height / 2));
  const shapeProfile: LiquidGlassShapeProfile = request.shapeProfile ?? 'bezel';
  const includeSpecular = request.includeSpecular ?? shapeProfile !== 'lens';
  const includeCaustic = request.includeCaustic ?? shapeProfile !== 'lens';
  const { tuning } = request;
  const rawDpr = request.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const scaleFactor = Math.max(1, Math.min(2, rawDpr >= 1.5 ? 2 : 1));

  const cacheKey = [
    width,
    height,
    radius,
    shapeProfile,
    includeSpecular ? 1 : 0,
    includeCaustic ? 1 : 0,
    tuning.ior.toFixed(2),
    tuning.bezelWidth.toFixed(1),
    tuning.thickness.toFixed(1),
    tuning.dispersion.toFixed(2),
    scaleFactor,
  ].join('|');

  const cached = mapCache.get(cacheKey);
  if (cached) {
    mapCache.delete(cacheKey);
    mapCache.set(cacheKey, cached);
    return cached;
  }

  try {
    const canvasW = Math.max(1, Math.round(width * scaleFactor));
    const canvasH = Math.max(1, Math.round(height * scaleFactor));

    const createCanvasSlot = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      return { canvas, ctx, image: ctx.createImageData(canvasW, canvasH) };
    };

    const dispSlot = createCanvasSlot();
    if (!dispSlot) return null;
    const specSlot = includeSpecular ? createCanvasSlot() : null;
    const causticSlot = includeCaustic ? createCanvasSlot() : null;
    if ((includeSpecular && !specSlot) || (includeCaustic && !causticSlot)) {
      return null;
    }

    const dispData = dispSlot.image.data;
    const specData = specSlot?.image.data ?? null;
    const causticData = causticSlot?.image.data ?? null;

    const cx = width / 2;
    const cy = height / 2;
    let resolvedMaxDisplacement = 0.001;

    if (shapeProfile === 'lens') {
      const lensRadius = Math.max(4, Math.min(width, height) / 2);
      const { displacements, maxDisplacement } = computeSphericalLensProfile(
        128,
        tuning.ior,
        lensRadius,
        tuning.thickness
      );
      resolvedMaxDisplacement = maxDisplacement;

      for (let py = 0; py < canvasH; py++) {
        const y = (py + 0.5) / scaleFactor - cy;

        for (let px = 0; px < canvasW; px++) {
          const x = (px + 0.5) / scaleFactor - cx;
          const dist = Math.hypot(x, y);
          const offset = (py * canvasW + px) * 4;

          if (dist > 1e-5) {
            // Clamp r to [0, 1] into corner pixels so <feImage> bilinear sampling never creates a circular border halo.
            const r = Math.min(1, dist / lensRadius);
            const disp = sampleProfile(displacements, r, true);
            const dx = -(x / dist) * disp;
            const dy = -(y / dist) * disp;

            dispData[offset] = clampByte(128 + (dx / maxDisplacement) * 127);
            dispData[offset + 1] = clampByte(128 + (dy / maxDisplacement) * 127);
            dispData[offset + 2] = 128;
            dispData[offset + 3] = 255;
          } else {
            dispData[offset] = 128;
            dispData[offset + 1] = 128;
            dispData[offset + 2] = 128;
            dispData[offset + 3] = 255;
          }
        }
      }
    } else {
      const effectiveBezel = Math.max(3, Math.min(tuning.bezelWidth, Math.min(width, height) * 0.49));
      const { displacements, maxDisplacement } = computeRefractionProfile(
        128,
        tuning.ior,
        effectiveBezel,
        tuning.thickness
      );
      resolvedMaxDisplacement = maxDisplacement;

      const bx = cx - radius;
      const by = cy - radius;
      const dispersionAmt = Math.max(0, Math.min(1, tuning.dispersion));

      for (let py = 0; py < canvasH; py++) {
        const cssY = (py + 0.5) / scaleFactor;
        const y = cssY - cy;
        const absY = Math.abs(y);
        const qy = absY - by;
        const ay = qy > 0 ? qy : 0;
        const signY = y < 0 ? -1 : 1;

        for (let px = 0; px < canvasW; px++) {
          const cssX = (px + 0.5) / scaleFactor;
          const x = cssX - cx;
          const absX = Math.abs(x);
          const qx = absX - bx;
          const ax = qx > 0 ? qx : 0;
          const signX = x < 0 ? -1 : 1;

          const outsideLen = Math.hypot(ax, ay);
          const insideDist = Math.min(Math.max(qx, qy), 0);
          const sd = outsideLen + insideDist - radius;
          const distFromEdge = -sd;

          const offset = (py * canvasW + px) * 4;

          if (distFromEdge > 0 && distFromEdge < effectiveBezel) {
            let nx = 0;
            let ny = 0;
            if (outsideLen > 1e-5) {
              nx = (signX * ax) / outsideLen;
              ny = (signY * ay) / outsideLen;
            } else if (qx > qy) {
              nx = signX;
            } else {
              ny = signY;
            }

            const t = distFromEdge / effectiveBezel;
            const disp = sampleProfile(displacements, t);
            // Sample inward along the negative normal so rays stay inside backdrop bounds.
            const dx = -nx * disp;
            const dy = -ny * disp;

            dispData[offset] = clampByte(128 + (dx / maxDisplacement) * 127);
            dispData[offset + 1] = clampByte(128 + (dy / maxDisplacement) * 127);
            dispData[offset + 2] = 128;
            dispData[offset + 3] = 255;

            if (causticData) {
              // Rim caustic band alpha for kube.io saturated edge glow.
              const causticAlpha = Math.exp(-Math.pow(t / 0.48, 2.1));
              causticData[offset] = 255;
              causticData[offset + 1] = 255;
              causticData[offset + 2] = 255;
              causticData[offset + 3] = clampByte(causticAlpha * 255);
            }

            if (specData) {
              // Razor-sharp outer bevel rim + thicker inner glass wall halo across opposing arcs.
              const sharpRim = Math.exp(-Math.pow((t - 0.06) / 0.075, 2));
              const innerHalo = 0.44 * Math.exp(-Math.pow((t - 0.22) / 0.2, 2));
              const d1 = Math.max(0, nx * -0.68 + ny * -0.73);
              const d2 = Math.max(0, nx * 0.68 + ny * 0.73);
              const lobe = 0.24 + 0.76 * Math.pow(d1, 1.8) + 0.68 * Math.pow(d2, 2.0);
              const alpha = Math.min(1, (sharpRim + innerHalo) * lobe);

              const coolBias = Math.pow(d1, 1.5) * dispersionAmt;
              const warmBias = Math.pow(d2, 1.8) * dispersionAmt;
              specData[offset] = clampByte(255 - coolBias * 26);
              specData[offset + 1] = clampByte(255 - warmBias * 22);
              specData[offset + 2] = clampByte(255 - warmBias * 8);
              specData[offset + 3] = clampByte(alpha * 255);
            }
          } else {
            dispData[offset] = 128;
            dispData[offset + 1] = 128;
            dispData[offset + 2] = 128;
            dispData[offset + 3] = 255;
          }
        }
      }
    }

    const toPngUrl = (slot: NonNullable<ReturnType<typeof createCanvasSlot>> | null) => {
      if (!slot) return '';
      slot.ctx.putImageData(slot.image, 0, 0);
      return slot.canvas.toDataURL('image/png');
    };

    const result: LiquidGlassMapResult = {
      width,
      height,
      radius,
      displacementUrl: toPngUrl(dispSlot),
      specularUrl: toPngUrl(specSlot),
      causticMaskUrl: toPngUrl(causticSlot),
      maxDisplacement: resolvedMaxDisplacement,
    };

    if (mapCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = mapCache.keys().next().value;
      if (oldestKey !== undefined) {
        mapCache.delete(oldestKey);
      }
    }
    mapCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export interface LiquidGlassFilterConfigOptions {
  blurOverridePx?: number;
  scaleMultiplier?: number;
  rimSaturationMultiplier?: number;
  specularOpacityMultiplier?: number;
  disableDispersion?: boolean;
  disableCausticRim?: boolean;
}

/**
 * Computes SVG filter primitive parameters from generated map metadata and user tuning.
 * Multiplies maxDisplacement by 2 so SVG's `(channel - 0.5)` range maps 1:1 to physical pixel shift,
 * with a soft safety bound relative to the element's minor dimension.
 */
export function buildLiquidGlassFilterConfig(
  map: LiquidGlassMapResult,
  tuning: LiquidGlassTuning,
  blurOrOptions?: number | LiquidGlassFilterConfigOptions
): LiquidGlassFilterConfig {
  const opts: LiquidGlassFilterConfigOptions =
    typeof blurOrOptions === 'number' ? { blurOverridePx: blurOrOptions } : blurOrOptions ?? {};
  const scaleMultiplier =
    typeof opts.scaleMultiplier === 'number' && Number.isFinite(opts.scaleMultiplier)
      ? Math.max(0, opts.scaleMultiplier)
      : 1;
  const rimSaturationMultiplier =
    typeof opts.rimSaturationMultiplier === 'number' && Number.isFinite(opts.rimSaturationMultiplier)
      ? Math.max(0.5, opts.rimSaturationMultiplier)
      : 1;
  const specularOpacityMultiplier =
    typeof opts.specularOpacityMultiplier === 'number' &&
    Number.isFinite(opts.specularOpacityMultiplier)
      ? Math.max(0, opts.specularOpacityMultiplier)
      : 1;

  const effectiveStrength = tuning.refractionStrength * scaleMultiplier;
  const rawScale = Math.max(0, map.maxDisplacement * 2 * effectiveStrength);
  const minDim = Math.max(16, Math.min(map.width, map.height));
  const softCap = minDim * 1.45 * Math.max(1, effectiveStrength);
  const scale = Math.min(rawScale, softCap);
  const useDispersion = !opts.disableDispersion && tuning.dispersion > 0.02 && scale > 0.25;
  const useCausticRim = !opts.disableCausticRim;
  const spread = 0.12 * Math.max(0, tuning.dispersion);
  const blurPx = opts.blurOverridePx ?? tuning.heroBlurPx;

  return {
    scale,
    useDispersion,
    useCausticRim,
    rScale: scale * (1 + spread),
    gScale: scale,
    bScale: scale * Math.max(0, 1 - spread),
    blurStdDev: Math.max(0, blurPx * 0.55),
    saturateRatio: Math.max(0.5, tuning.saturatePct / 100),
    rimSaturation: Math.max(1, tuning.rimSaturation * rimSaturationMultiplier),
    specularOpacity: Math.max(0, Math.min(1, tuning.specularOpacity * specularOpacityMultiplier)),
  };
}

/**
 * Clears the cached displacement/specular PNG map entries (mainly useful in tests).
 */
export function clearLiquidGlassMapCache(): void {
  mapCache.clear();
}

const GLASS_SURFACE_SELECTOR =
  '.ve-launcher-btn, .ve-dock-menu, .ve-toolbar, .ve-drawer, .ve-comment-popover, .ve-variant-switcher-bar, .ve-pin-tooltip, .ve-pin, .ve-voice-pin';

const INTERACTIVE_GLASS_SELECTOR =
  '.ve-dock-item, .ve-launcher-btn, .ve-btn, .ve-mini-btn, .ve-tab-btn, .ve-mode-pill, .ve-variant-option-btn, .ve-pin, .ve-voice-pin';

/**
 * Checks the user's reduced-motion OS/browser preference safely.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Computes volume-conserving liquid jelly stretch and subtle momentum tilt from pointer drag velocity.
 */
export function computeLiquidDragDeformation(
  vx: number,
  vy: number
): { scaleX: number; scaleY: number; rotateDeg: number } {
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed) || speed < 0.75) {
    return { scaleX: 1, scaleY: 1, rotateDeg: 0 };
  }

  const normalized = Math.min(1, (speed - 0.75) / 28);
  const eased = Math.sqrt(normalized);
  const absX = Math.abs(vx);
  const absY = Math.abs(vy);
  const dominance = absX + absY > 1e-4 ? (absX - absY) / (absX + absY) : 0;

  const stretch = eased * 0.035 * dominance;
  const scaleX = Math.max(0.965, Math.min(1.035, Math.round((1 + stretch) * 1000) / 1000));
  const scaleY = Math.max(
    0.965,
    Math.min(1.035, Math.round((1 / Math.max(0.85, scaleX)) * 1000) / 1000)
  );
  const rawRot = (vx * 0.04 - vy * 0.015) * (0.4 + 0.6 * eased);
  const rotateDeg = Math.max(-1.4, Math.min(1.4, Math.round(rawRot * 100) / 100));

  return { scaleX, scaleY, rotateDeg };
}

export interface LiquidDragDeformer {
  push: (stepDx: number, stepDy: number) => void;
  clear: () => void;
}

/**
 * Manages smoothed velocity-based liquid jelly deformation on a dragged element
 * and cleans up CSS custom properties when dragging ends.
 */
export function createLiquidDragDeformer(targetEl: HTMLElement): LiquidDragDeformer {
  let vx = 0;
  let vy = 0;
  let rafId: number | null = null;
  let active = true;

  const applyDeformation = () => {
    const { scaleX, scaleY, rotateDeg } = computeLiquidDragDeformation(vx, vy);
    targetEl.style.setProperty('--ve-drag-sx', scaleX.toFixed(3));
    targetEl.style.setProperty('--ve-drag-sy', scaleY.toFixed(3));
    targetEl.style.setProperty('--ve-drag-rot', `${rotateDeg.toFixed(2)}deg`);
  };

  const tickDeform = () => {
    rafId = null;
    if (!active) return;
    applyDeformation();
    vx *= 0.82;
    vy *= 0.82;
    if (Math.hypot(vx, vy) >= 0.35 && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      rafId = window.requestAnimationFrame(tickDeform);
    } else {
      vx = 0;
      vy = 0;
      applyDeformation();
    }
  };

  return {
    push(stepDx: number, stepDy: number) {
      if (prefersReducedMotion()) return;
      active = true;
      vx = vx * 0.45 + stepDx * 0.55;
      vy = vy * 0.45 + stepDy * 0.55;
      if (rafId === null && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        rafId = window.requestAnimationFrame(tickDeform);
      }
    },
    clear() {
      active = false;
      vx = 0;
      vy = 0;
      if (rafId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
      rafId = null;
      targetEl.style.removeProperty('--ve-drag-sx');
      targetEl.style.removeProperty('--ve-drag-sy');
      targetEl.style.removeProperty('--ve-drag-rot');
    },
  };
}

/**
 * Maps local surface pointer coordinates (0..100%) to a Fresnel highlight angle pivoted around 135deg.
 */
export function computeLiquidRimAngle(xPct: number, yPct: number): number {
  const safeX = Number.isFinite(xPct) ? Math.max(0, Math.min(100, xPct)) : 50;
  const safeY = Number.isFinite(yPct) ? Math.max(0, Math.min(100, yPct)) : 50;
  const nx = (safeX - 50) / 50;
  const ny = (safeY - 50) / 50;
  const angle = 135 + nx * 18 - ny * 10;
  return Math.max(107, Math.min(163, Math.round(angle * 10) / 10));
}

/**
 * Delegated Shadow DOM controller driving pointer-tracked specular glints, dynamic Fresnel rim
 * orientation, and CSS touch-point illumination ripples without causing component re-renders.
 */
export function useLiquidGlassMotion(
  shadowRoot: ShadowRoot | null,
  enabled: boolean
): void {
  useEffect(() => {
    if (!shadowRoot) return;

    let rafId: number | null = null;
    let activeSurface: HTMLElement | null = null;
    let pendingPoint: { el: HTMLElement; clientX: number; clientY: number } | null = null;
    const pulseTimers = new Map<HTMLElement, number>();
    let reducedMotion = prefersReducedMotion();
    const motionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const handleMotionChange = (ev: MediaQueryListEvent) => {
      reducedMotion = ev.matches;
    };
    motionQuery?.addEventListener?.('change', handleMotionChange);

    const clearGlint = (el: HTMLElement | null) => {
      if (el) {
        delete el.dataset.veGlint;
      }
    };

    const clearAllPulses = () => {
      pulseTimers.forEach((timerId, el) => {
        window.clearTimeout(timerId);
        delete el.dataset.vePulse;
      });
      pulseTimers.clear();
    };

    if (!enabled) {
      return () => {
        motionQuery?.removeEventListener?.('change', handleMotionChange);
        clearAllPulses();
      };
    }

    const onPointerMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const surface = target?.closest?.(GLASS_SURFACE_SELECTOR) as HTMLElement | null;
      if (!surface) {
        if (activeSurface) {
          clearGlint(activeSurface);
          activeSurface = null;
        }
        pendingPoint = null;
        return;
      }

      if (activeSurface && activeSurface !== surface) {
        clearGlint(activeSurface);
      }
      activeSurface = surface;
      pendingPoint = { el: surface, clientX: e.clientX, clientY: e.clientY };

      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const point = pendingPoint;
        if (!point || !point.el.isConnected) return;
        const { el, clientX, clientY } = point;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        el.style.setProperty('--ve-gx', `${xPct.toFixed(1)}%`);
        el.style.setProperty('--ve-gy', `${yPct.toFixed(1)}%`);
        if (!reducedMotion) {
          el.style.setProperty('--ve-rim-angle', `${computeLiquidRimAngle(xPct, yPct)}deg`);
        }
        el.dataset.veGlint = 'true';
      });
    };

    const onPointerLeave = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingPoint = null;
      clearGlint(activeSurface);
      activeSurface = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (reducedMotion) return;
      const target = e.target as HTMLElement | null;
      const control = target?.closest?.(INTERACTIVE_GLASS_SELECTOR) as HTMLElement | null;
      if (!control) return;

      const rect = control.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const rx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const ry = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        control.style.setProperty('--ve-rx', `${rx.toFixed(1)}%`);
        control.style.setProperty('--ve-ry', `${ry.toFixed(1)}%`);
      }

      const existingTimer = pulseTimers.get(control);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        delete control.dataset.vePulse;
        void control.offsetWidth;
      }
      control.dataset.vePulse = 'true';
      const timerId = window.setTimeout(() => {
        pulseTimers.delete(control);
        delete control.dataset.vePulse;
      }, 420);
      pulseTimers.set(control, timerId);
    };

    shadowRoot.addEventListener('pointermove', onPointerMove as EventListener, { passive: true });
    shadowRoot.addEventListener('pointerleave', onPointerLeave as EventListener);
    shadowRoot.addEventListener('pointerdown', onPointerDown as EventListener, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      motionQuery?.removeEventListener?.('change', handleMotionChange);
      shadowRoot.removeEventListener('pointermove', onPointerMove as EventListener);
      shadowRoot.removeEventListener('pointerleave', onPointerLeave as EventListener);
      shadowRoot.removeEventListener('pointerdown', onPointerDown as EventListener);
      clearGlint(activeSurface);
      clearAllPulses();
    };
  }, [shadowRoot, enabled]);
}
