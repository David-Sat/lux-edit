import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { OVERLAY_STYLES } from './inspector/styles.css.js';
import { OverlayStateManager } from './inspector/state.js';
import { SelectionBox } from './inspector/selection-box.js';
import { FloatingToolbar } from './inspector/floating-toolbar.js';
import { CommentComposer } from './inspector/comment-composer.js';
import { CommentPins } from './inspector/comment-pins.js';
import { DockMenu } from './inspector/dock-menu.js';
import { EditReviewDrawer } from './drawer/edit-review-drawer.js';
import { ThemePanel } from './inspector/theme-panel.js';

export function OverlayRoot({ shadowRoot }: { shadowRoot: ShadowRoot }) {
  const state = OverlayStateManager.getInstance();

  useEffect(() => {
    // Check if event occurred inside our shadow DOM
    const isInsideShadow = (e: Event): boolean => {
      try {
        const path = e.composedPath ? e.composedPath() : [];
        for (const node of path) {
          if (node === shadowRoot) return true;
          const el = node as HTMLElement;
          if (el && el.tagName && el.tagName.toLowerCase() === 'visual-edit-overlay') return true;
        }
      } catch (err) {}
      return false;
    };

    let currentInlineEl: HTMLElement | null = null;

    // Global mouse hover handler
    const handleMouseMove = (e: MouseEvent) => {
      if (state.activeTool === 'none') return;
      if (isInsideShadow(e)) {
        state.setHoveredElement(null);
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target || target === document.body || target === document.documentElement) {
        state.setHoveredElement(null);
        return;
      }

      state.setHoveredElement(target);
    };

    // Global mouseup handler to detect text selection in Comment mode
    const handleMouseUp = (e: MouseEvent) => {
      if (state.activeTool !== 'comment') return;
      if (isInsideShadow(e)) return;

      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const text = selection.toString().trim();
        if (text.length > 0) {
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            let container: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
            if (container && container.nodeType === Node.TEXT_NODE) {
              container = container.parentElement;
            }
            if (container && !isInsideShadow(e)) {
              state.setCommentTarget(container, {
                selectedText: text,
                bounds: {
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height,
                },
              });
            }
          } catch (err) {}
        }
      }
    };

    // Global click handler
    const handleClick = (e: MouseEvent) => {
      if (state.activeTool === 'none') return;
      if (isInsideShadow(e)) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target || target === document.body || target === document.documentElement) return;

      // If user is clicking inside the element currently being edited inline,
      // allow native cursor positioning and text selection.
      if (target === currentInlineEl || (currentInlineEl && currentInlineEl.contains(target))) {
        return;
      }

      // If another element was being edited inline, blur it to finalize editing
      if (currentInlineEl && target !== currentInlineEl) {
        currentInlineEl.blur();
      }

      const selection = window.getSelection();
      const hasSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;

      e.preventDefault();
      e.stopPropagation();

      if (state.activeTool === 'edit') {
        state.setActiveElement(target);
      } else if (state.activeTool === 'comment') {
        // If a text selection occurred (handled by handleMouseUp), keep the text selection target.
        // Otherwise, if it was a plain click without selection, target the entire element.
        if (!hasSelection && !state.commentTargetSelectedText) {
          state.setCommentTarget(target);
        }
      }
    };

    // Global double-click for inline text editing in the DOM (in Edit mode only)
    const handleDblClick = (e: MouseEvent) => {
      if (state.activeTool !== 'edit') return;
      if (isInsideShadow(e)) return;

      const target = e.target as HTMLElement | null;
      if (!target || target === document.body || target === document.documentElement) return;

      e.preventDefault();
      e.stopPropagation();

      state.setActiveElement(target);
      currentInlineEl = target;

      // Enable inline content editing directly on the DOM element
      try {
        target.contentEditable = 'plaintext-only';
      } catch (err) {
        target.contentEditable = 'true';
      }
      target.spellcheck = false;
      target.focus();

      // Select all text on double click so user can type over or click to place cursor
      try {
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch (err) {}

      // Visual indicator for active inline DOM editing
      const prevOutline = target.style.outline;
      const prevOutlineOffset = target.style.outlineOffset;
      target.style.outline = '2px dashed #38bdf8';
      target.style.outlineOffset = '2px';

      const handleInput = () => {
        state.syncMutationsForElement(target);
        state.notify();
      };

      const handleInlineKeyDown = (ke: KeyboardEvent) => {
        ke.stopPropagation();
        if (ke.key === 'Escape') {
          ke.preventDefault();
          target.blur();
        } else if (ke.key === 'Enter' && !ke.shiftKey) {
          const tag = (target.tagName || '').toUpperCase();
          const isSingleLineTag = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'A', 'SPAN', 'LABEL', 'P'].includes(tag);
          if (isSingleLineTag) {
            ke.preventDefault();
            target.blur();
          }
        }
      };

      const handleBlur = () => {
        target.contentEditable = 'inherit';
        target.style.outline = prevOutline;
        target.style.outlineOffset = prevOutlineOffset;
        state.syncMutationsForElement(target);
        state.notify();
        target.removeEventListener('input', handleInput);
        target.removeEventListener('keydown', handleInlineKeyDown);
        target.removeEventListener('blur', handleBlur);
        if (currentInlineEl === target) {
          currentInlineEl = null;
        }
      };

      target.addEventListener('input', handleInput);
      target.addEventListener('keydown', handleInlineKeyDown);
      target.addEventListener('blur', handleBlur);
    };

    // Global keyboard shortcuts with stepped Escape handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentInlineEl) {
          currentInlineEl.blur();
          return;
        }
        if (state.commentTargetElement) {
          state.setCommentTarget(null);
          return;
        }
        if (state.isDrawerOpen) {
          state.setDrawerOpen(false);
          return;
        }
        if (state.isThemePanelOpen) {
          state.setThemePanelOpen(false);
          return;
        }
        if (state.activeElement) {
          state.setActiveElement(null);
          return;
        }
        if (state.activeTool !== 'none') {
          state.setTool('none');
          return;
        }
        if (state.isDockMenuOpen) {
          state.setDockMenuOpen(false);
          return;
        }
        return;
      }

      // Ignore modified keys (Cmd, Ctrl, Alt) to prevent blocking browser actions (e.g. Cmd+Shift+R, Cmd+R, Cmd+C, Cmd+V, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isTyping =
        (activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable ||
            isInsideShadow(e))) ||
        !!currentInlineEl;

      if (isTyping) return;

      if (e.key === 'v' || e.key === 'V' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        state.setDockMenuOpen(true);
        state.setTool(state.activeTool === 'edit' ? 'none' : 'edit');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        state.setDockMenuOpen(true);
        state.setTool(state.activeTool === 'comment' ? 'none' : 'comment');
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('dblclick', handleDblClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (currentInlineEl) {
        currentInlineEl.blur();
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('dblclick', handleDblClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shadowRoot]);

  return (
    <div class="ve-root">
      <style>{OVERLAY_STYLES}</style>
      <SelectionBox />
      <FloatingToolbar />
      <CommentComposer />
      <CommentPins />
      <DockMenu />
      <EditReviewDrawer />
      <ThemePanel />
    </div>
  );
}
