import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { OVERLAY_STYLES } from './inspector/styles.css.js';
import { OverlayStateManager } from './inspector/state.js';
import { supportsSvgBackdropFilter, useLiquidGlassMotion } from './inspector/liquid-glass.js';
import {
  OverlayHotkeyAction,
  hasCommandModifierInHotkey,
  matchesHotkeyEvent,
} from './inspector/hotkeys.js';
import {
  getShadowActiveElement,
  isEditableTargetInPath,
  isHotkeyCaptureTarget,
} from './inspector/keyboard-nav.js';
import { LiquidGlassDefs } from './inspector/liquid-glass-defs.js';
import { SelectionBox } from './inspector/selection-box.js';
import { FloatingToolbar } from './inspector/floating-toolbar.js';
import { CommentComposer } from './inspector/comment-composer.js';
import { CommentPins } from './inspector/comment-pins.js';
import { VoicePins } from './inspector/voice-pins.js';
import { DockMenu } from './inspector/dock-menu.js';
import { EditReviewDrawer } from './drawer/edit-review-drawer.js';
import { VariantSwitcher } from './inspector/variant-switcher.js';
import { VerificationHalo } from './inspector/verification-halo.js';
import {
  INSPECT_DISABLED_STYLE_ATTR,
  INSPECT_DISABLED_STYLE_CSS,
  isDisabledElement,
  resolveInspectTarget,
} from './inspector/inspect-target.js';

