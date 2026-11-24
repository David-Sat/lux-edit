import { h } from 'preact';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';
import { locateElementRect, useAnchoredOverlaySync } from './pin-position.js';

export function SelectionBox() {
  const state = OverlayStateManager.getInstance();
  const { anchorRef, needsDocScrollSyncRef, measureAnchor } = useAnchoredOverlaySync({
    state,
    anchorKey: `${state.activeTool}:${Boolean(state.hoveredElement)}:${Boolean(state.activeElement)}:${Boolean(state.commentTargetElement)}:${state.commentTargetElements.length}`,
  });

  if (state.activeTool === 'none') {
    needsDocScrollSyncRef.current = false;
    return null;
  }

  const anchor = measureAnchor();

  let hasDynamicScrollTarget = false;

  const renderBox = (el: HTMLElement, isActive: boolean, keyPrefix: string) => {
    if (!el || !document.body.contains(el)) return null;

    const pos = locateElementRect(el, anchor);
    if (pos.dynamicScroll) {
      hasDynamicScrollTarget = true;
    }

    const sourceLoc = resolveSourceLocation(el);
    const label = sourceLoc.componentName
      ? `<${sourceLoc.componentName}>`
      : el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');

    const dim = `${Math.round(pos.rect.width)} × ${Math.round(pos.rect.height)}`;
    const isCommentMode = state.activeTool === 'comment';
    const isScreenshotMode = state.activeTool === 'screenshot';
    const badgeInside = pos.viewportRect.top < 28 || (!pos.fixed && pos.rect.top < 28);

    return (
      <div
        key={`${keyPrefix}_${pos.fixed ? 'fixed' : 'doc'}`}
        class={`ve-highlight-box ${isActive ? 've-active' : ''} ${isCommentMode ? 've-comment-mode' : ''} ${isScreenshotMode ? 've-screenshot-mode' : ''}`}
        style={{
          position: pos.fixed ? 'fixed' : undefined,
          top: `${pos.rect.top}px`,
          left: `${pos.rect.left}px`,
          width: `${pos.rect.width}px`,
          height: `${pos.rect.height}px`,
        }}
      >
        <div class={`ve-badge ${badgeInside ? 've-badge--inside' : ''}`}>
          {isScreenshotMode ? <span>[Snap Screenshot] {label}</span> : <span>{label}</span>}
          <span class="ve-badge-dim">{dim}</span>
        </div>
      </div>
    );
  };

  const hoverBox =
    state.hoveredElement &&
    state.hoveredElement !== state.activeElement &&
    !state.commentTargetElements.includes(state.hoveredElement) &&
    state.hoveredElement !== state.commentTargetElement
      ? renderBox(state.hoveredElement, false, 'hover')
      : null;

  const activeBox =
    state.activeTool === 'edit' && state.activeElement
      ? renderBox(state.activeElement, true, 'active')
      : null;

  const commentBoxes =
    state.activeTool === 'comment'
      ? state.commentTargetElements.length > 0
        ? state.commentTargetElements.map((el, idx) => renderBox(el, true, `comment_${idx}`))
        : state.commentTargetElement
          ? renderBox(state.commentTargetElement, true, 'comment_single')
          : null
      : null;

  needsDocScrollSyncRef.current = hasDynamicScrollTarget;

  return (
    <div class="ve-selection-layer" ref={anchorRef} aria-hidden="true">
      {hoverBox}
      {activeBox}
      {commentBoxes}
    </div>
  );
}
