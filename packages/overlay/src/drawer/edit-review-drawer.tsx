import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from '../inspector/state.js';
import { formatBatchSummary } from '@visual-edit/core';
import { normalizeRoute } from '../inspector/route-utils.js';

function RouteBadge({
  pathname,
  currentPath,
  prefix,
}: {
  pathname: string;
  currentPath: string;
  prefix: string;
}) {
  const isCurrent = normalizeRoute(pathname) === normalizeRoute(currentPath);
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '1px 5px',
        borderRadius: '4px',
        background: isCurrent ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
        color: isCurrent ? 'var(--ve-accent-text, #38bdf8)' : 'var(--ve-text-muted, #94a3b8)',
        fontFamily: 'monospace',
      }}
      title={`${prefix} ${pathname}`}
    >
      {pathname}
    </span>
  );
}

export function EditReviewDrawer() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [copiedToast, setCopiedToast] = useState(false);
  const [updateCopiedToast, setUpdateCopiedToast] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingAnnotationText, setEditingAnnotationText] = useState<string>('');

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  if (!state.isDrawerOpen) return null;

  const currentPath = state.getCurrentPathname();

  // Only consider variant sets that are pending AND whose elements exist in current DOM
  const pendingVariantSets = state.variantSets.filter((s) => {
    if (s.status !== 'pending') return false;
    try {
      return Boolean(document.querySelector(s.targetSelector));
    } catch {
      return false;
    }
  });

  const uniquePendingSets = new Map<string, (typeof pendingVariantSets)[0]>();
  for (const s of pendingVariantSets) {
    uniquePendingSets.set(s.targetSelector, s);
  }
  const activeVariantProposals = Array.from(uniquePendingSets.values());

  const totalMutations = state.mutations.length;
  const totalAnnotations = state.annotations.length;
  const totalVariants = state.variantDecisions.length;
  const totalItems = totalMutations + totalAnnotations + totalVariants + activeVariantProposals.length;
  const isLive = state.reviewMode === 'live';

  const handleCopyPrompt = async () => {
    const batch = state.getBatch();
    const summary = formatBatchSummary(batch);
    const fullPrompt = `Please implement the following visual modifications drafted in the browser overlay:\n\n${summary}`;

    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div
      class="ve-drawer"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drawer Header: Clean and unified */}
      <div class="ve-drawer-header">
        <div class="ve-drawer-title">
          <span>Review Changes</span>
          {totalItems > 0 && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--ve-accent-text, #38bdf8)',
                fontWeight: 600,
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '1px 6px',
                borderRadius: '10px',
              }}
            >
              {totalItems}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Single Toggle Pill: clicking anywhere flips between Live and Batch */}
          <button
            onClick={() => {
              const nextMode = isLive ? 'batch' : 'live';
              state.setReviewMode(nextMode);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px 3px 10px',
              borderRadius: '16px',
              background: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: isLive ? '1px solid rgba(52, 211, 153, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
            title={isLive ? 'Live Mode active (click to switch to Batch)' : 'Batch Mode active (click to switch to Live)'}
          >
            {isLive && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#34d399',
                  boxShadow: '0 0 6px #34d399',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: isLive ? '#6ee7b7' : '#cbd5e1',
              }}
            >
              {isLive ? 'Live' : 'Batch'}
            </span>
            <span
              style={{
                width: '22px',
                height: '13px',
                borderRadius: '10px',
                background: isLive ? 'rgba(52, 211, 153, 0.35)' : 'rgba(255, 255, 255, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1.5px',
                boxSizing: 'border-box',
                transition: 'background 0.15s ease',
                marginLeft: '2px',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: isLive ? '#34d399' : '#94a3b8',
                  transform: isLive ? 'translateX(9px)' : 'translateX(0)',
                  transition: 'transform 0.15s ease',
                }}
              />
            </span>
          </button>

          <button
            class="ve-close-btn"
            onClick={() => state.setDrawerOpen(false)}
            title="Close (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="ve-drawer-body">
        {totalItems === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center' }}>
            <p style={{ fontWeight: 500, fontSize: '13px', color: 'var(--ve-text-muted, #94a3b8)' }}>
              No changes drafted yet
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {totalMutations > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ve-accent-text, #0284c7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Visual Edits ({totalMutations})
                  </span>
                </div>

                {state.mutations.map((m) => (
                  <div key={m.id} class="ve-mutation-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div class="ve-mut-target" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>
                          {m.sourceLocation?.componentName
                            ? `<${m.sourceLocation.componentName}>`
                            : m.targetSelector}
                          {m.property ? ` • ${m.property}` : ''}
                        </span>
                        {m.pathname && <RouteBadge pathname={m.pathname} currentPath={currentPath} prefix="Modified on" />}
                      </div>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f43f5e',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '0 4px',
                        }}
                        onClick={() => state.revertMutation(m.id)}
                        title="Revert this visual change"
                      >
                        Revert
                      </button>
                    </div>

                    <div class="ve-mut-diff">
                      {m.type === 'TEXT_EDIT' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span class="ve-mut-before">"{m.before}"</span>
                          <span class="ve-mut-after">"{m.after}"</span>
                        </div>
                      )}

                      {m.type === 'STYLE_CHANGE' && (
                        <div>
                          <span class="ve-mut-before">{m.before}</span> →{' '}
                          <span class="ve-mut-after">{m.after}</span>
                          {m.tailwindSuggestion && (
                            <span style={{ color: 'var(--ve-accent-text, #0284c7)', marginLeft: '6px', fontSize: '11px' }}>
                              ({m.tailwindSuggestion})
                            </span>
                          )}
                        </div>
                      )}

                      {m.type === 'CLASS_CHANGE' && (
                        <div>
                          {m.details?.added && m.details.added.length > 0 && (
                            <div style={{ color: '#22c55e' }}>+ {m.details.added.join(', ')}</div>
                          )}
                          {m.details?.removed && m.details.removed.length > 0 && (
                            <div style={{ color: '#ef4444' }}>- {m.details.removed.join(', ')}</div>
                          )}
                        </div>
                      )}

                      {m.type === 'DOM_INSERT' && (
                        <span style={{ color: '#22c55e' }}>+ Inserted element</span>
                      )}
                      {m.type === 'DOM_REMOVE' && (
                        <span style={{ color: '#ef4444' }}>- Deleted element</span>
                      )}
                      {m.type === 'DOM_REORDER' && (
                        <span style={{ color: 'var(--ve-accent-text, #0284c7)' }}>⇄ Reordered position</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalAnnotations > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ve-text-primary, #f8fafc)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Comments & Pins ({totalAnnotations})
                </span>
                {state.annotations.map((ann, idx) => {
                  const isEditing = editingAnnotationId === ann.id;
                  const isVoice = ann.type === 'voice';
                  const isScreenshot = ann.type === 'screenshot' || Boolean(ann.screenshot);
                  return (
                    <div
                      key={ann.id}
                      class="ve-mutation-card"
                      style={
                        isVoice
                          ? { background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }
                          : isScreenshot
                          ? { background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }
                          : undefined
                      }
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span class="ve-mut-target" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {isVoice ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              </svg>
                              Voice Walkthrough {ann.targets && ann.targets.length > 0 ? `(${ann.targets.length} target${ann.targets.length > 1 ? 's' : ''})` : ''}
                            </span>
                          ) : isScreenshot ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                              </svg>
                              Screenshot {ann.targetSelector ? `• ${ann.targetSelector}` : ''}
                            </span>
                          ) : (
                            ann.targets && ann.targets.length > 1
                              ? `Pin #${idx + 1} • Linked (${ann.targets.length} elements)`
                              : `Pin #${idx + 1} ${ann.targetSelector ? `• ${ann.targetSelector}` : ''}`
                          )}
                          {!isVoice && !isScreenshot && ann.selectedText ? ' • [Text Selection]' : ''}
                          {ann.pathname && <RouteBadge pathname={ann.pathname} currentPath={currentPath} prefix="Created on" />}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {!isEditing && (
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--ve-text-muted, #94a3b8)', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                              onClick={() => {
                                setEditingAnnotationId(ann.id);
                                setEditingAnnotationText(ann.comment);
                              }}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                            onClick={() => {
                              state.deleteAnnotation(ann.id);
                              if (editingAnnotationId === ann.id) setEditingAnnotationId(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {ann.targets && ann.targets.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                          {ann.targets.map((t, tIdx) => {
                            const label = t.sourceLocation?.componentName
                              ? `<${t.sourceLocation.componentName}>`
                              : t.targetSelector || `Target ${tIdx + 1}`;
                            return (
                              <span
                                key={tIdx}
                                style={{
                                  fontSize: '10px',
                                  fontFamily: 'ui-monospace, monospace',
                                  background: isVoice ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                                  border: isVoice ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(56, 189, 248, 0.3)',
                                  color: isVoice ? '#fca5a5' : 'var(--ve-accent-text, #38bdf8)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                }}
                              >
                                {isVoice ? `Target ${tIdx + 1}: ${label}` : `${String.fromCharCode(65 + tIdx)}: ${label}`}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {ann.selectedText && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--ve-amber-text, #d97706)',
                            background: 'rgba(251, 191, 36, 0.14)',
                            borderLeft: '2px solid var(--ve-amber-text, #d97706)',
                            padding: '3px 6px',
                            borderRadius: '2px',
                            marginBottom: '4px',
                            fontStyle: 'italic',
                            wordBreak: 'break-word',
                          }}
                        >
                          "{ann.selectedText}"
                        </div>
                      )}

                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          <textarea
                            style={{
                              background: 'rgba(0, 0, 0, 0.45)',
                              color: 'var(--ve-text-primary, #f8fafc)',
                              border: '1px solid rgba(255, 255, 255, 0.25)',
                              borderRadius: '6px',
                              padding: '6px',
                              fontSize: '12px',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              minHeight: '48px',
                              outline: 'none',
                              width: '100%',
                              boxSizing: 'border-box',
                            }}
                            value={editingAnnotationText}
                            onInput={(e) => setEditingAnnotationText((e.target as HTMLTextAreaElement).value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                state.updateAnnotation(ann.id, editingAnnotationText);
                                setEditingAnnotationId(null);
                              } else if (e.key === 'Escape') {
                                setEditingAnnotationId(null);
                              }
                            }}
                            autoFocus
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--ve-text-muted, #94a3b8)', fontSize: '11px', cursor: 'pointer', padding: '2px 6px' }}
                              onClick={() => setEditingAnnotationId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                state.updateAnnotation(ann.id, editingAnnotationText);
                                setEditingAnnotationId(null);
                              }}
                              style={{
                                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.7)',
                                color: '#ffffff',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                padding: '3px 10px',
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {ann.voiceSections && ann.voiceSections.length > 1 ? (
                            ann.voiceSections.map((sec) => (
                              <div
                                key={sec.id}
                                style={{
                                  background: 'rgba(0,0,0,0.22)',
                                  padding: '4px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                }}
                              >
                                <div style={{ color: '#fca5a5', fontWeight: 600, fontSize: '10px' }}>
                                  Section #{sec.order} ({sec.targets.map((t) => t.targetSelector).join(', ') || 'General'})
                                </div>
                                <div style={{ color: 'var(--ve-text-primary, #f8fafc)' }}>
                                  {sec.transcript || '(Pinned without speech)'}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p
                              style={{ color: 'var(--ve-text-primary, #f8fafc)', fontSize: '12px', cursor: 'pointer' }}
                              onClick={() => {
                                setEditingAnnotationId(ann.id);
                                setEditingAnnotationText(ann.comment);
                              }}
                              title="Click to edit"
                            >
                              {ann.comment}
                            </p>
                          )}
                        </div>
                      )}

                      {ann.screenshot && (
                        <div style={{ marginTop: '6px', marginBottom: '4px' }}>
                          <img
                            src={ann.screenshot}
                            alt="Visual capture"
                            style={{
                              width: '100%',
                              maxHeight: '140px',
                              objectFit: 'contain',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              background: 'rgba(0, 0, 0, 0.4)',
                              cursor: 'zoom-in',
                              display: 'block',
                            }}
                            onClick={() => {
                              window.open(ann.screenshot, '_blank');
                            }}
                            title="Click to view full screenshot"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeVariantProposals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ve-accent-text, #38bdf8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Variant Proposals ({activeVariantProposals.length})
                </span>
                {activeVariantProposals.map((set) => (
                  <div
                    key={set.id}
                    class="ve-mutation-card"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span class="ve-mut-target" style={{ fontWeight: 600, color: '#f1f5f9' }}>
                        {set.label || set.targetSelector}
                      </span>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                        onClick={() => state.dismissVariantSet(set.id)}
                        title="Dismiss proposal"
                      >
                        Dismiss
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                      <span>{set.variants.length} options proposed</span>
                      <button
                        style={{
                          background: 'rgba(56, 189, 248, 0.16)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          borderRadius: '5px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          try {
                            const el = document.querySelector(set.targetSelector);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          } catch {}
                        }}
                        title="Scroll to element to preview and pick options"
                      >
                        Preview on Page
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalVariants > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Variant Selections ({totalVariants})
                </span>
                {state.variantDecisions.map((vd) => (
                  <div key={vd.setId} class="ve-mutation-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div class="ve-mut-target" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {vd.targetSelector}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          style={{
                            background: 'rgba(59, 130, 246, 0.18)',
                            border: '1px solid rgba(96, 165, 250, 0.35)',
                            color: '#93c5fd',
                            borderRadius: '5px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                          }}
                          onClick={() => {
                            state.revertVariantDecision(vd.setId);
                            try {
                              const el = document.querySelector(vd.targetSelector);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } catch {}
                          }}
                          title="Revert to test different options"
                        >
                          Change Option
                        </button>
                        <button
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(248, 113, 113, 0.3)',
                            color: '#fca5a5',
                            borderRadius: '5px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                          }}
                          onClick={() => state.deleteVariantDecision(vd.setId)}
                          title="Delete variant decision and restore original styles"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>
                      Selected: {vd.variantName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.agentReplies.length > 0 && (
          <div class="ve-replies-list" style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ve-text-primary, #f8fafc)' }}>
              Agent Progress & Replies
            </span>
            {state.agentReplies.map((r) => (
              <div key={r.id} class="ve-reply-item">
                <div class="ve-reply-author">{r.agentId}</div>
                <div>{r.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        class="ve-drawer-autosave-bar"
        style={{
          padding: '8px 16px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--ve-text-muted, #94a3b8)',
          fontWeight: 500,
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {isLive && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)',
                flexShrink: 0,
              }}
            />
          )}
          <span>
            {isLive ? 'Live mode: changes stream to agent automatically' : 'Batch mode: click Submit when ready'}
          </span>
        </div>

        {state.updateInfo?.updateAvailable ? (
          <button
            class="ve-update-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              color: '#38bdf8',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText('lux update');
                setUpdateCopiedToast(true);
                setTimeout(() => setUpdateCopiedToast(false), 2500);
              } catch {}
            }}
            title={`v${state.updateInfo.latestVersion} available! Click to copy "lux update"`}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#38bdf8',
                boxShadow: '0 0 6px #38bdf8',
              }}
            />
            <span>
              {updateCopiedToast ? 'Copied "lux update"!' : `Update v${state.updateInfo.latestVersion}`}
            </span>
          </button>
        ) : (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--ve-text-muted, #64748b)',
              fontWeight: 500,
            }}
            title="lux is up to date"
          >
            v{state.version}
          </span>
        )}
      </div>

      <div class="ve-drawer-footer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
        <button
          class="ve-btn"
          style={{
            flex: 1,
            height: '34px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
          }}
          onClick={() => state.revertAll()}
          title="Revert all visual edits and delete all comments"
        >
          Reset All
        </button>

        <button
          class="ve-btn"
          style={{
            flex: 1,
            height: '34px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
          }}
          onClick={handleCopyPrompt}
          disabled={totalItems === 0}
          title="Copy formatted prompt to clipboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{copiedToast ? 'Copied!' : 'Copy'}</span>
        </button>

        {!isLive && (
          <button
            class="ve-btn primary"
            style={{
              flex: 1.3,
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              opacity: state.sessionStatus === 'submitted' ? 0.85 : 1,
            }}
            onClick={() => state.submitBatch()}
            disabled={totalItems === 0}
            title={state.sessionStatus === 'submitted' ? 'Review submitted to agent. Click again to resubmit.' : 'Submit review to waiting agent'}
          >
            {state.sessionStatus === 'submitted' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Submitted</span>
              </>
            ) : (
              <span>Submit Review</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
