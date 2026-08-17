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
    // Global mouse hover handler
    const handleMouseMove = (e: MouseEvent) => {
      if (state.activeTool === 'none') return;

      const target = e.target as HTMLElement | null;
      if (!target || target.closest('visual-edit-overlay') || target === document.body || target === document.documentElement) {
        state.setHoveredElement(null);
        return;
      }

      state.setHoveredElement(target);
    };

    // Global click handler
    const handleClick = (e: MouseEvent) => {
      if (state.activeTool === 'none') return;

      const target = e.target as HTMLElement | null;
      if (!target || target.closest('visual-edit-overlay')) return;

      e.preventDefault();
      e.stopPropagation();

      if (state.activeTool === 'edit') {
        state.setActiveElement(target);
      } else if (state.activeTool === 'comment') {
        state.setCommentTarget(target);
      }
    };

    // Global double-click for inline text editing (in Edit mode only)
    const handleDblClick = (e: MouseEvent) => {
      if (state.activeTool !== 'edit') return;

      const target = e.target as HTMLElement | null;
      if (!target || target.closest('visual-edit-overlay')) return;

      e.preventDefault();
      e.stopPropagation();

      target.contentEditable = 'plaintext-only';
      target.focus();

      const handleBlur = () => {
        target.contentEditable = 'inherit';
        state.updateElementText(target.innerText);
        target.removeEventListener('blur', handleBlur);
      };
      target.addEventListener('blur', handleBlur);
    };

    // Global keyboard shortcuts with stepped Escape handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Step 1: If comment composer popover is open, close composer
        if (state.commentTargetElement) {
          state.setCommentTarget(null);
          return;
        }

        // Step 2: If review drawer or theme panel is open, close it
        if (state.isDrawerOpen) {
          state.setDrawerOpen(false);
          return;
        }
        if (state.isThemePanelOpen) {
          state.setThemePanelOpen(false);
          return;
        }

        // Step 3: If an element is active/inspected, deselect it
        if (state.activeElement) {
          state.setActiveElement(null);
          return;
        }

        // Step 4: If a tool is active ('edit' or 'comment'), deselect tool BUT keep pill open
        if (state.activeTool !== 'none') {
          state.setTool('none');
          return;
        }

        // Step 5: When no tool is active, minimize pill dock back to launcher
        if (state.isDockMenuOpen) {
          state.setDockMenuOpen(false);
          return;
        }

        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable ||
          activeEl.closest('visual-edit-overlay'));

      if (isTyping) return;

      if (e.key === 'v' || e.key === 'V' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        state.setDockMenuOpen(true);
        state.setTool(state.activeTool === 'edit' ? 'none' : 'edit');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        state.setDockMenuOpen(true);
        state.setTool(state.activeTool === 'comment' ? 'none' : 'comment');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        state.setDockMenuOpen(true);
        state.setDrawerOpen(!state.isDrawerOpen);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('dblclick', handleDblClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('dblclick', handleDblClick, { capture: true });
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div>
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
