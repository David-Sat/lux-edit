import { SourceLocation } from '@visual-edit/core';

export interface PinAnchorOrigin {
  left: number;
  top: number;
}

export interface PinRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ElementRectPosition {
  fixed: boolean;
  dynamicScroll: boolean;
  rect: PinRect;
  viewportRect: PinRect;
}

export interface PinTargetPosition {
  found: boolean;
  fixed: boolean;
  dynamicScroll: boolean;
  x: number;
  y: number;
  viewportX: number;
  viewportY: number;
  rect: PinRect | null;
  viewportRect: PinRect | null;
}

export interface LocatePinTargetOptions {
  targetSelector?: string;
  sourceLoc?: SourceLocation;
  bounds?: { x: number; y: number; width?: number; height?: number };
  anchor: PinAnchorOrigin;
  offsetX?: number;
  offsetY?: number;
}

/**
 * Measures the viewport-relative origin of the document-space pin layer so
 * `rect - anchor` maps cleanly into CSS coordinates even when host body margins or offsets exist.
 */
export function getPinAnchorOrigin(anchorEl: HTMLElement | null): PinAnchorOrigin {
  const scrollX = typeof window !== 'undefined' ? window.scrollX || window.pageXOffset || 0 : 0;
  const scrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;

  if (anchorEl?.isConnected) {
    const r = anchorEl.getBoundingClientRect();
    const docRect =
      typeof document !== 'undefined'
        ? document.documentElement?.getBoundingClientRect()
        : undefined;
    if (
      r.left !== 0 ||
      r.top !== 0 ||
      (docRect !== undefined && (docRect.width > 0 || docRect.height > 0))
    ) {
      return { left: r.left, top: r.top };
    }
  }

  return { left: -scrollX, top: -scrollY };
}

/**
 * Inspects ancestor layout boxes to distinguish viewport-fixed targets from
 * document-flow targets, sticky elements, or nested scroll-container children.
 */
export function inspectElementScrollContext(el: HTMLElement | null): {
  fixed: boolean;
  dynamicScroll: boolean;
} {
  if (!el || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return { fixed: false, dynamicScroll: false };
  }

  let dynamicScroll = false;
  let curr: HTMLElement | null = el;

  while (curr && curr !== document.body && curr !== document.documentElement) {
    const cs = window.getComputedStyle(curr);
    if (cs.position === 'fixed') {
      return { fixed: true, dynamicScroll: false };
    }
    if (cs.position === 'sticky') {
      dynamicScroll = true;
    } else if (curr !== el) {
      const hasScrollOverflowStyle =
        /(auto|scroll|overlay)/.test(cs.overflowY || '') ||
        /(auto|scroll|overlay)/.test(cs.overflowX || '');
      const isScrollableBox =
        curr.scrollHeight > curr.clientHeight + 1 || curr.scrollWidth > curr.clientWidth + 1;
      if (hasScrollOverflowStyle && isScrollableBox) {
        dynamicScroll = true;
      }
    }
    curr = curr.parentElement;
  }

  return { fixed: false, dynamicScroll };
}

function resolveTargetElement(
  targetSelector?: string,
  sourceLoc?: SourceLocation
): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (targetSelector) {
    try {
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      if (el) return el;
    } catch {
      // Ignore invalid selector syntax; fall back to id/xpath/bounds below.
    }
  }

  if (sourceLoc?.id) {
    try {
      const el = document.getElementById(sourceLoc.id);
      if (el) return el;
    } catch {
      // Ignore DOM lookup errors when resolving pin fallback ID.
    }
  }

  if (sourceLoc?.xpath) {
    try {
      const result = document.evaluate(
        sourceLoc.xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      if (result.singleNodeValue instanceof HTMLElement) {
        return result.singleNodeValue;
      }
    } catch {
      // Ignore invalid XPath expressions; fall back to stored bounds below.
    }
  }

  return null;
}

/**
 * Measures an element's layout bounding box in document-anchor (or viewport if fixed) coordinates
 * so highlight boxes, verification halos, and variant bounds scroll in lockstep with page content.
 */
export function locateElementRect(
  el: HTMLElement,
  anchor: PinAnchorOrigin
): ElementRectPosition {
  const r = el.getBoundingClientRect();
  const { fixed, dynamicScroll } = inspectElementScrollContext(el);
  const viewportRect: PinRect = {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  };

  if (fixed) {
    return {
      fixed: true,
      dynamicScroll: false,
      rect: { ...viewportRect },
      viewportRect,
    };
  }

  return {
    fixed: false,
    dynamicScroll,
    rect: {
      top: r.top - anchor.top,
      left: r.left - anchor.left,
      width: r.width,
      height: r.height,
    },
    viewportRect,
  };
}

/**
 * Resolves a pin's anchor-relative (or viewport-relative if fixed) position without
 * clamping at the viewport top edge so pins scroll in exact lockstep with page content.
 */
export function locatePinTarget({
  targetSelector,
  sourceLoc,
  bounds,
  anchor,
  offsetX = 12,
  offsetY = 12,
}: LocatePinTargetOptions): PinTargetPosition {
  const el = resolveTargetElement(targetSelector, sourceLoc);
  if (el) {
    const pos = locateElementRect(el, anchor);
    const viewportX = pos.viewportRect.left + offsetX;
    const viewportY = pos.viewportRect.top + offsetY;

    return {
      found: true,
      fixed: pos.fixed,
      dynamicScroll: pos.dynamicScroll,
      x: pos.rect.left + offsetX,
      y: pos.rect.top + offsetY,
      viewportX,
      viewportY,
      rect: pos.rect,
      viewportRect: pos.viewportRect,
    };
  }

  if (bounds) {
    const scrollX = typeof window !== 'undefined' ? window.scrollX || window.pageXOffset || 0 : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;
    const vpLeft = bounds.x - scrollX;
    const vpTop = bounds.y - scrollY;
    const width = bounds.width || 0;
    const height = bounds.height || 0;

    return {
      found: true,
      fixed: false,
      dynamicScroll: false,
      x: vpLeft - anchor.left + offsetX,
      y: vpTop - anchor.top + offsetY,
      viewportX: vpLeft + offsetX,
      viewportY: vpTop + offsetY,
      rect: {
        top: vpTop - anchor.top,
        left: vpLeft - anchor.left,
        width,
        height,
      },
      viewportRect: {
        top: vpTop,
        left: vpLeft,
        width,
        height,
      },
    };
  }

  return {
    found: false,
    fixed: false,
    dynamicScroll: false,
    x: 0,
    y: 0,
    viewportX: 0,
    viewportY: 0,
    rect: null,
    viewportRect: null,
  };
}

/**
 * Returns true when a scroll event originates from the root document viewport rather than a nested container.
 */
export function isDocumentScrollTarget(target: EventTarget | null): boolean {
  if (typeof window !== 'undefined' && target === window) return true;
  if (typeof document === 'undefined') return false;
  return (
    target === document ||
    target === document.documentElement ||
    target === document.body
  );
}
