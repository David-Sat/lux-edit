import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from '../inspector/state.js';
import { formatBatchSummary } from '@visual-edit/core';

export function EditReviewDrawer() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  if (!state.isDrawerOpen) return null;

  const totalMutations = state.mutations.length;
  const totalAnnotations = state.annotations.length;
  const totalItems = totalMutations + totalAnnotations;

  const handleCopyPrompt = async () => {
    const batch = state.getBatch();
    const summary = formatBatchSummary(batch);
    const fullPrompt = `Please implement the following visual modifications drafted in the browser overlay:\n\n${summary}\n\n${state.userPrompt ? `Additional Instructions: ${state.userPrompt}` : ''}`;

    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleSendToAgent = async () => {
    if (totalItems === 0 && !state.userPrompt.trim()) return;
    setIsSubmitting(true);
    try {
      await state.submitBatch();
    } finally {
      setTimeout(() => setIsSubmitting(false), 1000);
    }
  };

  const getStatusDisplay = () => {
    if (state.sessionStatus === 'in_progress') {
      return {
        label: 'Agent Working...',
        color: '#a855f7',
        dot: '#c084fc',
      };
    }
    if (state.sessionStatus === 'implemented') {
      return {
        label: 'Implemented',
        color: '#22c55e',
        dot: '#4ade80',
      };
    }
    if (state.sessionStatus === 'submitted') {
      return {
        label: 'Sent to Agent',
        color: '#38bdf8',
        dot: '#38bdf8',
      };
    }
    return {
      label: 'Live Synced',
      color: '#10b981',
      dot: '#10b981',
    };
  };

  const statusInfo = getStatusDisplay();

  return (
    <div
      class="ve-drawer"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div class="ve-drawer-header">
        <div class="ve-drawer-title">
          <span>Review Changes ({totalItems})</span>
          <span
            style={{
              fontSize: '11px',
              color: statusInfo.color,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusInfo.dot }}></span>
            {statusInfo.label}
          </span>
        </div>
        <button
          class="ve-mini-btn"
          style={{ width: '24px', flex: 'none' }}
          onClick={() => state.setDrawerOpen(false)}
        >
          ✕
        </button>
      </div>

      <div class="ve-drawer-body">
        {totalItems === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', color: '#64748b' }}>
            <p style={{ marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: '#94a3b8' }}>
              No visual edits or comments yet
            </p>
            <p style={{ fontSize: '12px' }}>
              Choose <strong>⚡ Visual Edit</strong> to tweak styles and text, or <strong>💬 Comment</strong> to attach feedback pins to elements.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Visual Mutations Section */}
            {totalMutations > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                    ⚡ Visual Edits ({totalMutations})
                  </span>
                </div>

                {state.mutations.map((m) => (
                  <div key={m.id} class="ve-mutation-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div class="ve-mut-target">
                        {m.sourceLocation?.componentName
                          ? `<${m.sourceLocation.componentName}>`
                          : m.targetSelector}
                        {m.property ? ` • ${m.property}` : ''}
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
                        ↩ Revert
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
                          <span class="ve-mut-before">{m.before}</span> ➔{' '}
                          <span class="ve-mut-after">{m.after}</span>
                          {m.tailwindSuggestion && (
                            <span style={{ color: '#38bdf8', marginLeft: '6px', fontSize: '11px' }}>
                              ({m.tailwindSuggestion})
                            </span>
                          )}
                        </div>
                      )}

                      {m.type === 'CLASS_CHANGE' && (
                        <div>
                          {m.details?.added?.length > 0 && (
                            <div style={{ color: '#22c55e' }}>+ {m.details.added.join(', ')}</div>
                          )}
                          {m.details?.removed?.length > 0 && (
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
                        <span style={{ color: '#38bdf8' }}>⇄ Reordered position</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comments & Pins Section */}
            {totalAnnotations > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase' }}>
                  💬 Comments & Pins ({totalAnnotations})
                </span>
                {state.annotations.map((ann, idx) => (
                  <div key={ann.id} class="ve-mutation-card" style={{ borderColor: '#4338ca' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span class="ve-mut-target" style={{ color: '#a5b4fc' }}>
                        Pin #{idx + 1} {ann.targetSelector ? `• ${ann.targetSelector}` : ''}
                      </span>
                      <button
                        style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                        onClick={() => state.deleteAnnotation(ann.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <p style={{ color: '#f8fafc', fontSize: '12px' }}>{ann.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div class="ve-prompt-box">
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
            Instructions for AI Agent (Optional)
          </span>
          <textarea
            class="ve-textarea"
            placeholder="Any extra instructions (e.g. 'Keep existing tests passing, make changes in Hero.tsx')..."
            value={state.userPrompt}
            onInput={(e) => state.setUserPrompt((e.target as HTMLTextAreaElement).value)}
          />
        </div>

        {state.agentReplies.length > 0 && (
          <div class="ve-replies-list">
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#a5b4fc' }}>
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

      <div class="ve-drawer-footer">
        <button
          class="ve-btn"
          onClick={() => state.revertAll()}
          title="Revert all visual edits and delete all comments"
        >
          Reset All
        </button>

        <button
          class="ve-btn"
          style={{ background: '#334155', color: '#f8fafc' }}
          onClick={handleCopyPrompt}
          disabled={totalItems === 0 && !state.userPrompt.trim()}
          title="Copy formatted prompt to paste into AI chat"
        >
          {copiedToast ? '✓ Copied!' : '📋 Copy Prompt'}
        </button>

        <button
          class="ve-btn primary"
          style={{ flex: 1, background: '#6366f1' }}
          onClick={handleSendToAgent}
          disabled={totalItems === 0 && !state.userPrompt.trim()}
          title="Wake up the waiting AI Agent to apply these changes immediately"
        >
          {isSubmitting
            ? 'Sending...'
            : state.sessionStatus === 'submitted'
            ? '⚡ Sent (Agent Waking...)'
            : state.sessionStatus === 'in_progress'
            ? '🤖 Agent Working...'
            : state.sessionStatus === 'implemented'
            ? '✅ Implemented'
            : '🚀 Send to Agent'}
        </button>
      </div>
    </div>
  );
}
