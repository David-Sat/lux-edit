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
                <strong style={{ color: '#a5b4fc', display: 'block', marginBottom: '2px' }}>
                  Pin #{idx + 1}
                </strong>
                {ann.comment}
              </div>
            )}
          </div>
        );
      })}
    </Fragment>
  );
}
