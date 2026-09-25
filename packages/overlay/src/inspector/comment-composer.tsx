import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';

export function CommentComposer() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [commentText, setCommentText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  const target = state.commentTargetElement;

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
    setCommentText('');
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
    if (commentText.trim()) {
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {isMulti ? (
              <span style={{ fontWeight: 600, color: 'var(--ve-text-primary)' }}>
                Comment on <strong style={{ color: 'var(--ve-accent-text, #38bdf8)' }}>{targets.length} elements</strong>
              </span>
            ) : selectedText ? (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Comment on <strong style={{ color: 'var(--ve-amber-text, #d97706)' }}>"{selectedText.length > 28 ? selectedText.slice(0, 28) + '…' : selectedText}"</strong>
              </span>
            ) : (
              <span>
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

      <textarea
        ref={textareaRef}
        class="ve-comment-textarea"
        placeholder="Type feedback, instruction, or relationship note..."
        value={commentText}
        onInput={(e) => {
          setCommentText((e.target as HTMLTextAreaElement).value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
      />

      <div class="ve-comment-footer">
        <span class="ve-hint">
          {isMulti ? (
            <span><strong>Shift+Click</strong> more to add/remove</span>
          ) : (
            <span><strong>Shift+Click</strong> to link more</span>
          )}
        </span>
        <button
          class="ve-btn primary"
          style={{ padding: '5px 12px', fontSize: '11px' }}
          onClick={handleSave}
          disabled={!commentText.trim()}
        >
          {isMulti ? `Add Pins (${targets.length})` : 'Add Pin'}
        </button>
      </div>
    </div>
  );
}
