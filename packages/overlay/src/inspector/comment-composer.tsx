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
      computePosition(target, popoverRef.current, {
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
  }, [target]);

  if (!target || !document.body.contains(target)) return null;

  const sourceLoc = resolveSourceLocation(target);
  const tagLabel = sourceLoc.componentName ? `<${sourceLoc.componentName}>` : sourceLoc.selector;

  const handleSave = () => {
    if (commentText.trim()) {
      state.addComment(commentText, target);
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
      <div class="ve-comment-header">
        <span>💬 Comment on <strong style={{ color: '#38bdf8' }}>{tagLabel}</strong></span>
        <button
          class="ve-mini-btn"
          style={{ width: '20px', padding: '0', flex: 'none' }}
          onClick={() => state.setCommentTarget(null)}
        >
          ✕
        </button>
      </div>

      <textarea
        ref={textareaRef}
        class="ve-comment-textarea"
        placeholder="Type feedback, instruction, or bug note..."
        value={commentText}
        onInput={(e) => setCommentText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
      />

      <div class="ve-comment-footer">
        <span class="ve-hint">Press <strong>Enter ↵</strong> to save, <strong>Esc</strong> to cancel</span>
        <button
          class="ve-btn primary"
          style={{ padding: '5px 12px', fontSize: '11px' }}
          onClick={handleSave}
          disabled={!commentText.trim()}
        >
          Add Pin
        </button>
      </div>
    </div>
  );
}
