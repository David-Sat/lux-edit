/**
 * Shared route normalization and matching utilities for multi-page and SPA overlays.
 */
import { normalizeRoute } from '@visual-edit/core';

export { normalizeRoute };

/**
 * Combines `pathname` and `hash` into a route identifier when hash-based routing (`#/...` or `#!/...`)
 * is active, while ignoring plain in-page `#anchor` fragments.
 */
export function buildRoutePath(pathname: string, hash = ''): string {
  const cleanPath = pathname || '/';
  if (hash && (hash.startsWith('#/') || hash.startsWith('#!/'))) {
    const hashPart = hash.split('?')[0];
    if (cleanPath === '/') return `/${hashPart}`;
    return cleanPath.endsWith('/') ? `${cleanPath}${hashPart}` : `${cleanPath}/${hashPart}`;
  }
  return cleanPath;
}

/**
 * Reads the current logical route from `window.location`.
 */
export function getRouteFromLocation(): string {
  if (typeof window === 'undefined' || !window.location) return '/';
  return buildRoutePath(window.location.pathname, window.location.hash);
}

/**
 * Determines whether an annotation, voice review, or mutation belongs to `currentPath`.
 */
export function isAnnotationOnRoute(
  ann: { pathname?: string; url?: string },
  currentPath: string
): boolean {
  if (!ann.pathname && !ann.url) return true;
  const normCurrent = normalizeRoute(currentPath);

  if (ann.pathname) {
    return normalizeRoute(ann.pathname) === normCurrent;
  }
  if (ann.url) {
    try {
      const u = new URL(ann.url, 'http://localhost');
      return normalizeRoute(buildRoutePath(u.pathname, u.hash)) === normCurrent;
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Schedules a post-navigation DOM re-measure via requestAnimationFrame and a brief
 * MutationObserver so pins snap to elements mounted asynchronously by SPA frameworks.
 */
export function observeNextDomCommit(onCommit: () => void, durationMs = 800): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let rafId = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let observer: MutationObserver | null = null;

  const schedule = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      onCommit();
    });
  };

  schedule();

  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => {
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timerId = setTimeout(() => {
      observer?.disconnect();
      observer = null;
    }, durationMs);
  }

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
    if (observer) observer.disconnect();
  };
}

