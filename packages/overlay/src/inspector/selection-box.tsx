import { h } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';
import {
  PinAnchorOrigin,
  getPinAnchorOrigin,
  isDocumentScrollTarget,
  locateElementRect,
} from './pin-position.js';

export function SelectionBox() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);

  const anchorRef = useRef<HTMLDivElement>(null);
  const anchorOriginRef = useRef<PinAnchorOrigin>({ left: 0, top: 0 });
  const needsDocScrollSyncRef = useRef(false);

  useEffect(() => {
    let rafId = 0;
    const handleUpdate = () => setTick((t) => t + 1);
    const scheduleSync = () => {
      if (typeof window.requestAnimationFrame !== 'function') {
        handleUpdate();
        return;
      }
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        handleUpdate();
      });
    };

    const handleScroll = (e: Event) => {
      if (isDocumentScrollTarget(e.target) && !needsDocScrollSyncRef.current) {
        return;
      }
      scheduleSync();
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', scheduleSync);
    const unsub = state.subscribe(handleUpdate);

    return () => {
      if (rafId !== 0 && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
      document.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', scheduleSync);
      unsub();
    };
  }, [state]);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const measured = getPinAnchorOrigin(anchorRef.current);
    if (
      Math.abs(measured.left - anchorOriginRef.current.left) > 0.5 ||
      Math.abs(measured.top - anchorOriginRef.current.top) > 0.5
    ) {
      setTick((t) => t + 1);
    }
  }, [
    state.activeTool,
    state.hoveredElement,
    state.activeElement,
    state.commentTargetElement,
    state.commentTargetElements.length,
  ]);

  if (state.activeTool === 'none') {
    needsDocScrollSyncRef.current = false;
    return null;
  }

  const anchor = getPinAnchorOrigin(anchorRef.current);
  anchorOriginRef.current = anchor;

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
