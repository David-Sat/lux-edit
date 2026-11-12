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
  }, []);

  if (!state.verificationTargets || state.verificationTargets.length === 0) {
    return null;
  }

  return (
    <div
      class="ve-verification-halo-layer"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 'var(--ve-z-overlay, 999998)',
      }}
    >
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
        } catch {}

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
              position: 'fixed',
              left: `${rect.left - 4}px`,
              top: `${rect.top - 4}px`,
              width: `${rect.width + 8}px`,
              height: `${rect.height + 8}px`,
              border: '2px solid #10b981',
              borderRadius: '8px',
              boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.28), 0 0 24px rgba(16, 185, 129, 0.45)',
              background: 'rgba(16, 185, 129, 0.06)',
              pointerEvents: 'none',
              transition: 'all 0.25s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-24px',
                left: '0',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
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
