import { h } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { isAnnotationOnRoute, observeNextDomCommit } from './route-utils.js';
import {
  PinAnchorOrigin,
  PinRect,
  getPinAnchorOrigin,
  isDocumentScrollTarget,
  locatePinTarget,
} from './pin-position.js';
import { usePinPeekDrag } from './pin-drag.js';
import { handleRovingArrowKey } from './keyboard-nav.js';

function EditCommentTextarea({
  value,
  onInput,
  onKeyDown,
}: {
  value: string;
  onInput: (val: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const computedHeight = Math.min(Math.max(el.scrollHeight, 60), 220);
    el.style.height = `${computedHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      aria-label="Edit comment text"
      style={{
        background: 'rgba(0, 0, 0, 0.45)',
        color: '#f8fafc',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        fontFamily: 'inherit',
        resize: 'none',
        minHeight: '60px',
        maxHeight: '220px',
        lineHeight: '1.45',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
      value={value}
      onInput={(e) => {
        const val = (e.target as HTMLTextAreaElement).value;
        onInput(val);
        adjustHeight();
      }}
      onKeyDown={onKeyDown}
      autoFocus
    />
  );
}

export function CommentPins() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [hoveredPinKey, setHoveredPinKey] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  const anchorRef = useRef<HTMLDivElement>(null);
  const anchorOriginRef = useRef<PinAnchorOrigin>({ left: 0, top: 0 });
  const needsDocScrollSyncRef = useRef(false);
  const pinRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const suppressFocusTooltipRef = useRef<string | null>(null);

  const { activeDragKey, snappingKey, startPinDrag, consumeSuppressedClick } = usePinPeekDrag({
    onDragStart: () => {
      setHoveredPinId(null);
      setHoveredPinKey(null);
    },
  });

  const editingRef = useRef({ editingPinId, editText });
  editingRef.current = { editingPinId, editText };

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

    const handleOutsideClick = () => {
      const { editingPinId: currentId, editText: currentText } = editingRef.current;
      if (currentId) {
        state.updateAnnotation(currentId, currentText);
        setEditingPinId(null);
      }
      setHoveredPinId(null);
      setHoveredPinKey(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const { editingPinId: currentId, editText: currentText } = editingRef.current;
      if (e.key === 'Escape' && currentId) {
        state.updateAnnotation(currentId, currentText);
        setEditingPinId(null);
        setHoveredPinId(null);
        setHoveredPinKey(null);
      }
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    const unsub = state.subscribe(handleUpdate);

    return () => {
      if (rafId !== 0 && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
      document.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      unsub();
    };
  }, [state]);

  const currentPath = state.getCurrentPathname();
  const prevPathRef = useRef(currentPath);
  const hasAnnotations = state.annotations.length > 0;

  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      setEditingPinId(null);
      setHoveredPinId(null);
      setHoveredPinKey(null);
      setEditText('');
    }
    if (!hasAnnotations) return;
    return observeNextDomCommit(() => setTick((t) => t + 1));
  }, [currentPath, hasAnnotations]);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const measured = getPinAnchorOrigin(anchorRef.current);
    if (
      Math.abs(measured.left - anchorOriginRef.current.left) > 0.5 ||
      Math.abs(measured.top - anchorOriginRef.current.top) > 0.5
    ) {
      setTick((t) => t + 1);
    }
  }, [hasAnnotations, state.annotations.length, currentPath]);

  if (state.annotations.length === 0) {
    needsDocScrollSyncRef.current = false;
    return null;
  }

  const anchor = getPinAnchorOrigin(anchorRef.current);
  anchorOriginRef.current = anchor;

  const connectors: Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    active: boolean;
  }> = [];
  const targetHighlights: Array<{
    id: string;
    fixed: boolean;
    rect: PinRect;
  }> = [];

  const pinItems: Array<{
    pinKey: string;
    ann: typeof state.annotations[0];
    annIdx: number;
    subLabel: string;
    isMulti: boolean;
    multiTotal: number;
    fixed: boolean;
    x: number;
    y: number;
    viewportX: number;
    viewportY: number;
  }> = [];

  let hasDynamicScrollPin = false;
  let hasFixedConnectorEndpoint = false;

  state.annotations.forEach((ann, idx) => {
    if (ann.targets && ann.targets.length > 1) {
      const anyTargetHasPathname = ann.targets.some((t) => Boolean(t.pathname));
      const matchesAnnotationRoute = isAnnotationOnRoute(ann, currentPath);
      const matchesTarget = (t: NonNullable<typeof ann.targets>[number]) =>
        t.pathname ? isAnnotationOnRoute({ pathname: t.pathname }, currentPath) : matchesAnnotationRoute;
      const matchesAnyTarget = anyTargetHasPathname
        ? ann.targets.some(matchesTarget)
        : matchesAnnotationRoute;

      if (!matchesAnyTarget) {
        return;
      }

      const coords: Array<{ x: number; y: number; fixed: boolean }> = [];
      const isAnnActive = hoveredPinId === ann.id || editingPinId === ann.id;

      ann.targets.forEach((t, tIdx) => {
        if (!matchesTarget(t)) {
          return;
        }

        const pos = locatePinTarget({
          targetSelector: t.targetSelector,
          sourceLoc: t.sourceLocation,
          bounds: t.bounds,
          anchor,
        });

        if (pos.found) {
          if (pos.dynamicScroll) hasDynamicScrollPin = true;
          coords.push({ x: pos.x, y: pos.y, fixed: pos.fixed });
          pinItems.push({
            pinKey: `${ann.id}_${tIdx}`,
            ann,
            annIdx: idx,
            subLabel: `${idx + 1}${String.fromCharCode(65 + tIdx)}`,
            isMulti: true,
            multiTotal: ann.targets!.length,
            fixed: pos.fixed,
            x: pos.x,
            y: pos.y,
            viewportX: pos.viewportX,
            viewportY: pos.viewportY,
          });

          if (isAnnActive && pos.rect) {
            targetHighlights.push({
              id: `${ann.id}_hl_${tIdx}`,
              fixed: pos.fixed,
              rect: pos.rect,
            });
          }
        }
      });

      if (coords.length > 1) {
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i];
          const b = coords[i + 1];
          if (a.fixed || b.fixed) hasFixedConnectorEndpoint = true;
          connectors.push({
            id: `${ann.id}_conn_${i}`,
            x1: a.fixed ? a.x - anchor.left : a.x,
            y1: a.fixed ? a.y - anchor.top : a.y,
            x2: b.fixed ? b.x - anchor.left : b.x,
            y2: b.fixed ? b.y - anchor.top : b.y,
            active: isAnnActive,
          });
        }
      }
    } else {
      const singleRouteTarget =
        ann.targets?.length === 1 && ann.targets[0].pathname
          ? { pathname: ann.targets[0].pathname }
          : ann;
      if (!isAnnotationOnRoute(singleRouteTarget, currentPath)) {
        return;
      }

      const pos = locatePinTarget({
        targetSelector: ann.targetSelector,
        sourceLoc: ann.sourceLocation,
        bounds: ann.bounds,
        anchor,
      });
      if (pos.found) {
        if (pos.dynamicScroll) hasDynamicScrollPin = true;
        pinItems.push({
          pinKey: ann.id,
          ann,
          annIdx: idx,
          subLabel: `${idx + 1}`,
          isMulti: false,
          multiTotal: 1,
          fixed: pos.fixed,
          x: pos.x,
          y: pos.y,
          viewportX: pos.viewportX,
          viewportY: pos.viewportY,
        });
      }
    }
  });

  needsDocScrollSyncRef.current =
    hasDynamicScrollPin ||
    hasFixedConnectorEndpoint ||
    hoveredPinId !== null ||
    editingPinId !== null ||
    activeDragKey !== null;

  if (pinItems.length === 0 && connectors.length === 0 && targetHighlights.length === 0) {
    return null;
  }

  let connectorSvg = null;
  if (connectors.length > 0) {
    const svgPad = 24;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of connectors) {
      minX = Math.min(minX, c.x1, c.x2);
      minY = Math.min(minY, c.y1, c.y2);
      maxX = Math.max(maxX, c.x1, c.x2);
      maxY = Math.max(maxY, c.y1, c.y2);
    }
    minX = Math.floor(minX - svgPad);
    minY = Math.floor(minY - svgPad);
    const svgW = Math.max(1, Math.ceil(maxX + svgPad - minX));
    const svgH = Math.max(1, Math.ceil(maxY + svgPad - minY));

    connectorSvg = (
      <svg
        class="ve-pins-svg-overlay"
        width={svgW}
        height={svgH}
        viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
        style={{
          left: `${minX}px`,
          top: `${minY}px`,
          width: `${svgW}px`,
          height: `${svgH}px`,
        }}
      >
        {connectors.map((c) => (
          <line
            key={c.id}
            x1={c.x1}
            y1={c.y1}
            x2={c.x2}
            y2={c.y2}
            stroke={c.active ? '#38bdf8' : 'rgba(56, 189, 248, 0.45)'}
            stroke-width={c.active ? '3' : '2'}
            stroke-dasharray={c.active ? '6 3' : '4 3'}
            style={{
              filter: c.active ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.95))' : undefined,
              transition:
                'stroke 0.15s ease-out, stroke-width 0.15s ease-out, filter 0.15s ease-out',
            }}
          />
        ))}
      </svg>
    );
  }

  return (
    <div class="ve-pins-layer" ref={anchorRef}>
      {targetHighlights.map((hl) => (
        <div
          key={hl.id}
          class="ve-pin-target-highlight"
          style={{
            position: hl.fixed ? 'fixed' : undefined,
            top: `${hl.rect.top}px`,
            left: `${hl.rect.left}px`,
            width: `${hl.rect.width}px`,
            height: `${hl.rect.height}px`,
          }}
        />
      ))}

      {connectorSvg}

      {pinItems.map((item) => {
        const {
          pinKey,
          ann,
          annIdx,
          subLabel,
          isMulti,
          multiTotal,
          fixed,
          x,
          y,
          viewportX,
          viewportY,
        } = item;
        const isDragging = activeDragKey === pinKey;
        const isSnapping = snappingKey === pinKey;
        const isHovered = hoveredPinId === ann.id || editingPinId === ann.id;
        const isEditing = editingPinId === ann.id;
        const showTooltip =
          !isDragging &&
          activeDragKey !== pinKey &&
          isHovered &&
          (hoveredPinKey === pinKey || (!hoveredPinKey && isEditing));

        const isNearTop = viewportY < (isEditing ? 300 : 240);
        const isNearLeft = viewportX < 190;
        const isNearRight = viewportX > (window.innerWidth || 1000) - 200;

        const tooltipPositionStyle: Record<string, string> = {
          left: isNearLeft ? '-8px' : isNearRight ? 'auto' : '50%',
          right: isNearRight ? '-8px' : 'auto',
          transform: isNearLeft || isNearRight ? 'none' : 'translateX(-50%)',
        };
        const commentPreview = ann.comment
          ? `: ${ann.comment.slice(0, 60)}${ann.comment.length > 60 ? '…' : ''}`
          : '';
        const pinAriaLabel = isMulti
          ? `Pin ${subLabel}, linked to ${multiTotal} elements${commentPreview}`
          : `Comment pin ${subLabel}${commentPreview}`;

        const closeTooltipAndRestorePinFocus = (saveCurrent: boolean) => {
          if (editingPinId === ann.id && saveCurrent) {
            state.updateAnnotation(ann.id, editText);
          }
          setEditingPinId(null);
          setHoveredPinId(null);
          setHoveredPinKey(null);
          suppressFocusTooltipRef.current = pinKey;
          pinRefs.current[pinKey]?.focus({ preventScroll: true });
        };

        return (
          <div
            key={pinKey}
            ref={(el) => {
              pinRefs.current[pinKey] = el;
            }}
            role="button"
            tabIndex={0}
            aria-expanded={showTooltip}
            aria-label={pinAriaLabel}
            class={[
              've-pin',
              isMulti ? 've-pin-multi' : '',
              isDragging ? 've-dragging' : '',
              isSnapping ? 've-snapping' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              position: fixed ? 'fixed' : undefined,
              left: `${x}px`,
              top: `${y}px`,
            }}
            onPointerDown={(e) => {
              startPinDrag(e, {
                pinKey,
                pinEl: e.currentTarget as HTMLElement,
              });
            }}
            onFocus={(e) => {
              if (e.target !== e.currentTarget) return;
              if (suppressFocusTooltipRef.current === pinKey) {
                suppressFocusTooltipRef.current = null;
                return;
              }
              if (!activeDragKey && !editingPinId) {
                setHoveredPinId(ann.id);
                setHoveredPinKey(pinKey);
              }
            }}
            onBlur={(e) => {
              const nextFocused = e.relatedTarget as Node | null;
              if (nextFocused && e.currentTarget.contains(nextFocused)) {
                return;
              }
              if (!activeDragKey && !editingPinId) {
                setHoveredPinId((prev) => (prev === ann.id ? null : prev));
                setHoveredPinKey((prev) => (prev === pinKey ? null : prev));
              }
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                if (editingPinId === ann.id) {
                  state.updateAnnotation(ann.id, editText);
                  setEditingPinId(null);
                } else {
                  if (editingPinId) {
                    state.updateAnnotation(editingPinId, editText);
                  }
                  setHoveredPinId(ann.id);
                  setHoveredPinKey(pinKey);
                  setEditingPinId(ann.id);
                  setEditText(ann.comment);
                }
                return;
              }
              if (e.key === 'Escape') {
                if (isHovered || isEditing) {
                  e.preventDefault();
                  e.stopPropagation();
                  closeTooltipAndRestorePinFocus(false);
                }
                return;
              }
              const pins = anchorRef.current
                ? (Array.from(anchorRef.current.querySelectorAll('.ve-pin')) as HTMLElement[])
                : [];
              handleRovingArrowKey(e, pins, {
                orientation: 'both',
                loop: true,
                currentEl: e.currentTarget as HTMLElement,
                onFocusChange: (nextEl) => {
                  nextEl.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
                },
              });
            }}
            onMouseEnter={() => {
              if (!activeDragKey && !editingPinId) {
                setHoveredPinId(ann.id);
                setHoveredPinKey(pinKey);
              }
            }}
            onMouseLeave={() => {
              if (!activeDragKey && !editingPinId) {
                setHoveredPinId(null);
                setHoveredPinKey(null);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (consumeSuppressedClick(pinKey)) {
                e.preventDefault();
                return;
              }
              if (editingPinId === ann.id) {
                state.updateAnnotation(ann.id, editText);
                setEditingPinId(null);
                setHoveredPinId(null);
                setHoveredPinKey(null);
              } else {
                if (editingPinId) {
                  state.updateAnnotation(editingPinId, editText);
                }
                setHoveredPinId(ann.id);
                setHoveredPinKey(pinKey);
                setEditingPinId(ann.id);
                setEditText(ann.comment);
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <span class="ve-glass-surface" aria-hidden="true" />
            <span class="ve-glass-bevel" aria-hidden="true" />
            <span class="ve-pin-label">{subLabel}</span>
            {isMulti && (
              <span class="ve-pin-link-badge" title={`Linked to ${multiTotal} elements`} aria-hidden="true">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
            )}
            {showTooltip && (
              <div
                role="dialog"
                aria-label={`Comment pin ${subLabel}`}
                class={`ve-pin-tooltip ${isNearTop ? 've-pin-tooltip-below' : 've-pin-tooltip-above'}`}
                style={tooltipPositionStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    closeTooltipAndRestorePinFocus(true);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <span class="ve-glass-surface" aria-hidden="true" />
                <span class="ve-glass-bevel" aria-hidden="true" />
                <div class="ve-pin-tooltip-header">
                  <strong class="ve-pin-tooltip-title">
                    {isMulti
                      ? `Pin #${subLabel} • Linked (${multiTotal} elements)`
                      : `Pin #${annIdx + 1} ${ann.selectedText ? '• Text' : ''}`}
                  </strong>
                  <div class="ve-pin-tooltip-actions">
                    {!isEditing && (
                      <button
                        type="button"
                        class="ve-pin-tooltip-edit-btn"
                        aria-label={`Edit comment pin ${subLabel}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPinId(ann.id);
                          setEditText(ann.comment);
                        }}
                        title="Edit comment text"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      class="ve-pin-tooltip-resolve-btn"
                      aria-label={`Resolve comment pin ${subLabel}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        state.deleteAnnotation(ann.id);
                        if (editingPinId === ann.id) setEditingPinId(null);
                      }}
                      title="Dismiss and resolve this comment"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Resolve</span>
                    </button>
                  </div>
                </div>

                {ann.selectedText && (
                  <div class="ve-pin-tooltip-quote">
                    "{ann.selectedText}"
                  </div>
                )}

                {isEditing ? (
                  <div class="ve-pin-edit-stack">
                    <EditCommentTextarea
                      value={editText}
                      onInput={(val) => setEditText(val)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          state.updateAnnotation(ann.id, editText);
                          setEditingPinId(null);
                          pinRefs.current[pinKey]?.focus({ preventScroll: true });
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          closeTooltipAndRestorePinFocus(true);
                        }
                      }}
                    />
                    <div class="ve-pin-edit-actions">
                      <button
                        type="button"
                        class="ve-pin-edit-cancel-btn"
                        aria-label="Cancel comment edit"
                        onClick={() => {
                          setEditingPinId(null);
                          pinRefs.current[pinKey]?.focus({ preventScroll: true });
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="ve-pin-edit-save-btn"
                        aria-label="Save comment edit"
                        onClick={() => {
                          state.updateAnnotation(ann.id, editText);
                          setEditingPinId(null);
                          pinRefs.current[pinKey]?.focus({ preventScroll: true });
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    class="ve-pin-tooltip-body"
                    onClick={() => {
                      setEditingPinId(ann.id);
                      setEditText(ann.comment);
                    }}
                    title="Click to edit"
                  >
                    {ann.comment}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
