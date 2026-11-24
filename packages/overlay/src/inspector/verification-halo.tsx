import { h } from 'preact';
import { OverlayStateManager } from './state.js';
import {
  ElementRectPosition,
  locateElementRect,
  locatePinTarget,
  useAnchoredOverlaySync,
} from './pin-position.js';

export function VerificationHalo() {
  const state = OverlayStateManager.getInstance();
  const { anchorRef, needsDocScrollSyncRef, measureAnchor } = useAnchoredOverlaySync({
    state,
    anchorKey: state.verificationTargets.length,
  });

  if (!state.verificationTargets || state.verificationTargets.length === 0) {
    needsDocScrollSyncRef.current = false;
    return null;
  }

  const anchor = measureAnchor();

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
