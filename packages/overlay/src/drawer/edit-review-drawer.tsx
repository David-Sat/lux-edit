import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from '../inspector/state.js';
import { formatBatchSummary } from '@visual-edit/core';

export function EditReviewDrawer() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingAnnotationText, setEditingAnnotationText] = useState<string>('');

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

  const isAgentListening = state.isAgentListening;

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
    if (isAgentListening) {
      return {
        label: 'Agent Ready',
        color: '#a855f7',
        dot: '#c084fc',
      };
    }
    return {
      label: 'Drafting',
      color: '#94a3b8',
      dot: '#64748b',
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
              No changes drafted yet
            </p>
            <p style={{ fontSize: '12px' }}>
              Use <strong>Visual Edit (V)</strong> to tweak styles and text, or <strong>Comment (C)</strong> to drop feedback pins.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Visual Mutations Section */}
            {totalMutations > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Visual Edits ({totalMutations})
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
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Comments & Pins ({totalAnnotations})
                </span>
                {state.annotations.map((ann, idx) => {
                  const isEditing = editingAnnotationId === ann.id;
                  return (
                    <div key={ann.id} class="ve-mutation-card" style={{ borderColor: '#4338ca' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span class="ve-mut-target" style={{ color: '#a5b4fc' }}>
                          Pin #{idx + 1} {ann.targetSelector ? `• ${ann.targetSelector}` : ''}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {!isEditing && (
                            <button
                              style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
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

                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          <textarea
                            style={{
                              background: '#0f172a',
                              color: '#f8fafc',
                              border: '1px solid #6366f1',
                              borderRadius: '4px',
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
                              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '2px 6px' }}
                              onClick={() => setEditingAnnotationId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              style={{ background: '#6366f1', border: 'none', color: '#ffffff', borderRadius: '3px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', padding: '3px 8px' }}
                              onClick={() => {
                                state.updateAnnotation(ann.id, editingAnnotationText);
                                setEditingAnnotationId(null);
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          style={{ color: '#f8fafc', fontSize: '12px', cursor: 'pointer' }}
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
                  );
                })}
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

        {/* DEFAULT MODE: Clean, Full-Width Copy Prompt (When agent is not listening) */}
        {!isAgentListening ? (
          <button
            class="ve-btn primary"
            style={{ flex: 1, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={handleCopyPrompt}
            disabled={totalItems === 0 && !state.userPrompt.trim()}
            title="Copy formatted prompt to clipboard"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copiedToast ? 'Copied to Clipboard' : 'Copy Prompt for Chat'}
          </button>
        ) : (
          /* AGENT LISTENING MODE: Compact Copy + Send to Agent */
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <button
              class="ve-btn"
              style={{ background: '#334155', color: '#f8fafc', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleCopyPrompt}
              disabled={totalItems === 0 && !state.userPrompt.trim()}
              title="Copy formatted prompt to clipboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copiedToast ? 'Copied' : 'Copy'}
            </button>

            <button
              class="ve-btn primary"
              style={{ flex: 1, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={handleSendToAgent}
              disabled={totalItems === 0 && !state.userPrompt.trim()}
              title="Wake up the waiting AI Agent to apply these changes immediately"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {isSubmitting
                ? 'Sending...'
                : state.sessionStatus === 'submitted'
                ? 'Sent (Waiting...)'
                : state.sessionStatus === 'in_progress'
                ? 'Working...'
                : state.sessionStatus === 'implemented'
                ? 'Implemented'
                : 'Send to Agent'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
