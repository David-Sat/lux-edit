export const INSPECT_DISABLED_STYLE_ATTR = 'data-lux-inspect-disabled';

export const INSPECT_DISABLED_STYLE_CSS = `
button:disabled,
input:disabled,
select:disabled,
textarea:disabled,
[disabled]:not(fieldset),
[aria-disabled="true"] {
  pointer-events: none !important;
}
`.trim();

const DISABLED_CONTROL_SELECTOR =
  'button:disabled, input:disabled, select:disabled, textarea:disabled, [disabled]:not(fieldset), [aria-disabled="true"]';
const POINTER_NONE_DESCENDANT_SELECTOR = 'button, input, select, textarea, a, [role="button"]';
const POINTER_NONE_DOCUMENT_SELECTOR = 'button, input, select, textarea, [role="button"]';

/** Returns true if an element is natively disabled, inside a disabled fieldset, or aria-disabled. */
export function isDisabledElement(el: Element | null): boolean {
  if (!el) return false;
  if (el.getAttribute('aria-disabled') === 'true') return true;

  const tag = el.tagName.toLowerCase();
  if (tag !== 'fieldset') {
    if (el.hasAttribute('disabled')) return true;
    try {
      if (el.matches(':disabled')) return true;
    } catch {
      // Ignore environments with incomplete pseudo-class support.
    }

    if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') {
      const disabledFieldset = el.closest('fieldset[disabled]');
      if (disabledFieldset) {
        const firstLegend = Array.from(disabledFieldset.children).find(
          (child) => child.tagName.toLowerCase() === 'legend'
        );
        if (!firstLegend || !firstLegend.contains(el)) {
          return true;
        }
      }
    }
  }

  return false;
}

function isTopmostAtPoint(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  rawTarget: HTMLElement | null
): boolean {
  const canAcceptFallback =
    !rawTarget ||
    rawTarget === el ||
    rawTarget.contains(el) ||
    rawTarget === document.body ||
    rawTarget === document.documentElement;

  if (typeof document.elementFromPoint !== 'function') {
    return canAcceptFallback;
  }

  const hadStyleAttr = el.hasAttribute('style');
  const prevVal = el.style.getPropertyValue('pointer-events');
  const prevPriority = el.style.getPropertyPriority('pointer-events');

  try {
    el.style.setProperty('pointer-events', 'auto', 'important');
    const hit = document.elementFromPoint(clientX, clientY);
    if (hit !== null) {
      return hit === el || el.contains(hit);
    }
    return canAcceptFallback;
  } finally {
    if (prevVal) {
      el.style.setProperty('pointer-events', prevVal, prevPriority);
    } else {
      el.style.removeProperty('pointer-events');
    }
    if (!hadStyleAttr && !prevVal && !el.getAttribute('style')?.trim()) {
      el.removeAttribute('style');
    }
  }
}

/**
 * Resolves the intended inspection target under a MouseEvent, recovering deactivated
 * (disabled / aria-disabled / pointer-events: none) controls that the browser's
 * hit-testing skipped or passed through.
 */
export function resolveInspectTarget(
  e: MouseEvent,
  isOverlayNode?: (el: Element) => boolean
): HTMLElement | null {
  const eventTarget = e.target as Node | null;
  const rawTarget: HTMLElement | null =
    eventTarget instanceof Element
      ? (eventTarget as HTMLElement)
      : eventTarget?.nodeType === Node.TEXT_NODE && eventTarget.parentElement instanceof Element
        ? (eventTarget.parentElement as HTMLElement)
        : null;

  if (typeof document === 'undefined') {
    return rawTarget;
  }

  const candidates = new Set<HTMLElement>();

  // Tier 1: document-wide explicitly disabled controls (native disabled or aria-disabled)
  try {
    for (const el of document.querySelectorAll(DISABLED_CONTROL_SELECTOR)) {
      if (el instanceof HTMLElement) {
        candidates.add(el);
      }
    }
  } catch {
    // Ignore selector failures in restricted DOM environments.
  }

  // Tier 2: CSS-only pointer-events: none interactive controls under the hit container
  if (rawTarget && rawTarget !== document.body && rawTarget !== document.documentElement) {
    for (const el of rawTarget.querySelectorAll(POINTER_NONE_DESCENDANT_SELECTOR)) {
      if (el instanceof HTMLElement) {
        candidates.add(el);
      }
    }
  } else {
    for (const el of document.querySelectorAll(POINTER_NONE_DOCUMENT_SELECTOR)) {
      if (el instanceof HTMLElement) {
        candidates.add(el);
      }
    }
    if (document.body) {
      for (const child of document.body.children) {
        if (child.tagName.toLowerCase() === 'a' && child instanceof HTMLElement) {
          candidates.add(child);
        }
      }
    }
  }

  const matching: HTMLElement[] = [];
  for (const el of candidates) {
    if (el === document.body || el === document.documentElement) continue;
    if (isOverlayNode?.(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      continue;
    }

    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const opacity = parseFloat(cs.opacity || '1');
    if (Number.isFinite(opacity) && opacity <= 0) continue;

    if (cs.pointerEvents !== 'none' && !isDisabledElement(el)) continue;

    matching.push(el);
  }

  if (matching.length === 0) {
    return rawTarget;
  }

  // Prefer deepest/innermost descendants first; for non-nested overlaps, prefer later DOM order.
  matching.sort((a, b) => {
    if (a.contains(b)) return 1;
    if (b.contains(a)) return -1;
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return 1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return -1;
    return 0;
  });

  for (const el of matching) {
    if (isTopmostAtPoint(el, e.clientX, e.clientY, rawTarget)) {
      return el;
    }
  }

  return rawTarget;
}