export function OverlayRoot({ shadowRoot }: { shadowRoot: ShadowRoot }) {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, [state]);

  const isInspecting = state.activeTool !== 'none';

  useEffect(() => {
    if (!isInspecting || typeof document === 'undefined') return;
    const styleEl = document.createElement('style');
    styleEl.setAttribute(INSPECT_DISABLED_STYLE_ATTR, 'true');
    styleEl.textContent = INSPECT_DISABLED_STYLE_CSS;
    const host = document.head || document.documentElement;
    host?.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [isInspecting]);

  useEffect(() => {
    const isOverlayElement = (el: Element): boolean =>
      el.tagName.toLowerCase() === 'visual-edit-overlay' ||
      Boolean(el.closest('[data-lux-workbench-ui]'));

    const isInsideShadow = (e: Event): boolean => {
      try {
        const path = e.composedPath ? e.composedPath() : [];
        for (const node of path) {
          if (node === shadowRoot) return true;
          const el = node as HTMLElement;
          if (el && el.tagName && el.tagName.toLowerCase() === 'visual-edit-overlay') return true;
          if (el && el.dataset && el.dataset.luxWorkbenchUi !== undefined) return true;
        }
      } catch (err) {
        console.debug('[lux] Failed to inspect composedPath:', err);
      }
      return false;
    };

    let currentInlineEl: HTMLElement | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (state.activeTool === 'none') return;
      if (isInsideShadow(e)) {
        state.setHoveredElement(null);
        return;
      }

      const target = resolveInspectTarget(e, isOverlayElement);
      if (!target || target === document.body || target === document.documentElement) {
        state.setHoveredElement(null);
        return;
      }

      state.setHoveredElement(target);
    };

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
          } catch (err) {
            console.debug('[lux] Failed to capture selected text range:', err);
          }
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (state.activeTool === 'none') return;
      if (isInsideShadow(e)) {
        return;
      }

      const target = resolveInspectTarget(e, isOverlayElement);
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
        // Otherwise, if it was a plain click without selection, target the entire element or toggle with Shift.
        if (!hasSelection && !state.commentTargetSelectedText) {
          if (e.shiftKey) {
            state.toggleCommentTarget(target);
          } else {
            state.setCommentTarget(target);
          }
        }
      } else if (state.activeTool === 'voice') {
        const isMulti = Boolean(e.shiftKey || e.metaKey || e.ctrlKey);
        state.recordVoicePin(target, isMulti);
      } else if (state.activeTool === 'screenshot') {
        state.snapElementToComposer(target);
      }
    };

    // Global double-click for inline text editing in the DOM (in Edit mode only)
    const handleDblClick = (e: MouseEvent) => {
      if (state.activeTool !== 'edit') return;
      if (isInsideShadow(e)) return;

      const target = resolveInspectTarget(e, isOverlayElement);
      if (!target || target === document.body || target === document.documentElement) return;

      e.preventDefault();
      e.stopPropagation();

      state.setActiveElement(target);
      if (isDisabledElement(target)) {
        return;
      }

      currentInlineEl = target;

      try {
        target.contentEditable = 'plaintext-only';
      } catch {
        target.contentEditable = 'true';
      }
      target.spellcheck = false;
      target.focus();

      try {
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch (err) {
        console.debug('[lux] Failed to preselect inline-edited element text:', err);
      }

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

      const stopInlineKeyPropagation = (ke: KeyboardEvent) => {
        ke.stopPropagation();
      };

      const handleBlur = () => {
        target.contentEditable = 'inherit';
        target.style.outline = prevOutline;
        target.style.outlineOffset = prevOutlineOffset;
        state.syncMutationsForElement(target);
        state.notify();
        target.removeEventListener('input', handleInput);
        target.removeEventListener('keydown', handleInlineKeyDown);
        target.removeEventListener('keyup', stopInlineKeyPropagation);
        target.removeEventListener('keypress', stopInlineKeyPropagation);
        target.removeEventListener('blur', handleBlur);
        if (currentInlineEl === target) {
          currentInlineEl = null;
        }
      };

      target.addEventListener('input', handleInput);
      target.addEventListener('keydown', handleInlineKeyDown);
      target.addEventListener('keyup', stopInlineKeyPropagation);
      target.addEventListener('keypress', stopInlineKeyPropagation);
      target.addEventListener('blur', handleBlur);
    };

    const isElEditable = (node: HTMLElement | null): boolean =>
      Boolean(
        node &&
          (node.tagName === 'INPUT' ||
            node.tagName === 'TEXTAREA' ||
            node.tagName === 'SELECT' ||
            node.isContentEditable)
      );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isHotkeyCaptureTarget(e)) return;

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

      const activeLightEl = document.activeElement as HTMLElement | null;
      const activeShadowEl = getShadowActiveElement(shadowRoot);
      const isTyping =
        isElEditable(activeLightEl) ||
        isElEditable(activeShadowEl) ||
        isEditableTargetInPath(e, shadowRoot) ||
        !!currentInlineEl;

      const triggerAction = (action: OverlayHotkeyAction) => {
        e.preventDefault();
        e.stopPropagation();
        if (action === 'edit') {
          state.setDockMenuOpen(true);
          state.setTool(state.activeTool === 'edit' ? 'none' : 'edit');
        } else if (action === 'comment') {
          state.setDockMenuOpen(true);
          state.setTool(state.activeTool === 'comment' ? 'none' : 'comment');
        } else if (action === 'voice') {
          state.setDockMenuOpen(true);
          state.setTool(state.activeTool === 'voice' ? 'none' : 'voice');
        } else if (action === 'screenshot') {
          state.setDockMenuOpen(true);
          state.setTool(state.activeTool === 'screenshot' ? 'none' : 'screenshot');
        } else if (action === 'drawer') {
          const nextOpen = !state.isDrawerOpen;
          if (nextOpen) {
            state.setDockMenuOpen(true);
          }
          state.setDrawerOpen(nextOpen);
        }
      };

      const actionOrder: OverlayHotkeyAction[] = [
        'edit',
        'comment',
        'voice',
        'screenshot',
        'drawer',
      ];
      for (const action of actionOrder) {
        const binding = state.hotkeys[action];
        if (!binding) continue;
        if (!hasCommandModifierInHotkey(binding) && isTyping) continue;
        if (matchesHotkeyEvent(e, binding)) {
          triggerAction(action);
          return;
        }
      }

      if (
        !isTyping &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'e' &&
        state.hotkeys.edit === 'v' &&
        !Object.values(state.hotkeys).includes('e')
      ) {
        triggerAction('edit');
        return;
      }

      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === '?') {
        e.preventDefault();
        e.stopPropagation();
        const isCurrentlyShowingShortcuts = state.isDrawerOpen && state.isShortcutsPanelOpen;
        state.setShortcutsPanelOpen(!isCurrentlyShowingShortcuts);
      }
    };

    const handleShadowKeyboardEvent = (e: Event) => {
      const isCapturingHotkey = isHotkeyCaptureTarget(e);
      const isEditable = isEditableTargetInPath(e, shadowRoot);
      if (!isEditable && !isCapturingHotkey) return;

      // Prevent keystrokes inside overlay inputs/textareas or active hotkey capture buttons
      // from bubbling out of the Shadow DOM to the host page, where Shadow DOM retargeting
      // would hide the target and accidentally trigger page-level keyboard shortcuts.
      e.stopPropagation();

      const ke = e as KeyboardEvent;
      if (
        e.type === 'keydown' &&
        ke.key === 'Escape' &&
        !ke.defaultPrevented &&
        !isCapturingHotkey
      ) {
        if (state.commentTargetElement) {
          state.setCommentTarget(null);
        } else if (state.isDrawerOpen) {
          state.setDrawerOpen(false);
        } else if (state.activeElement) {
          state.setActiveElement(null);
        }
      }
    };

    shadowRoot.addEventListener('keydown', handleShadowKeyboardEvent);
    shadowRoot.addEventListener('keyup', handleShadowKeyboardEvent);
    shadowRoot.addEventListener('keypress', handleShadowKeyboardEvent);

    document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('dblclick', handleDblClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (currentInlineEl) {
        currentInlineEl.blur();
      }
      shadowRoot.removeEventListener('keydown', handleShadowKeyboardEvent);
      shadowRoot.removeEventListener('keyup', handleShadowKeyboardEvent);
      shadowRoot.removeEventListener('keypress', handleShadowKeyboardEvent);
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('dblclick', handleDblClick, { capture: true });
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shadowRoot, state]);

  const dockPos = state.dockPosition;
  const isLeft = dockPos.side === 'left';
  const isTop = dockPos.verticalAnchor === 'top';
  const panelOffsetY = Math.max(78, dockPos.offsetY + 54);
  const svgSupported = useMemo(() => supportsSvgBackdropFilter(), []);
  const isSvgRefract = state.glassMode === 'svg-refract' && svgSupported;
  const tuning = state.glassTuning;

  useLiquidGlassMotion(shadowRoot, tuning.pointerGlint);

  const toneClass = tuning.surfaceTone === 'dark' ? 've-glass-obsidian' : 've-glass-clear';
  const panelRefractClass = isSvgRefract && tuning.refractPanels ? 've-glass-refract-panels' : '';
  const hasActiveDockOption =
    state.activeTool !== 'none' || state.isDrawerOpen || state.reviewMode === 'live';

  const isLauncherVisible = !state.isDockMenuOpen && state.activeTool === 'none';
  const isDockVisible = !isLauncherVisible;
  const hasPins = state.annotations.length > 0;
  const hasVoicePins =
    (state.activeTool === 'voice' && state.activeVoicePins.length > 0) ||
    state.voiceReviews.length > 0;
  const isDrawerVisible = state.isDrawerOpen;
  const isToolbarVisible = state.activeTool === 'edit' && Boolean(state.activeElement);
  const isComposerVisible = Boolean(state.commentTargetElement);
  const hasVariantSwitcher = state.variantSets.some(
    (s) => s.status === 'pending' || s.status === 'decided'
  );

  const activeSurfaces = useMemo(
    () => ({
      launcher: isLauncherVisible,
      dock: isDockVisible,
      pins: hasPins,
      voicePins: hasVoicePins,
      drawer: isDrawerVisible,
      toolbar: isToolbarVisible,
      composer: isComposerVisible,
      switcher: hasVariantSwitcher,
    }),
    [
      isLauncherVisible,
      isDockVisible,
      hasPins,
      hasVoicePins,
      isDrawerVisible,
      isToolbarVisible,
      isComposerVisible,
      hasVariantSwitcher,
    ]
  );

  return (
    <div
      class={`ve-root ${isLeft ? 've-dock-left' : 've-dock-right'} ${isTop ? 've-dock-top' : 've-dock-bottom'} ve-glass-liquid ${isSvgRefract ? 've-glass-svg' : ''} ${toneClass} ${panelRefractClass}`}
      style={{
        '--ve-dock-offset-y': `${dockPos.offsetY}px`,
        '--ve-panel-offset-y': `${panelOffsetY}px`,
        '--ve-lg-tint': String(tuning.tintOpacity),
        '--ve-lg-spec': String(tuning.specularOpacity),
        '--ve-lg-panel-blur': `${tuning.panelBlurPx}px`,
        '--ve-lg-hero-blur': `${tuning.heroBlurPx}px`,
        '--ve-lg-sat': `${tuning.saturatePct}%`,
      }}
    >
      <style>{OVERLAY_STYLES}</style>
      <LiquidGlassDefs
        shadowRoot={shadowRoot}
        tuning={tuning}
        enabled={isSvgRefract}
        activeBoost={hasActiveDockOption}
        activeSurfaces={activeSurfaces}
      />
      <SelectionBox />
      <FloatingToolbar />
      <CommentComposer />
      <CommentPins />
      <VoicePins />
      <VariantSwitcher />
      <VerificationHalo />
      <DockMenu />
      <EditReviewDrawer />
    </div>
  );
}
