import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

export function CommentPins() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

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

  if (state.annotations.length === 0) return null;

  return (
    <Fragment>
      {state.annotations.map((ann, idx) => {
        let x = 0;
        let y = 0;

        if (ann.targetSelector) {
          try {
            const el = document.querySelector(ann.targetSelector) as HTMLElement | null;
            if (el) {
              const rect = el.getBoundingClientRect();
              x = rect.left + 12;
              y = rect.top + 12;
            }
          } catch (e) {
            // invalid selector fallback
          }
        }

        if (x === 0 && y === 0 && ann.bounds) {
          x = ann.bounds.x + 12;
          y = ann.bounds.y + 12;
        }

        if (x === 0 && y === 0) return null;

        const isHovered = hoveredPinId === ann.id;

        return (
          <div
            key={ann.id}
            class="ve-pin"
            style={{ left: `${x}px`, top: `${y}px` }}
            onMouseEnter={() => setHoveredPinId(ann.id)}
            onMouseLeave={() => setHoveredPinId(null)}
            onClick={(e) => {
              e.stopPropagation();
              state.setDrawerOpen(true);
            }}
          >
            <span>{idx + 1}</span>
            {isHovered && (
              <div class="ve-pin-tooltip">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px' }}>
                  <strong style={{ color: '#a5b4fc', fontSize: '11px' }}>
                    Pin #{idx + 1}
                  </strong>
                  <button
                    style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      color: '#4ade80',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      state.deleteAnnotation(ann.id);
                    }}
                    title="Dismiss and resolve this comment"
                  >
                    ✓ Resolve
                  </button>
                </div>
                <div style={{ color: '#f8fafc', fontSize: '12px' }}>{ann.comment}</div>
              </div>
            )}
          </div>
        );
      })}
    </Fragment>
  );
}
