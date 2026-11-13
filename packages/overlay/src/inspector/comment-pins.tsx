import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { SourceLocation } from '@visual-edit/core';
import { OverlayStateManager } from './state.js';
import { isAnnotationOnRoute, observeNextDomCommit } from './route-utils.js';

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

function locateElementOrBounds(
  targetSelector?: string,
  sourceLoc?: SourceLocation,
  bounds?: { x: number; y: number; width?: number; height?: number }
): { x: number; y: number; rect: DOMRect | { top: number; left: number; width: number; height: number } | null } {
  const scrollX = typeof window !== 'undefined' ? window.scrollX || window.pageXOffset || 0 : 0;
  const scrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;

  // 1. Try exact targetSelector
  if (targetSelector) {
    try {
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + 12, y: r.top + 12, rect: r };
      }
    } catch {
      // Ignore invalid selector syntax; fall back to id/xpath/bounds below.
    }
  }

  // 2. Try ID if known
  if (sourceLoc?.id) {
    try {
      const el = document.getElementById(sourceLoc.id);
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + 12, y: r.top + 12, rect: r };
      }
    } catch {
      // Ignore DOM lookup errors when resolving pin fallback ID.
    }
  }

  // 3. Try XPath if known
  if (sourceLoc?.xpath) {
    try {
      const result = document.evaluate(sourceLoc.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (result.singleNodeValue instanceof HTMLElement) {
        const r = result.singleNodeValue.getBoundingClientRect();
        return { x: r.left + 12, y: r.top + 12, rect: r };
      }
    } catch {
      // Ignore invalid XPath expressions; fall back to stored bounds below.
    }
  }

  // 4. Fallback to stored document bounds
  if (bounds) {
    const vpLeft = bounds.x - scrollX;
    const vpTop = bounds.y - scrollY;
    const width = bounds.width || 0;
    const height = bounds.height || 0;
    return {
      x: vpLeft + 12,
      y: vpTop + 12,
      rect: { top: vpTop, left: vpLeft, width, height },
    };
  }

  return { x: 0, y: 0, rect: null };
}

