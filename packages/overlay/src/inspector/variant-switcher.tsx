import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

export function VariantSwitcher() {
  const state = OverlayStateManager.getInstance();
  const [tick, setTick] = useState(0);
  const [dragPositions, setDragPositions] = useState<Record<string, { left: number; top: number }>>({});
  const dragRef = useRef<{ setId: string; startX: number; startY: number; initLeft: number; initTop: number } | null>(null);

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

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { setId, startX, startY, initLeft, initTop } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setDragPositions((prev) => ({
        ...prev,
        [setId]: {
          left: Math.max(10, Math.min(window.innerWidth - 480, initLeft + dx)),
          top: Math.max(10, Math.min(window.innerHeight - 100, initTop + dy)),
        },
      }));
    };

    const onMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const visibleSets = useMemo(() => {
    void tick;
    return state.variantSets.filter((s) => {
      if (s.status !== 'pending' && s.status !== 'decided') return false;
      try {
        return Boolean(document.querySelector(s.targetSelector));
      } catch {
        return false;
      }
    });
  }, [state, tick]);

  // Keyboard navigation: use Alt + Left/Right arrows or focus switcher to switch options, Enter to Pick & Apply
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      // Only handle arrows/enter if Alt/Option is pressed, or if focus/target is inside the variant switcher
      const targetEl = e.target as HTMLElement | null;
      const isInsideSwitcher = Boolean(targetEl?.closest?.('.ve-variant-switcher-bar'));
      const shouldHandle = e.altKey || isInsideSwitcher;
      if (!shouldHandle) return;

      const pendingOnly = visibleSets.filter((s) => s.status === 'pending');
      if (pendingOnly.length === 0) return;
      const primarySet = pendingOnly[0];
      const options: (string | null)[] = [null, ...primarySet.variants.map((v) => v.id)];
      const currentActiveId = state.activeVariantPreview.get(primarySet.id) || null;
      let currentIndex = options.indexOf(currentActiveId);
      if (currentIndex === -1) currentIndex = 0;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % options.length;
        state.previewVariant(primarySet.id, options[nextIndex]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + options.length) % options.length;
        state.previewVariant(primarySet.id, options[prevIndex]);
      } else if (e.key === 'Enter') {
        if (currentActiveId !== null) {
          e.preventDefault();
          state.decideVariant(primarySet.id, currentActiveId);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, visibleSets]);

  if (visibleSets.length === 0) return null;

  // Deduplicate by targetSelector so there is only one active variant switcher per element
  const uniqueBySelector = new Map<string, (typeof visibleSets)[0]>();
  for (const s of visibleSets) {
    uniqueBySelector.set(s.targetSelector, s);
  }
  const setsToRender = Array.from(uniqueBySelector.values());

  return (
    <div class="ve-variant-switcher-layer">
      {setsToRender.map((set) => {
        let rect = { left: 24, top: 72, bottom: 132, width: 260, height: 60 };
        try {
          const el = document.querySelector(set.targetSelector) as HTMLElement | null;
          if (el) {
            const r = el.getBoundingClientRect();
            rect = { left: r.left, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
          }
        } catch {
          // Fall back to default coordinates if targetSelector cannot be queried.
        }

        const activeVarId = state.activeVariantPreview.get(set.id) || null;
        const activeVariant = set.variants.find((v) => v.id === activeVarId);
        const selectedVariant = set.variants.find((v) => v.id === set.selectedVariantId) || activeVariant;

        // Position above element if space allows (>130px from viewport top), otherwise below
        const placeBelow = rect.top < 130;
        const defaultLeft = Math.max(16, Math.min(window.innerWidth - 490, rect.left));
        const customPos = dragPositions[set.id];

        const barLeft = customPos ? customPos.left : defaultLeft;
        const barTop = customPos
          ? customPos.top
          : placeBelow
          ? rect.bottom + 12
          : rect.top - 12;

        return (
          <div key={set.id}>
            {/* Minimal corner brackets offset by 6px so the component boundary is completely visible */}
            <div
              class="ve-variant-bounds"
              style={{
                left: `${rect.left - 6}px`,
                top: `${rect.top - 6}px`,
                width: `${rect.width + 12}px`,
                height: `${rect.height + 12}px`,
              }}
            >
              <div class="ve-variant-corner ve-variant-corner--tl" />
              <div class="ve-variant-corner ve-variant-corner--tr" />
              <div class="ve-variant-corner ve-variant-corner--bl" />
              <div class="ve-variant-corner ve-variant-corner--br" />
            </div>

            {/* Floating Glass Switcher Card */}
            <div
              class="ve-variant-switcher-bar"
              tabIndex={0}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                left: `${barLeft}px`,
                top: `${barTop}px`,
                transform: customPos || placeBelow ? 'none' : 'translateY(-100%)',
              }}
            >
              {/* Row 1: Header (Title, Drag Grip, Shortcut Hint, Close Button) */}
              <div class="ve-variant-header">
                <div
                  class="ve-variant-drag-handle"
                  onMouseDown={(e) => {
                    const barEl = (e.currentTarget as HTMLElement).closest('.ve-variant-switcher-bar') as HTMLElement | null;
                    if (!barEl) return;
                    const bRect = barEl.getBoundingClientRect();
                    dragRef.current = {
                      setId: set.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      initLeft: bRect.left,
                      initTop: bRect.top,
                    };
                  }}
                  title="Drag to reposition variant switcher"
                >
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="#64748b" class="ve-variant-drag-icon">
                    <circle cx="3" cy="3" r="1.5" />
                    <circle cx="7" cy="3" r="1.5" />
                    <circle cx="3" cy="7" r="1.5" />
                    <circle cx="7" cy="7" r="1.5" />
                    <circle cx="3" cy="11" r="1.5" />
                    <circle cx="7" cy="11" r="1.5" />
                  </svg>
                  <span class="ve-variant-title">{set.label}</span>
                </div>

                <div class="ve-variant-header-actions">
                  <button
                    class="ve-variant-close-btn"
                    onClick={() => state.dismissVariantSet(set.id)}
                    title="Dismiss variant switcher"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {set.status === 'decided' ? (
                <div class="ve-variant-decided-row">
                  <div class="ve-variant-decided-info">
                    <span class="ve-variant-applied-badge">Applied</span>
                    <span class="ve-variant-decided-name">
                      {selectedVariant?.name || 'Chosen Option'}
                    </span>
                  </div>

                  <div class="ve-variant-decided-actions">
                    <button
                      class="ve-variant-change-btn"
                      onClick={() => state.revertVariantDecision(set.id)}
                      title="Revert to test different options"
                    >
                      Change Option
                    </button>
                    <button
                      class="ve-variant-delete-btn"
                      onClick={() => state.deleteVariantDecision(set.id)}
                      title="Delete selection and restore original styles"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Row 2: Options to pick from (Clean horizontal pill track with ample breathing room, no cut-offs) */}
                  <div class="ve-variant-options-row">
                    <button
                      class={`ve-variant-option-btn${activeVarId === null ? ' is-selected' : ''}`}
                      onClick={() => state.previewVariant(set.id, null)}
                      title="Original component styles"
                    >
                      Original
                    </button>
                    {set.variants.map((v, idx) => (
                      <button
                        key={v.id}
                        class={`ve-variant-option-btn${activeVarId === v.id ? ' is-selected' : ''}`}
                        onClick={() => state.previewVariant(set.id, v.id)}
                        title={v.rationale}
                      >
                        {idx + 1}. {v.name}
                      </button>
                    ))}
                  </div>

                  {/* Row 3: Detail description and Action button (constant height prevents vertical jumping) */}
                  <div class="ve-variant-footer-row">
                    <span
                      class={`ve-variant-rationale${activeVariant ? ' is-active' : ''}`}
                      title={activeVariant ? activeVariant.rationale : 'Viewing original styles'}
                    >
                      {activeVariant ? activeVariant.rationale : 'Viewing original element styles'}
                    </span>

                    {activeVariant ? (
                      <button
                        class="ve-variant-apply-btn"
                        onClick={() => state.decideVariant(set.id, activeVariant.id)}
                        title="Approve this variant (Enter)"
                      >
                        Pick & Apply
                      </button>
                    ) : (
                      <span class="ve-variant-original-badge">Original</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
