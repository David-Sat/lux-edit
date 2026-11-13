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
  }, [state]);

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
      <div class="ve-drawer-header">
        <div class="ve-drawer-title">
          <span>Review Changes</span>
          {totalItems > 0 && <span class="ve-drawer-badge">{totalItems}</span>}
        </div>

        <div class="ve-drawer-header-actions">
          <button
            class={`ve-mode-pill ${isLive ? 'is-live' : ''}`}
            onClick={() => state.setReviewMode(isLive ? 'batch' : 'live')}
            title={isLive ? 'Live Mode active (click to switch to Batch)' : 'Batch Mode active (click to switch to Live)'}
          >
            {isLive && <span class="ve-status-dot" />}
            <span class={`ve-mode-label ${isLive ? 'is-live' : ''}`}>{isLive ? 'Live' : 'Batch'}</span>
            <span class={`ve-mode-track ${isLive ? 'is-live' : ''}`}>
              <span class={`ve-mode-thumb ${isLive ? 'is-live' : ''}`} />
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
          <div class="ve-drawer-empty">
            <p class="ve-drawer-empty-text">No changes drafted yet</p>
          </div>
        ) : (
          <div class="ve-drawer-sections">
            {totalMutations > 0 && (
              <div class="ve-drawer-section">
                <div class="ve-drawer-section-header">
                  <span class="ve-drawer-section-title ve-drawer-section-title--accent">
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
              <div class="ve-drawer-section">
                <span class="ve-drawer-section-title">Comments & Pins ({totalAnnotations})</span>
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
              <div class="ve-drawer-section">
                <span class="ve-drawer-section-title ve-drawer-section-title--accent">
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
              <div class="ve-drawer-section">
                <span class="ve-drawer-section-title ve-drawer-section-title--green">
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
          <div class="ve-replies-list">
            <span class="ve-drawer-section-title">Agent Progress & Replies</span>
            {state.agentReplies.map((r) => (
              <div key={r.id} class="ve-reply-item">
                <div class="ve-reply-author">{r.agentId}</div>
                <div>{r.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="ve-drawer-autosave-bar">
        <div class="ve-drawer-autosave-status">
          {isLive && <span class="ve-status-dot ve-status-dot--live" />}
          <span>
            {isLive ? 'Live mode: changes stream to agent automatically' : 'Batch mode: click Submit when ready'}
          </span>
        </div>

        {state.updateInfo?.updateAvailable ? (
          <button
            class="ve-update-pill"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText('lux update');
                setUpdateCopiedToast(true);
                setTimeout(() => setUpdateCopiedToast(false), 2500);
              } catch (err) {
                console.debug('[lux] Clipboard copy failed:', err);
              }
            }}
            title={`v${state.updateInfo.latestVersion} available! Click to copy "lux update"`}
          >
            <span class="ve-status-dot ve-status-dot--accent" />
            <span>{updateCopiedToast ? 'Copied "lux update"!' : `Update v${state.updateInfo.latestVersion}`}</span>
          </button>
        ) : (
          <span class="ve-drawer-version" title="lux is up to date">
            v{state.version}
          </span>
        )}
      </div>

      <div class="ve-drawer-footer ve-drawer-footer--compact">
        <button
          class="ve-btn ve-footer-btn"
          onClick={() => state.revertAll()}
          title="Revert all visual edits and delete all comments"
        >
          Reset All
        </button>

        <button
          class="ve-btn ve-footer-btn"
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
            class="ve-btn primary ve-footer-btn ve-footer-btn--submit"
            onClick={() => state.submitBatch()}
            disabled={totalItems === 0}
            style={{ opacity: state.sessionStatus === 'submitted' ? 0.85 : 1 }}
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
