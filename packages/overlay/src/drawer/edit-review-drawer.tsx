import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from '../inspector/state.js';
import { formatBatchSummary } from '@visual-edit/core';
import {
  AnnotationCard,
  MutationCard,
  VariantDecisionCard,
  VariantProposalCard,
} from './drawer-cards.js';

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
      {/* Drawer Header */}
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
            onClick={() => state.setReviewMode(isLive ? 'batch' : 'live')}
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
            <span style={{ fontSize: '11px', fontWeight: 600, color: isLive ? '#6ee7b7' : '#cbd5e1' }}>
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

          <button class="ve-close-btn" onClick={() => state.setDrawerOpen(false)} title="Close (Esc)">
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
                  <MutationCard
                    key={m.id}
                    mutation={m}
                    currentPath={currentPath}
                    onRevert={(id) => state.revertMutation(id)}
                  />
                ))}
              </div>
            )}

            {totalAnnotations > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ve-text-primary, #f8fafc)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Comments & Pins ({totalAnnotations})
                </span>
                {state.annotations.map((ann, idx) => (
                  <AnnotationCard
                    key={ann.id}
                    annotation={ann}
                    index={idx}
                    currentPath={currentPath}
                    isEditing={editingAnnotationId === ann.id}
                    editingText={editingAnnotationText}
                    onStartEdit={() => {
                      setEditingAnnotationId(ann.id);
                      setEditingAnnotationText(ann.comment);
                    }}
                    onChangeEditingText={setEditingAnnotationText}
                    onSaveEdit={() => {
                      state.updateAnnotation(ann.id, editingAnnotationText);
                      setEditingAnnotationId(null);
                    }}
                    onCancelEdit={() => setEditingAnnotationId(null)}
                    onDelete={() => {
                      state.deleteAnnotation(ann.id);
                      if (editingAnnotationId === ann.id) setEditingAnnotationId(null);
                    }}
                  />
                ))}
              </div>
            )}

            {activeVariantProposals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ve-accent-text, #38bdf8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Variant Proposals ({activeVariantProposals.length})
                </span>
                {activeVariantProposals.map((set) => (
                  <VariantProposalCard
                    key={set.id}
                    variantSet={set}
                    onDismiss={(id) => state.dismissVariantSet(id)}
                  />
                ))}
              </div>
            )}

            {totalVariants > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Variant Selections ({totalVariants})
                </span>
                {state.variantDecisions.map((vd) => (
                  <VariantDecisionCard
                    key={vd.setId}
                    decision={vd}
                    onChangeOption={(setId) => state.revertVariantDecision(setId)}
                    onDelete={(setId) => state.deleteVariantDecision(setId)}
                  />
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
            <span>{updateCopiedToast ? 'Copied "lux update"!' : `Update v${state.updateInfo.latestVersion}`}</span>
          </button>
        ) : (
          <span
            style={{ fontSize: '10px', color: 'var(--ve-text-muted, #64748b)', fontWeight: 500 }}
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
              <Fragment>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Submitted</span>
              </Fragment>
            ) : (
              <span>Submit Review</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