export function CommentPins() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [hoveredPinKey, setHoveredPinKey] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  const editingRef = useRef({ editingPinId, editText });
  editingRef.current = { editingPinId, editText };

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
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

    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    const unsub = state.subscribe(handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
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

  if (state.annotations.length === 0) return null;

  const connectors: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; active: boolean }> = [];
  const targetHighlights: Array<{ id: string; top: number; left: number; width: number; height: number }> = [];

  const pinItems: Array<{
    pinKey: string;
    ann: typeof state.annotations[0];
    annIdx: number;
    subLabel: string;
    isMulti: boolean;
    multiTotal: number;
    x: number;
    y: number;
  }> = [];

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

      const coords: Array<{ x: number; y: number; tIdx: number }> = [];
      const isAnnActive = hoveredPinId === ann.id || editingPinId === ann.id;

      ann.targets.forEach((t, tIdx) => {
        if (!matchesTarget(t)) {
          return;
        }

        const { x, y, rect } = locateElementOrBounds(t.targetSelector, t.sourceLocation, t.bounds);
        const found = rect !== null || x !== 0 || y !== 0;

        if (found) {
          coords.push({ x, y, tIdx });
          pinItems.push({
            pinKey: `${ann.id}_${tIdx}`,
            ann,
            annIdx: idx,
            subLabel: `${idx + 1}${String.fromCharCode(65 + tIdx)}`,
            isMulti: true,
            multiTotal: ann.targets!.length,
            x,
            y,
          });

          if (isAnnActive && rect) {
            targetHighlights.push({
              id: `${ann.id}_hl_${tIdx}`,
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            });
          }
        }
      });

      if (coords.length > 1) {
        for (let i = 0; i < coords.length - 1; i++) {
          connectors.push({
            id: `${ann.id}_conn_${i}`,
            x1: coords[i].x,
            y1: coords[i].y,
            x2: coords[i + 1].x,
            y2: coords[i + 1].y,
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

      const { x, y } = locateElementOrBounds(ann.targetSelector, ann.sourceLocation, ann.bounds);
      const found = x !== 0 || y !== 0;
      if (found) {
        pinItems.push({
          pinKey: ann.id,
          ann,
          annIdx: idx,
          subLabel: `${idx + 1}`,
          isMulti: false,
          multiTotal: 1,
          x,
          y,
        });
      }
    }
  });

  if (pinItems.length === 0 && connectors.length === 0 && targetHighlights.length === 0) {
    return null;
  }

  return (
    <Fragment>
      {targetHighlights.map((hl) => (
        <div
          key={hl.id}
          class="ve-pin-target-highlight"
          style={{
            top: `${hl.top}px`,
            left: `${hl.left}px`,
            width: `${hl.width}px`,
            height: `${hl.height}px`,
          }}
        />
      ))}

      {connectors.length > 0 && (
        <svg class="ve-pins-svg-overlay">
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
                transition: 'all 0.15s ease-out',
              }}
            />
          ))}
        </svg>
      )}

      {pinItems.map((item) => {
        const { pinKey, ann, annIdx, subLabel, isMulti, multiTotal, x, y } = item;
        const isHovered = hoveredPinId === ann.id || editingPinId === ann.id;
        const isEditing = editingPinId === ann.id;
        const showTooltip = isHovered && (hoveredPinKey === pinKey || (!hoveredPinKey && isEditing));

        const isNearTop = y < 220;
        const isNearLeft = x < 190;
        const isNearRight = x > (window.innerWidth || 1000) - 200;

        const tooltipPositionStyle: Record<string, string> = {
          left: isNearLeft ? '-8px' : isNearRight ? 'auto' : '50%',
          right: isNearRight ? '-8px' : 'auto',
          transform: isNearLeft || isNearRight ? 'none' : 'translateX(-50%)',
        };

        return (
          <div
            key={pinKey}
            class={`ve-pin ${isMulti ? 've-pin-multi' : ''}`}
            style={{ left: `${x}px`, top: `${y}px` }}
            onMouseEnter={() => {
              if (!editingPinId) {
                setHoveredPinId(ann.id);
                setHoveredPinKey(pinKey);
              }
            }}
            onMouseLeave={() => {
              if (!editingPinId) {
                setHoveredPinId(null);
                setHoveredPinKey(null);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
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
            <span>{subLabel}</span>
            {isMulti && (
              <span class="ve-pin-link-badge" title={`Linked to ${multiTotal} elements`}>
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
            )}
            {showTooltip && (
              <div
                class={`ve-pin-tooltip ${isNearTop ? 've-pin-tooltip-below' : 've-pin-tooltip-above'}`}
                style={tooltipPositionStyle}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                  <strong style={{ color: '#ffffff', fontSize: '11px', fontWeight: 600 }}>
                    {isMulti
                      ? `Pin #${subLabel} • Linked (${multiTotal} elements)`
                      : `Pin #${annIdx + 1} ${ann.selectedText ? '• Text' : ''}`}
                  </strong>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    {!isEditing && (
                      <button
                        style={{
                          background: 'rgba(255, 255, 255, 0.12)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '0 6px',
                          height: '20px',
                          boxSizing: 'border-box',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          backdropFilter: 'blur(8px)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap',
                        }}
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
                      style={{
                        background: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        color: '#4ade80',
                        borderRadius: '4px',
                        padding: '0 6px',
                        height: '20px',
                        boxSizing: 'border-box',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        state.deleteAnnotation(ann.id);
                        if (editingPinId === ann.id) setEditingPinId(null);
                      }}
                      title="Dismiss and resolve this comment"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Resolve</span>
                    </button>
                  </div>
                </div>

                {ann.selectedText && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#fbbf24',
                      background: 'rgba(251, 191, 36, 0.12)',
                      borderLeft: '2px solid #fbbf24',
                      padding: '3px 6px',
                      borderRadius: '2px',
                      marginBottom: '6px',
                      fontStyle: 'italic',
                      wordBreak: 'break-word',
                    }}
                  >
                    "{ann.selectedText}"
                  </div>
                )}

                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <EditCommentTextarea
                      value={editText}
                      onInput={(val) => setEditText(val)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          state.updateAnnotation(ann.id, editText);
                          setEditingPinId(null);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          state.updateAnnotation(ann.id, editText);
                          setEditingPinId(null);
                        }
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '10px',
                          cursor: 'pointer',
                          padding: '2px 6px',
                        }}
                        onClick={() => setEditingPinId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        style={{
                          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.7)',
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          padding: '3px 10px',
                        }}
                        onClick={() => {
                          state.updateAnnotation(ann.id, editText);
                          setEditingPinId(null);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{ color: '#f8fafc', fontSize: '12px', cursor: 'pointer', lineHeight: '1.45', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
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
    </Fragment>
  );
}
