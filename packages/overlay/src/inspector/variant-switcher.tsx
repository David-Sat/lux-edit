import { h } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { locateElementRect, useAnchoredOverlaySync } from './pin-position.js';
import { GlassChrome } from './liquid-glass-defs.js';
import {
  handleRovingArrowKey,
  isEditableTargetInPath,
  isHotkeyCaptureTarget,
} from './keyboard-nav.js';

const REDUNDANT_OPTION_PREFIX_RE =
  /^(?:option\s+[a-z0-9]+\s*[:.\-–—]\s*|\d+(?:\s*[.):]\s+|\s+[-–—]\s+))/i;

/** Formats a variant option pill label as `N. Name`, stripping redundant numbering or "Option A:" prefixes. */
export function formatVariantOptionLabel(name: string, index: number): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return `${index + 1}. Option ${index + 1}`;
  }
  const stripped = trimmed.replace(REDUNDANT_OPTION_PREFIX_RE, '').trim();
  return `${index + 1}. ${stripped || trimmed}`;
}

/** Computes viewport-clamped `left` and `top` coordinates for the Variant Switcher card. */
export function computeVariantSwitcherPosition(params: {
  rect: { left: number; top: number; bottom: number; width: number; height: number };
  barWidth: number;
  barHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  gap?: number;
}): { left: number; top: number; placement: 'above' | 'below' | 'clamped' } {
  const { rect, barWidth, barHeight, viewportWidth, viewportHeight, margin = 16, gap = 12 } = params;
  const maxLeft = Math.max(margin, viewportWidth - barWidth - margin);
  const left = Math.max(margin, Math.min(maxLeft, rect.left));
  const maxTop = Math.max(margin, viewportHeight - barHeight - margin);

  if (rect.top - gap - barHeight >= margin) {
    return { left, top: rect.top - gap - barHeight, placement: 'above' };
  }
  if (rect.bottom + gap + barHeight <= viewportHeight - margin) {
    return { left, top: rect.bottom + gap, placement: 'below' };
  }
  return { left, top: Math.max(margin, Math.min(maxTop, rect.top + gap)), placement: 'clamped' };
}

