import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';

export function SelectionBox() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  if (state.activeTool === 'none') return null;

  const renderBox = (el: HTMLElement, isActive: boolean) => {
    if (!el || !document.body.contains(el)) return null;

    const rect = el.getBoundingClientRect();
    const sourceLoc = resolveSourceLocation(el);
    const label = sourceLoc.componentName
      ? `<${sourceLoc.componentName}>`
      : el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');

    const dim = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    const isCommentMode = state.activeTool === 'comment';

    return (
      <div
        class={`ve-highlight-box ${isActive ? 've-active' : ''} ${isCommentMode ? 've-comment-mode' : ''}`}
        style={{
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        }}
      >
        <div class="ve-badge">
          <span>{isCommentMode ? `💬 ${label}` : label}</span>
          <span class="ve-badge-dim">{dim}</span>
        </div>
      </div>
    );
  };

  return (
    <Fragment>
      {state.hoveredElement &&
        state.hoveredElement !== state.activeElement &&
        state.hoveredElement !== state.commentTargetElement &&
        renderBox(state.hoveredElement, false)}
      {state.activeTool === 'edit' && state.activeElement && renderBox(state.activeElement, true)}
      {state.activeTool === 'comment' && state.commentTargetElement && renderBox(state.commentTargetElement, true)}
    </Fragment>
  );
}
