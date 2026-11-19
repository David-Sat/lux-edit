import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
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
  const latestDraftRef = useRef(state.commentDraftText);
  latestDraftRef.current = state.commentDraftText;

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, [state]);

  const target = state.commentTargetElement;
  const commentTargetBounds = state.commentTargetBounds;
  const hasScreenshot = Boolean(state.commentPendingScreenshot);
  const targets =
    typeof document !== 'undefined' && document.body
      ? state.commentTargetElements.filter((el) => document.body.contains(el))
      : [];
  const isMulti = targets.length > 1;

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

  const updatePos = useCallback(() => {
    if (!target || !popoverRef.current) return;

    const anchorRect = commentTargetBounds
      ? ({
          x: commentTargetBounds.x,
          y: commentTargetBounds.y,
          top: commentTargetBounds.y,
          left: commentTargetBounds.x,
          right: commentTargetBounds.x + commentTargetBounds.width,
          bottom: commentTargetBounds.y + commentTargetBounds.height,
          width: commentTargetBounds.width,
          height: commentTargetBounds.height,
        } as DOMRect)
      : target.getBoundingClientRect();

    const anchor = commentTargetBounds
      ? { getBoundingClientRect: () => anchorRect }
      : target;

    computePosition(anchor, popoverRef.current, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [offset(8), flip({ crossAxis: false }), shift({ padding: 10, crossAxis: true })],
    }).then(({ x, y }) => {
      const currentPopover = popoverRef.current;
      if (!currentPopover) return;
      const vw = window.innerWidth || document.documentElement.clientWidth || 1000;
      const vh = window.innerHeight || document.documentElement.clientHeight || 800;
      const popRect = currentPopover.getBoundingClientRect();
      const popWidth = popRect.width || currentPopover.offsetWidth || 360;
      const popHeight = popRect.height || currentPopover.offsetHeight || 180;

      let nextX = x;
      let nextY = y;

      if (anchorRect.top < popHeight + 18 && anchorRect.bottom + 8 + popHeight > vh - 10) {
        nextY = Math.max(10, anchorRect.top + 12);
      }

      const maxX = Math.max(10, vw - popWidth - 10);
      const maxY = Math.max(10, vh - popHeight - 10);
      nextX = Math.min(Math.max(10, nextX), maxX);
      nextY = Math.min(Math.max(10, nextY), maxY);

      currentPopover.style.left = `${nextX}px`;
      currentPopover.style.top = `${nextY}px`;
    });
  }, [target, commentTargetBounds]);

  useEffect(() => {
    if (!target) return;
    setCommentText(latestDraftRef.current || '');
    const focusTimer = setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(focusTimer);
  }, [target, commentTargetBounds]);

  useEffect(() => {
    if (!target || !popoverRef.current) return;

    updatePos();
    window.addEventListener('scroll', updatePos, { passive: true });
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos);
      window.removeEventListener('resize', updatePos);
    };
  }, [target, commentTargetBounds, hasScreenshot, isMulti, commentText, updatePos]);

  if (!target || !document.body.contains(target)) return null;

  const sourceLoc = resolveSourceLocation(target);
  const tagLabel = sourceLoc.componentName ? `<${sourceLoc.componentName}>` : sourceLoc.selector;
  const selectedText = state.commentTargetSelectedText;

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

  return (
    <div
      ref={popoverRef}
      class="ve-comment-popover"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div class={`ve-comment-header ${isMulti ? 'is-multi' : ''}`}>
        <div class="ve-comment-header-row">
          <span class="ve-comment-header-label">
            {hasScreenshot ? (
              <span class="ve-comment-screenshot-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Screenshot: <strong class="ve-comment-screenshot-tag">{tagLabel}</strong>
              </span>
            ) : isMulti ? (
              <span class="ve-comment-multi-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comment on <strong class="ve-comment-accent-strong">{targets.length} elements</strong>
              </span>
            ) : selectedText ? (
              <span class="ve-comment-selected-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comment on <strong class="ve-comment-selected-strong">"{selectedText.length > 28 ? selectedText.slice(0, 28) + '…' : selectedText}"</strong>
              </span>
            ) : (
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comment on <strong class="ve-comment-accent-strong">{tagLabel}</strong>
              </span>
            )}
          </span>
          <button
            class="ve-close-btn ve-close-btn--compact"
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
                  <span class="ve-comment-chip-label">{label}</span>
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
        <div class="ve-composer-screenshot-box">
          <img
            src={state.commentPendingScreenshot}
            alt="Screenshot capture"
            class="ve-composer-screenshot-img"
            onLoad={updatePos}
          />
          <button
            type="button"
            class="ve-composer-screenshot-detach"
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

      <div class="ve-comment-footer">
        <div class="ve-comment-footer-left">
          {!hasScreenshot && target && (
            <button
              type="button"
              class="ve-composer-snap-btn"
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
          <span class="ve-hint ve-composer-hint">
            {state.pendingPageReload ? (
              <span class="ve-composer-reload-ready">● Update ready • will refresh on save</span>
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
          class="ve-btn primary ve-composer-submit-btn"
          onClick={handleSave}
          disabled={!commentText.trim() && !hasScreenshot}
        >
          {hasScreenshot ? 'Add Screenshot' : isMulti ? `Add Pins (${targets.length})` : 'Add Pin'}
        </button>
      </div>
    </div>
  );
}
