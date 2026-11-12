import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

export function VariantSwitcher() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
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
  }, []);

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

  const visibleSets = state.variantSets.filter((s) => {
    if (s.status !== 'pending' && s.status !== 'decided') return false;
    try {
      return Boolean(document.querySelector(s.targetSelector));
    } catch {
      return false;
    }
  });

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
  }, [visibleSets]);

  if (visibleSets.length === 0) return null;

  // Deduplicate by targetSelector so there is only one active variant switcher per element
  const uniqueBySelector = new Map<string, (typeof visibleSets)[0]>();
  for (const s of visibleSets) {
    uniqueBySelector.set(s.targetSelector, s);
  }
  const setsToRender = Array.from(uniqueBySelector.values());

  return (
    <div
      class="ve-variant-switcher-layer"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 'var(--ve-z-toolbar, 999999)',
      }}
    >
      {setsToRender.map((set) => {
        let rect = { left: 24, top: 72, bottom: 132, width: 260, height: 60 };
        try {
          const el = document.querySelector(set.targetSelector) as HTMLElement | null;
          if (el) {
            const r = el.getBoundingClientRect();
            rect = { left: r.left, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
          }
        } catch {}

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
              style={{
                position: 'fixed',
                left: `${rect.left - 6}px`,
                top: `${rect.top - 6}px`,
                width: `${rect.width + 12}px`,
                height: `${rect.height + 12}px`,
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, width: '7px', height: '7px', borderTop: '1.5px solid rgba(255, 255, 255, 0.45)', borderLeft: '1.5px solid rgba(255, 255, 255, 0.45)', borderTopLeftRadius: '2px' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '7px', height: '7px', borderTop: '1.5px solid rgba(255, 255, 255, 0.45)', borderRight: '1.5px solid rgba(255, 255, 255, 0.45)', borderTopRightRadius: '2px' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '7px', height: '7px', borderBottom: '1.5px solid rgba(255, 255, 255, 0.45)', borderLeft: '1.5px solid rgba(255, 255, 255, 0.45)', borderBottomLeftRadius: '2px' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '7px', height: '7px', borderBottom: '1.5px solid rgba(255, 255, 255, 0.45)', borderRight: '1.5px solid rgba(255, 255, 255, 0.45)', borderBottomRightRadius: '2px' }} />
            </div>

            {/* Floating Glass Switcher Card */}
            <div
              class="ve-variant-switcher-bar"
              tabIndex={0}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: `${barLeft}px`,
                top: `${barTop}px`,
                transform: customPos || placeBelow ? 'none' : 'translateY(-100%)',
                pointerEvents: 'auto',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '8px 12px',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '470px',
                maxWidth: 'calc(100vw - 32px)',
                boxSizing: 'border-box',
                color: '#f8fafc',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                userSelect: 'none',
              }}
            >
              {/* Row 1: Header (Title, Drag Grip, Shortcut Hint, Close Button) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'grab', flexShrink: 0 }}
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
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="#64748b" style={{ flexShrink: 0 }}>
                    <circle cx="3" cy="3" r="1.5" />
                    <circle cx="7" cy="3" r="1.5" />
                    <circle cx="3" cy="7" r="1.5" />
                    <circle cx="7" cy="7" r="1.5" />
                    <circle cx="3" cy="11" r="1.5" />
                    <circle cx="7" cy="11" r="1.5" />
                  </svg>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#f1f5f9',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {set.label}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '2px 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#6ee7b7',
                        border: '1px solid rgba(52, 211, 153, 0.35)',
                        flexShrink: 0,
                      }}
                    >
                      Applied
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#f8fafc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedVariant?.name || 'Chosen Option'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid rgba(96, 165, 250, 0.4)',
                        color: '#93c5fd',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
                      onClick={() => state.revertVariantDecision(set.id)}
                      title="Revert to test different options"
                    >
                      Change Option
                    </button>
                    <button
                      style={{
                        background: 'rgba(239, 68, 68, 0.18)',
                        border: '1px solid rgba(248, 113, 113, 0.35)',
                        color: '#fca5a5',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                    }}
                  >
                    <button
                      style={{
                        background: activeVarId === null ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                        border: activeVarId === null ? '1px solid rgba(255, 255, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: activeVarId === null ? '#ffffff' : '#94a3b8',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: activeVarId === null ? '0 2px 6px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : 'none',
                        transition: 'all 0.1s ease',
                        flex: '1 1 0',
                        textAlign: 'center',
                      }}
                      onClick={() => state.previewVariant(set.id, null)}
                      title="Original component styles"
                    >
                      Original
                    </button>
                    {set.variants.map((v, idx) => {
                      const isSelected = activeVarId === v.id;
                      return (
                        <button
                          key={v.id}
                          style={{
                            background: isSelected ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                            border: isSelected ? '1px solid rgba(255, 255, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: isSelected ? '#ffffff' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : 'none',
                            transition: 'all 0.1s ease',
                            flex: '1 1 0',
                            textAlign: 'center',
                          }}
                          onClick={() => state.previewVariant(set.id, v.id)}
                          title={v.rationale}
                        >
                          {idx + 1}. {v.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Row 3: Detail description and Action button (constant height prevents vertical jumping) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingTop: '6px',
                      minHeight: '26px',
                      height: '26px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: activeVariant ? '#cbd5e1' : '#64748b',
                        fontStyle: activeVariant ? 'normal' : 'italic',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={activeVariant ? activeVariant.rationale : 'Viewing original styles'}
                    >
                      {activeVariant ? activeVariant.rationale : 'Viewing original element styles'}
                    </span>

                    {activeVariant ? (
                      <button
                        style={{
                          background: 'rgba(16, 185, 129, 0.22)',
                          border: '1px solid rgba(52, 211, 153, 0.45)',
                          borderRadius: '6px',
                          color: '#6ee7b7',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 10px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.18)',
                          transition: 'all 0.1s ease',
                          flexShrink: 0,
                        }}
                        onClick={() => state.decideVariant(set.id, activeVariant.id)}
                        title="Approve this variant (Enter)"
                      >
                        Pick & Apply
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#475569',
                          fontWeight: 500,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          flexShrink: 0,
                        }}
                      >
                        Original
                      </span>
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
