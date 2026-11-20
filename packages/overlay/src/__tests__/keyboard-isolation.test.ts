// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { OverlayRoot } from '../overlay-root.js';
import { OverlayStateManager } from '../inspector/state.js';

describe('Overlay Keyboard Isolation (Shadow DOM)', () => {
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;
  let targetEl: HTMLDivElement;
  let state: OverlayStateManager;

  beforeEach(() => {
    document.body.innerHTML = '';

    targetEl = document.createElement('div');
    targetEl.id = 'slide-content';
    targetEl.textContent = 'Slide 1';
    document.body.appendChild(targetEl);

    hostEl = document.createElement('visual-edit-overlay');
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    document.body.appendChild(hostEl);

    state = OverlayStateManager.getInstance();
    state.setCommentTarget(null);
    state.setDrawerOpen(false);
    state.setActiveElement(null);
    state.setTool('none');

    render(h(OverlayRoot, { shadowRoot }), shadowRoot);
  });

  afterEach(() => {
    render(null, shadowRoot);
    hostEl.remove();
    targetEl.remove();
    vi.restoreAllMocks();
  });

  it('blocks keydown, keyup, and keypress from bubbling to host page shortcuts when typing in CommentComposer', () => {
    const windowKeyDown = vi.fn();
    const documentKeyDown = vi.fn();
    const windowKeyUp = vi.fn();
    const windowKeyPress = vi.fn();

    window.addEventListener('keydown', windowKeyDown);
    document.addEventListener('keydown', documentKeyDown);
    window.addEventListener('keyup', windowKeyUp);
    window.addEventListener('keypress', windowKeyPress);

    try {
      state.setCommentTarget(targetEl);
      render(h(OverlayRoot, { shadowRoot }), shadowRoot);

      const textarea = shadowRoot.querySelector('textarea.ve-comment-textarea') as HTMLTextAreaElement | null;
      expect(textarea).not.toBeNull();

      for (const type of ['keydown', 'keypress', 'keyup'] as const) {
        textarea!.dispatchEvent(
          new KeyboardEvent(type, {
            key: 'n',
            bubbles: true,
            composed: true,
            cancelable: true,
          })
        );
      }

      expect(windowKeyDown).not.toHaveBeenCalled();
      expect(documentKeyDown).not.toHaveBeenCalled();
      expect(windowKeyUp).not.toHaveBeenCalled();
      expect(windowKeyPress).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', windowKeyDown);
      document.removeEventListener('keydown', documentKeyDown);
      window.removeEventListener('keyup', windowKeyUp);
      window.removeEventListener('keypress', windowKeyPress);
    }
  });

  it('still allows Escape inside CommentComposer to close the popover without reaching host page', () => {
    const windowKeyDown = vi.fn();
    window.addEventListener('keydown', windowKeyDown);

    try {
      state.setCommentTarget(targetEl);
      render(h(OverlayRoot, { shadowRoot }), shadowRoot);

      const textarea = shadowRoot.querySelector('textarea.ve-comment-textarea') as HTMLTextAreaElement | null;
      expect(textarea).not.toBeNull();
      expect(state.commentTargetElement).toBe(targetEl);

      textarea!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );

      expect(state.commentTargetElement).toBeNull();
      expect(windowKeyDown).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', windowKeyDown);
    }
  });

  it('blocks keystrokes in EditReviewDrawer annotation editor from reaching host page shortcuts', () => {
    const windowKeyDown = vi.fn();
    window.addEventListener('keydown', windowKeyDown);

    try {
      state.addComment('Initial feedback', targetEl);
      state.setDrawerOpen(true);
      render(h(OverlayRoot, { shadowRoot }), shadowRoot);

      const commentText = shadowRoot.querySelector('.ve-card-comment-text') as HTMLElement | null;
      expect(commentText).not.toBeNull();
      commentText!.click();
      render(h(OverlayRoot, { shadowRoot }), shadowRoot);

      const textarea = shadowRoot.querySelector('textarea.ve-card-edit-textarea') as HTMLTextAreaElement | null;
      expect(textarea).not.toBeNull();

      textarea!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'n',
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );

      expect(windowKeyDown).not.toHaveBeenCalled();

      // Escape should cancel editing without closing the drawer or bubbling to host page
      textarea!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );

      expect(state.isDrawerOpen).toBe(true);
      expect(windowKeyDown).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', windowKeyDown);
      for (const ann of [...state.annotations]) {
        state.deleteAnnotation(ann.id);
      }
    }
  });

  it('still allows normal page shortcuts when typing outside the overlay', () => {
    const windowKeyDown = vi.fn();
    window.addEventListener('keydown', windowKeyDown);

    try {
      targetEl.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'n',
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );

      expect(windowKeyDown).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', windowKeyDown);
    }
  });
});
