import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { OverlayStateManager } from './state.js';

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

export function CommentPins() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [hoveredPinKey, setHoveredPinKey] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    const handleOutsideClick = (e: MouseEvent) => {
      if (editingPinId) {
        state.updateAnnotation(editingPinId, editText);
        setEditingPinId(null);
      }
      setHoveredPinId(null);
      setHoveredPinKey(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingPinId) {
        state.updateAnnotation(editingPinId, editText);
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
  }, [editingPinId, editText]);

  if (state.annotations.length === 0) return null;

  const connectors: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];

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
      const coords: Array<{ x: number; y: number; tIdx: number }> = [];
      ann.targets.forEach((t, tIdx) => {
        let x = 0;
        let y = 0;
        if (t.targetSelector) {
          try {
            const el = document.querySelector(t.targetSelector) as HTMLElement | null;
            if (el) {
              const rect = el.getBoundingClientRect();
              x = rect.left + 12;
              y = rect.top + 12;
            }
          } catch (e) {}
        }
        if (x === 0 && y === 0 && t.bounds) {
          x = t.bounds.x + 12;
          y = t.bounds.y + 12;
        }
        if (x !== 0 || y !== 0) {
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
        }
      });

      if ((hoveredPinId === ann.id || editingPinId === ann.id) && coords.length > 1) {
        for (let i = 0; i < coords.length - 1; i++) {
          connectors.push({
            id: `${ann.id}_conn_${i}`,
            x1: coords[i].x,
            y1: coords[i].y,
            x2: coords[i + 1].x,
            y2: coords[i + 1].y,
          });
        }
      }
    } else {
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
        } catch (e) {}
      }
      if (x === 0 && y === 0 && ann.bounds) {
        x = ann.bounds.x + 12;
        y = ann.bounds.y + 12;
      }
      if (x !== 0 || y !== 0) {
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

  return (
    <Fragment>
      {connectors.length > 0 && (
        <svg class="ve-pins-svg-overlay">
          {connectors.map((c) => (
            <line
              key={c.id}
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              stroke="#38bdf8"
              stroke-width="2.5"
              stroke-dasharray="6 4"
              style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.7))' }}
            />
          ))}
        </svg>
      )}

      {pinItems.map((item) => {
        const { pinKey, ann, annIdx, subLabel, isMulti, multiTotal, x, y } = item;
        const isHovered = hoveredPinId === ann.id || editingPinId === ann.id;
        const isEditing = editingPinId === ann.id;
        const showTooltip = isHovered && (hoveredPinKey === pinKey || (!hoveredPinKey && isEditing));

        // Smart placement logic: if pin is in the upper viewport (y < 220), flip tooltip below the pin
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
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {!isEditing && (
                      <button
                        style={{
                          background: 'rgba(255, 255, 255, 0.12)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          backdropFilter: 'blur(8px)',
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
                        padding: '2px 6px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        state.deleteAnnotation(ann.id);
                        if (editingPinId === ann.id) setEditingPinId(null);
                      }}
                      title="Dismiss and resolve this comment"
                    >
                      ✓ Resolve
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
