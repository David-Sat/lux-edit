export interface RovingArrowOptions {
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  currentEl?: HTMLElement | null;
  onFocusChange?: (el: HTMLElement, index: number) => void;
  stopPropagation?: boolean;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])';

/** Returns the active focused element inside a ShadowRoot or Document. */
export function getShadowActiveElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const root = node.getRootNode?.();
  if (root && 'activeElement' in root) {
    return ((root as Document | ShadowRoot).activeElement as HTMLElement | null) ?? null;
  }
  return typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
}

/** Returns true when `el` is connected, enabled, and not hidden via attributes or CSS. */
export function isElementVisibleAndEnabled(el: HTMLElement): boolean {
  if (!el || !el.isConnected) return false;
  if (el.hasAttribute('disabled') || (el as HTMLButtonElement).disabled) return false;
  if (el.getAttribute('aria-disabled') === 'true') return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hasAttribute('hidden')) return false;

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') {
      return false;
    }
  }

  return true;
}

/** Collects enabled, visible focusable elements inside `container` in DOM order. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
  return candidates.filter((el) => isElementVisibleAndEnabled(el));
}

/**
 * Moves focus between items in response to Arrow/Home/End keys.
 * Returns `true` when the key event was handled.
 */
export function handleRovingArrowKey(
  e: KeyboardEvent,
  items: Array<HTMLElement | null | undefined>,
  options: RovingArrowOptions = {}
): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return false;
  }

  const orientation = options.orientation ?? 'horizontal';
  const loop = options.loop ?? true;

  let action: 'prev' | 'next' | 'first' | 'last' | null = null;
  if (e.key === 'Home') {
    action = 'first';
  } else if (e.key === 'End') {
    action = 'last';
  } else if (orientation === 'horizontal') {
    if (e.key === 'ArrowRight') action = 'next';
    else if (e.key === 'ArrowLeft') action = 'prev';
  } else if (orientation === 'vertical') {
    if (e.key === 'ArrowDown') action = 'next';
    else if (e.key === 'ArrowUp') action = 'prev';
  } else {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') action = 'next';
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') action = 'prev';
  }

  if (!action) {
    return false;
  }

  const enabled = items.filter(
    (item): item is HTMLElement => Boolean(item) && isElementVisibleAndEnabled(item!)
  );
  if (enabled.length === 0) {
    return false;
  }

  const current =
    options.currentEl ??
    getShadowActiveElement(enabled[0]) ??
    (e.target instanceof HTMLElement ? e.target : null);
  const currentIdx = current ? enabled.indexOf(current) : -1;

  let nextIdx: number;
  if (action === 'first') {
    nextIdx = 0;
  } else if (action === 'last') {
    nextIdx = enabled.length - 1;
  } else if (action === 'next') {
    if (currentIdx === -1) {
      nextIdx = 0;
    } else if (loop) {
      nextIdx = (currentIdx + 1) % enabled.length;
    } else {
      nextIdx = Math.min(enabled.length - 1, currentIdx + 1);
    }
  } else {
    if (currentIdx === -1) {
      nextIdx = enabled.length - 1;
    } else if (loop) {
      nextIdx = (currentIdx - 1 + enabled.length) % enabled.length;
    } else {
      nextIdx = Math.max(0, currentIdx - 1);
    }
  }

  const target = enabled[nextIdx];
  if (!target) {
    return false;
  }

  e.preventDefault();
  if (options.stopPropagation !== false) {
    e.stopPropagation();
  }
  target.focus({ preventScroll: true });
  options.onFocusChange?.(target, nextIdx);
  return true;
}

/**
 * Keeps `Tab` / `Shift+Tab` cycling cleanly within a dialog container (`CommentComposer`).
 * Returns `true` when focus was explicitly wrapped at the container boundary.
 */
export function handleContainerTabLoop(
  e: KeyboardEvent,
  container: HTMLElement | null
): boolean {
  if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || !container) {
    return false;
  }

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    return false;
  }

  if (focusables.length === 1) {
    e.preventDefault();
    e.stopPropagation();
    focusables[0].focus({ preventScroll: true });
    return true;
  }

  const active = getShadowActiveElement(container);
  const idx = active ? focusables.indexOf(active) : -1;

  if (e.shiftKey) {
    if (idx <= 0) {
      e.preventDefault();
      e.stopPropagation();
      focusables[focusables.length - 1].focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  if (idx === -1 || idx >= focusables.length - 1) {
    e.preventDefault();
    e.stopPropagation();
    focusables[0].focus({ preventScroll: true });
    return true;
  }

  return false;
}

/** Returns true if an editable control (`INPUT`, `TEXTAREA`, `SELECT`, or `contentEditable`) is in `e.composedPath()`. */
export function isEditableTargetInPath(e: Event, stopNode?: EventTarget): boolean {
  try {
    const path = e.composedPath ? e.composedPath() : e.target ? [e.target] : [];
    for (const node of path) {
      if (stopNode && node === stopNode) break;
      const el = node as HTMLElement | null;
      if (!el || !el.tagName) continue;
      const tag = el.tagName.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
        return true;
      }
    }
  } catch {
    // Ignore cross-origin / detached composedPath errors.
  }
  return false;
}

/** Returns true when a keyboard event originates from an active hotkey capture control inside Shadow DOM. */
export function isHotkeyCaptureTarget(e: Event): boolean {
  try {
    const path = e.composedPath ? e.composedPath() : e.target ? [e.target] : [];
    for (const node of path) {
      const el = node as HTMLElement | null;
      if (!el || !el.getAttribute) continue;
      if (el.getAttribute('data-ve-hotkey-capture') === 'true') {
        return true;
      }
    }
  } catch {
    // Ignore detached composedPath errors.
  }
  return false;
}
