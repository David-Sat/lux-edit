import { h } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import {
  ElementRectPosition,
  PinAnchorOrigin,
  getPinAnchorOrigin,
  isDocumentScrollTarget,
  locateElementRect,
  locatePinTarget,
} from './pin-position.js';

export function VerificationHalo() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  const anchorRef = useRef<HTMLDivElement>(null);
  const anchorOriginRef = useRef<PinAnchorOrigin>({ left: 0, top: 0 });
  const needsDocScrollSyncRef = useRef(false);

  useEffect(() => {
    let rafId = 0;
    const handleUpdate = () => setTick((t) => t + 1);
    const scheduleSync = () => {
      if (typeof window.requestAnimationFrame !== 'function') {
        handleUpdate();
        return;
      }
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        handleUpdate();
      });
    };

    const handleScroll = (e: Event) => {
      if (isDocumentScrollTarget(e.target) && !needsDocScrollSyncRef.current) {
        return;
      }
      scheduleSync();
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', scheduleSync);
    const unsub = state.subscribe(handleUpdate);

    return () => {
      if (rafId !== 0 && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
      document.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', scheduleSync);
      unsub();
    };
  }, [state]);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const measured = getPinAnchorOrigin(anchorRef.current);
    if (
      Math.abs(measured.left - anchorOriginRef.current.left) > 0.5 ||
      Math.abs(measured.top - anchorOriginRef.current.top) > 0.5
    ) {
      setTick((t) => t + 1);
    }
  }, [state.verificationTargets.length]);

  if (!state.verificationTargets || state.verificationTargets.length === 0) {
    needsDocScrollSyncRef.current = false;
    return null;
  }

  const anchor = getPinAnchorOrigin(anchorRef.current);
  anchorOriginRef.current = anchor;

  let hasDynamicScrollTarget = false;
  const resolvedTargets = state.verificationTargets
    .map((target, idx) => {
      let pos: ElementRectPosition | null = null;

      try {
        const el = document.querySelector(target.selector) as HTMLElement | null;
        if (el) {
          const candidate = locateElementRect(el, anchor);
          if (candidate.viewportRect.width > 0 && candidate.viewportRect.height > 0) {
            pos = candidate;
          }
        }
      } catch {
        // Ignore invalid selector when resolving live halo element; fall back to stored bounds.
      }

      if (!pos && target.bounds) {
        const fallback = locatePinTarget({
          bounds: target.bounds,
          anchor,
          offsetX: 0,
          offsetY: 0,
        });
        if (fallback.found && fallback.rect && fallback.viewportRect) {
          pos = {
            fixed: fallback.fixed,
            dynamicScroll: fallback.dynamicScroll,
            rect: fallback.rect,
            viewportRect: fallback.viewportRect,
          };
        }
      }

      if (!pos) return null;
      if (pos.dynamicScroll) {
        hasDynamicScrollTarget = true;
      }

      return { target, idx, pos };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  needsDocScrollSyncRef.current = hasDynamicScrollTarget;

  return (
    <div class="ve-verification-halo-layer" ref={anchorRef} aria-hidden="true">
      {resolvedTargets.map(({ target, idx, pos }) => {
        const isFetched = target.variant === 'fetched';
        const badgeInside = pos.viewportRect.top < 28 || (!pos.fixed && pos.rect.top < 28);

        return (
          <div
            key={`${target.selector}_${idx}_${pos.fixed ? 'fixed' : 'doc'}`}
            class={`ve-verification-halo-box ${isFetched ? 've-verification-halo-box--fetched' : ''}`}
            style={{
              position: pos.fixed ? 'fixed' : undefined,
              left: `${pos.rect.left - 4}px`,
              top: `${pos.rect.top - 4}px`,
              width: `${pos.rect.width + 8}px`,
              height: `${pos.rect.height + 8}px`,
            }}
          >
            {!isFetched && (
              <div class={`ve-verification-halo-badge ${badgeInside ? 've-verification-halo-badge--inside' : ''}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{target.label || 'Updated by Agent'}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
