import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';
import { captureVisualSnapshot } from './visual-capture.js';

export function CommentComposer() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isSnapping, setIsSnapping] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  const target = state.commentTargetElement;
  const hasScreenshot = Boolean(state.commentPendingScreenshot);

  useEffect(() => {
    if (!target || !popoverRef.current) return;

    const updatePos = () => {
      if (!target || !popoverRef.current) return;

      const anchor = state.commentTargetBounds
        ? {
            getBoundingClientRect: () =>
              ({
                x: state.commentTargetBounds!.x,
                y: state.commentTargetBounds!.y,
                top: state.commentTargetBounds!.y,
                left: state.commentTargetBounds!.x,
                right: state.commentTargetBounds!.x + state.commentTargetBounds!.width,
                bottom: state.commentTargetBounds!.y + state.commentTargetBounds!.height,
                width: state.commentTargetBounds!.width,
                height: state.commentTargetBounds!.height,
              } as DOMRect),
          }
        : target;

      computePosition(anchor, popoverRef.current, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(8), flip(), shift({ padding: 10 })],
      }).then(({ x, y }) => {
        if (popoverRef.current) {
          popoverRef.current.style.left = `${x}px`;
          popoverRef.current.style.top = `${y}px`;
        }
      });
    };

    updatePos();
    setCommentText(state.commentDraftText || '');
    setTimeout(() => textareaRef.current?.focus(), 50);

    window.addEventListener('scroll', updatePos, { passive: true });
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos);
      window.removeEventListener('resize', updatePos);
    };
  }, [target, state.commentTargetBounds]);

  if (!target || !document.body.contains(target)) return null;

  const sourceLoc = resolveSourceLocation(target);
  const tagLabel = sourceLoc.componentName ? `<${sourceLoc.componentName}>` : sourceLoc.selector;
  const selectedText = state.commentTargetSelectedText;

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const computedHeight = Math.min(Math.max(el.scrollHeight, 72), 240);
    el.style.height = `${computedHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [commentText]);

  const handleSave = () => {
    if (commentText.trim() || hasScreenshot) {
      state.addComment(commentText);
      setCommentText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      state.setCommentTarget(null);
    }
  };

  const targets = state.commentTargetElements.filter((el) => document.body.contains(el));
  const isMulti = targets.length > 1;

  return (
    <div
      ref={popoverRef}
      class="ve-comment-popover"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div class="ve-comment-header" style={{ flexDirection: isMulti ? 'column' : 'row', alignItems: isMulti ? 'stretch' : 'center', gap: isMulti ? '6px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hasScreenshot ? (
              <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Screenshot: <strong style={{ color: '#fbbf24' }}>{tagLabel}</strong>
              </span>
            ) : isMulti ? (
              <span style={{ fontWeight: 600, color: 'var(--ve-text-primary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comment on <strong style={{ color: 'var(--ve-accent-text, #38bdf8)' }}>{targets.length} elements</strong>
              </span>
            ) : selectedText ? (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comment on <strong style={{ color: 'var(--ve-amber-text, #d97706)' }}>"{selectedText.length > 28 ? selectedText.slice(0, 28) + '…' : selectedText}"</strong>
              </span>
            ) : (
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comment on <strong style={{ color: 'var(--ve-accent-text, #0284c7)' }}>{tagLabel}</strong>
              </span>
            )}
          </span>
          <button
            class="ve-close-btn"
            style={{ inlineSize: '20px', blockSize: '20px' }}
            onClick={() => state.setCommentTarget(null)}
            title="Cancel (Esc)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {isMulti && (
          <div class="ve-comment-targets-list">
            {targets.map((tEl) => {
              const loc = resolveSourceLocation(tEl);
              const label = loc.componentName ? `<${loc.componentName}>` : loc.selector;
              return (
                <span key={loc.selector} class="ve-comment-target-chip" title={label}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                  <button
                    class="ve-chip-remove"
                    title="Remove from linked elements"
                    onClick={() => state.removeCommentTarget(tEl)}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {hasScreenshot && (
        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.16)', background: 'rgba(0, 0, 0, 0.45)' }}>
          <img
            src={state.commentPendingScreenshot}
            alt="Screenshot capture"
            style={{
              display: 'block',
              width: '100%',
              maxHeight: '120px',
              objectFit: 'contain',
              background: '#090d16',
            }}
          />
          <button
            type="button"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'rgba(0, 0, 0, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '11px',
              lineHeight: 1,
            }}
            onClick={() => state.setPendingScreenshot(undefined)}
            title="Detach screenshot"
          >
            ×
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        class="ve-comment-textarea"
        placeholder={
          hasScreenshot
            ? 'Describe what to change, fix, or note about this screenshot...'
            : 'Type feedback, instruction, or relationship note...'
        }
        value={commentText}
        onInput={(e) => {
          const val = (e.target as HTMLTextAreaElement).value;
          setCommentText(val);
          state.setCommentDraftText(val);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
      />

      <div class="ve-comment-footer" style={{ gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
          {!hasScreenshot && target && (
            <button
              type="button"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '6px',
                color: 'var(--ve-text-secondary)',
                fontSize: '11px',
                padding: '3px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
              disabled={isSnapping}
              onClick={async () => {
                if (isSnapping) return;
                setIsSnapping(true);
                try {
                  const loc = resolveSourceLocation(target);
                  const selector = loc.selector || (target.id ? `#${target.id}` : target.tagName.toLowerCase());
                  const snap = await captureVisualSnapshot({
                    selector,
                    resolution: 'draft',
                    includeOverlay: false,
                  });
                  if (snap && snap.success && snap.imageBase64) {
                    state.setPendingScreenshot(snap.imageBase64);
                  }
                } catch (err) {
                  console.warn('[lux] Failed to capture visual snapshot:', err);
                } finally {
                  setIsSnapping(false);
                }
              }}
              title="Attach screenshot of element"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{isSnapping ? 'Snapping...' : 'Snap Visual'}</span>
            </button>
          )}
          <span class="ve-hint" style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {state.pendingPageReload ? (
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>● Update ready • will refresh on save</span>
            ) : hasScreenshot ? (
              <span><strong>Enter</strong> to attach</span>
            ) : isMulti ? (
              <span><strong>Shift+Click</strong> more to add/remove</span>
            ) : (
              <span><strong>Shift+Click</strong> to link more</span>
            )}
          </span>
        </div>
        <button
          class="ve-btn primary"
          style={{ padding: '5px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
          onClick={handleSave}
          disabled={!commentText.trim() && !hasScreenshot}
        >
          {hasScreenshot ? 'Add Screenshot' : isMulti ? `Add Pins (${targets.length})` : 'Add Pin'}
        </button>
      </div>
    </div>
  );
}
