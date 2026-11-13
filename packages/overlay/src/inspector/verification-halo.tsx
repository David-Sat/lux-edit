import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

export function VerificationHalo() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);
    const unsub = state.subscribe(handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
      unsub();
    };
  }, [state]);

  if (!state.verificationTargets || state.verificationTargets.length === 0) {
    return null;
  }

  return (
    <div class="ve-verification-halo-layer">
      {state.verificationTargets.map((target, idx) => {
        let rect: { left: number; top: number; width: number; height: number } | null = null;
        try {
          const el = document.querySelector(target.selector) as HTMLElement | null;
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              rect = { left: r.left, top: r.top, width: r.width, height: r.height };
            }
          }
        } catch {
          // Ignore invalid selector when resolving live halo element; fall back to stored bounds.
        }

        if (!rect && target.bounds) {
          rect = {
            left: target.bounds.x - window.scrollX,
            top: target.bounds.y - window.scrollY,
            width: target.bounds.width,
            height: target.bounds.height,
          };
        }

        if (!rect) return null;

        return (
          <div
            key={`${target.selector}_${idx}`}
            class="ve-verification-halo-box"
            style={{
              left: `${rect.left - 4}px`,
              top: `${rect.top - 4}px`,
              width: `${rect.width + 8}px`,
              height: `${rect.height + 8}px`,
            }}
          >
            <div class="ve-verification-halo-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{target.label || 'Updated by Agent'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