export function VariantSwitcher() {
  const state = OverlayStateManager.getInstance();
  const [dragPositions, setDragPositions] = useState<Record<string, { left: number; top: number }>>({});
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, { width: number; height: number }>>({});
  const barRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRef = useRef<{
    setId: string;
    startX: number;
    startY: number;
    initLeft: number;
    initTop: number;
    barWidth: number;
    barHeight: number;
  } | null>(null);

  const variantSetsKey = state.variantSets
    .map((s) => `${s.id}:${s.status}:${s.variants.map((v) => v.name).join('|')}`)
    .join(';');

  const { tick, anchorRef, measureAnchor } = useAnchoredOverlaySync({
    state,
    anchorKey: variantSetsKey,
    syncOnDocumentScroll: true,
  });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { setId, startX, startY, initLeft, initTop, barWidth, barHeight } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const maxLeft = Math.max(10, window.innerWidth - barWidth - 10);
      const maxTop = Math.max(10, window.innerHeight - barHeight - 10);
      setDragPositions((prev) => ({
        ...prev,
        [setId]: {
          left: Math.max(10, Math.min(maxLeft, initLeft + dx)),
          top: Math.max(10, Math.min(maxTop, initTop + dy)),
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

  // Deduplicate by targetSelector so there is only one active variant switcher per element
  const setsToRender = useMemo(() => {
    const uniqueBySelector = new Map<string, (typeof visibleSets)[0]>();
    for (const s of visibleSets) {
      uniqueBySelector.set(s.targetSelector, s);
    }
    return Array.from(uniqueBySelector.values());
  }, [visibleSets]);

  const setsLayoutKey = setsToRender
    .map((s) => `${s.id}:${s.status}:${s.variants.map((v) => v.name).join('|')}`)
    .join(';');

  useLayoutEffect(() => {
    setMeasuredSizes((prev) => {
      let changed = false;
      const next: Record<string, { width: number; height: number }> = { ...prev };
      const activeIds = new Set(setsToRender.map((s) => s.id));
      for (const existingId of Object.keys(next)) {
        if (!activeIds.has(existingId)) {
          delete next[existingId];
          changed = true;
        }
      }
      for (const s of setsToRender) {
        const el = barRefs.current[s.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const w = r.width || el.offsetWidth;
        const h = r.height || el.offsetHeight;
        if (w <= 0 || h <= 0) continue;
        const old = prev[s.id];
        if (!old || Math.abs(old.width - w) > 1 || Math.abs(old.height - h) > 1) {
          next[s.id] = { width: w, height: h };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [setsLayoutKey, tick, setsToRender]);

  // Keyboard navigation: use Alt + Left/Right arrows or focus switcher to switch options, Enter to Pick & Apply
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isHotkeyCaptureTarget(e) || isEditableTargetInPath(e)) {
        return;
      }
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Only handle arrows/enter if Alt/Option is pressed, or if focus/target is inside the variant switcher
      const path = e.composedPath ? e.composedPath() : e.target ? [e.target] : [];
      const isInsideSwitcher = path.some(
        (node) => node instanceof HTMLElement && node.classList?.contains('ve-variant-switcher-bar')
      );
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

  if (setsToRender.length === 0) return null;

  const vw = window.innerWidth || document.documentElement.clientWidth || 1000;
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;
  const anchor = measureAnchor();

  return (
    <div class="ve-variant-switcher-layer" ref={anchorRef}>
      {setsToRender.map((set) => {
        let viewportRect = { left: 24, top: 72, bottom: 132, width: 260, height: 60 };
        let boundsRect = {
          left: viewportRect.left - anchor.left,
          top: viewportRect.top - anchor.top,
          width: viewportRect.width,
          height: viewportRect.height,
        };
        let boundsFixed = false;

        try {
          const el = document.querySelector(set.targetSelector) as HTMLElement | null;
          if (el) {
            const measuredPos = locateElementRect(el, anchor);
            boundsFixed = measuredPos.fixed;
            boundsRect = measuredPos.rect;
            viewportRect = {
              left: measuredPos.viewportRect.left,
              top: measuredPos.viewportRect.top,
              bottom: measuredPos.viewportRect.top + measuredPos.viewportRect.height,
              width: measuredPos.viewportRect.width,
              height: measuredPos.viewportRect.height,
            };
          }
        } catch {
          // Fall back to default coordinates if targetSelector cannot be queried.
        }

        const activeVarId = state.activeVariantPreview.get(set.id) || null;
        const activeVariant = set.variants.find((v) => v.id === activeVarId);
        const selectedVariant = set.variants.find((v) => v.id === set.selectedVariantId) || activeVariant;

        const fallbackWidth = Math.min(470, Math.max(200, vw - 32));
        const hasManyOrLongOptions =
          set.variants.length > 2 || set.variants.some((v) => v.name.length > 16);
        const fallbackHeight = set.status === 'decided' ? 88 : hasManyOrLongOptions ? 156 : 120;
        const measured = measuredSizes[set.id];
        const barWidth = measured?.width || fallbackWidth;
        const barHeight = measured?.height || fallbackHeight;

        const customPos = dragPositions[set.id];
        const computed = computeVariantSwitcherPosition({
          rect: viewportRect,
          barWidth,
          barHeight,
          viewportWidth: vw,
          viewportHeight: vh,
        });

        const barLeft = customPos ? customPos.left : computed.left;
        const barTop = customPos ? customPos.top : computed.top;

        return (
          <div key={set.id}>
            {/* Minimal corner brackets offset by 6px so the component boundary is completely visible */}
            <div
              class="ve-variant-bounds"
              aria-hidden="true"
              style={{
                position: boundsFixed ? 'fixed' : undefined,
                left: `${boundsRect.left - 6}px`,
                top: `${boundsRect.top - 6}px`,
                width: `${boundsRect.width + 12}px`,
                height: `${boundsRect.height + 12}px`,
              }}
            >
              <div class="ve-variant-corner ve-variant-corner--tl" />
              <div class="ve-variant-corner ve-variant-corner--tr" />
              <div class="ve-variant-corner ve-variant-corner--bl" />
              <div class="ve-variant-corner ve-variant-corner--br" />
            </div>

            {/* Floating Glass Switcher Card */}
            <div
              ref={(el) => {
                barRefs.current[set.id] = el;
              }}
              role="region"
              aria-label={`Variant options for ${set.label}`}
              class="ve-variant-switcher-bar"
              tabIndex={0}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                left: `${barLeft}px`,
                top: `${barTop}px`,
              }}
            >
              <GlassChrome />
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
                      barWidth: bRect.width || barEl.offsetWidth || barWidth,
                      barHeight: bRect.height || barEl.offsetHeight || barHeight,
                    };
                  }}
                  title="Drag to reposition variant switcher"
                >
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" class="ve-variant-drag-icon" aria-hidden="true">
                    <circle cx="3" cy="3" r="1.5" />
                    <circle cx="7" cy="3" r="1.5" />
                    <circle cx="3" cy="7" r="1.5" />
                    <circle cx="7" cy="7" r="1.5" />
                    <circle cx="3" cy="11" r="1.5" />
                    <circle cx="7" cy="11" r="1.5" />
                  </svg>
                  <span class="ve-variant-title" title={set.label}>{set.label}</span>
                </div>

                <div class="ve-variant-header-actions">
                  <button
                    type="button"
                    class="ve-variant-close-btn"
                    onClick={() => state.dismissVariantSet(set.id)}
                    aria-label={`Dismiss variant switcher for ${set.label}`}
                    title="Dismiss variant switcher"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
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
                    <span
                      class="ve-variant-decided-name"
                      title={selectedVariant?.name || 'Chosen Option'}
                    >
                      {selectedVariant?.name || 'Chosen Option'}
                    </span>
                  </div>

                  <div class="ve-variant-decided-actions">
                    <button
                      type="button"
                      class="ve-variant-change-btn"
                      onClick={() => state.revertVariantDecision(set.id)}
                      aria-label={`Change selected variant for ${set.label}`}
                      title="Revert to test different options"
                    >
                      Change Option
                    </button>
                    <button
                      type="button"
                      class="ve-variant-delete-btn"
                      onClick={() => state.deleteVariantDecision(set.id)}
                      aria-label={`Delete variant selection for ${set.label}`}
                      title="Delete selection and restore original styles"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Row 2: Options to pick from (multi-line flex-wrap pills with clamped labels) */}
                  <div
                    class="ve-variant-options-row"
                    role="radiogroup"
                    aria-label="Variant options"
                    onKeyDown={(e) => {
                      const optionBtns = Array.from(
                        (e.currentTarget as HTMLElement).querySelectorAll('.ve-variant-option-btn')
                      ) as HTMLElement[];
                      const optionIds: (string | null)[] = [null, ...set.variants.map((v) => v.id)];
                      const handled = handleRovingArrowKey(e, optionBtns, {
                        orientation: 'both',
                        loop: true,
                        onFocusChange: (_btn, nextIdx) => {
                          if (nextIdx >= 0 && nextIdx < optionIds.length) {
                            state.previewVariant(set.id, optionIds[nextIdx]);
                          }
                        },
                      });
                      if (!handled && e.key === 'Enter' && activeVarId !== null) {
                        e.preventDefault();
                        e.stopPropagation();
                        state.decideVariant(set.id, activeVarId);
                      }
                    }}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={activeVarId === null}
                      class={`ve-variant-option-btn${activeVarId === null ? ' is-selected' : ''}`}
                      onClick={() => state.previewVariant(set.id, null)}
                      title="Original component styles"
                    >
                      <span class="ve-variant-option-label">Original</span>
                    </button>
                    {set.variants.map((v, idx) => {
                      const optionLabel = formatVariantOptionLabel(v.name, idx);
                      const optionTooltip = v.rationale ? `${optionLabel} — ${v.rationale}` : optionLabel;
                      const isOptionSelected = activeVarId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={isOptionSelected}
                          class={`ve-variant-option-btn${isOptionSelected ? ' is-selected' : ''}`}
                          onClick={() => state.previewVariant(set.id, v.id)}
                          title={optionTooltip}
                        >
                          <span class="ve-variant-option-label">{optionLabel}</span>
                        </button>
                      );
                    })}
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
                        type="button"
                        class="ve-variant-apply-btn"
                        onClick={() => state.decideVariant(set.id, activeVariant.id)}
                        aria-label={`Apply variant ${activeVariant.name}`}
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
