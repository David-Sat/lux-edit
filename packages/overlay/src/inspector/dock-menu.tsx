import { h } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { VoiceRecorder } from './voice-recorder.js';
import { createLiquidDragDeformer, prefersReducedMotion } from './liquid-glass.js';
import { formatAriaKeyShortcuts, formatHotkeyLabel } from './hotkeys.js';
import { handleRovingArrowKey } from './keyboard-nav.js';

type DockSurfaceAnim = 'idle' | 'morph' | 'settle';
type OrbSurfaceAnim = 'idle' | 'morph' | 'settle';
type DockFocusKey = 'edit' | 'comment' | 'screenshot' | 'drawer';

function useDraggableDock(callbacks?: { onDragStart?: () => void; onDropSettle?: () => void }) {
  const state = OverlayStateManager.getInstance();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const wasDraggingRef = useRef(false);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const startDrag = (e: PointerEvent, targetElement: HTMLElement) => {
    if (e.button !== 0) return;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const handleEl = e.currentTarget as HTMLElement | null;
    const pointerId = e.pointerId;
    try {
      if (handleEl && handleEl.setPointerCapture) {
        handleEl.setPointerCapture(pointerId);
      }
    } catch (err) {
      console.debug('[lux] Failed to capture dock drag pointer:', err);
    }

    const rect = targetElement.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = rect.left;
    const initialTop = rect.top;
    const width = rect.width;
    const height = rect.height;

    let hasMoved = false;
    let lastX = startX;
    let lastY = startY;
    const deformer = createLiquidDragDeformer(targetElement);
    wasDraggingRef.current = false;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      const stepDx = moveEv.clientX - lastX;
      const stepDy = moveEv.clientY - lastY;
      lastX = moveEv.clientX;
      lastY = moveEv.clientY;

      if (!hasMoved) {
        if (Math.hypot(dx, dy) >= 4) {
          hasMoved = true;
          setIsDragging(true);
          callbacksRef.current?.onDragStart?.();
        }
      }

      if (hasMoved) {
        moveEv.preventDefault();
        const newX = Math.max(10, Math.min(window.innerWidth - width - 10, initialLeft + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - height - 10, initialTop + dy));
        setDragPos({ x: newX, y: newY });
        deformer.push(stepDx, stepDy);
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      cleanup();

      try {
        if (handleEl && handleEl.hasPointerCapture && handleEl.hasPointerCapture(pointerId)) {
          handleEl.releasePointerCapture(pointerId);
        }
      } catch (err) {
        console.debug('[lux] Failed to release dock drag pointer:', err);
      }

      if (hasMoved) {
        wasDraggingRef.current = true;
        const totalDx = upEv.clientX - startX;
        const totalDy = upEv.clientY - startY;
        const finalX = Math.max(10, Math.min(window.innerWidth - width - 10, initialLeft + totalDx));
        const finalY = Math.max(10, Math.min(window.innerHeight - height - 10, initialTop + totalDy));

        const centerX = finalX + width / 2;
        const side: 'left' | 'right' = centerX < window.innerWidth / 2 ? 'left' : 'right';
        const margin = 20;

        const clampedY = Math.max(margin, Math.min(window.innerHeight - height - margin, finalY));
        let verticalAnchor: 'top' | 'bottom';
        let offsetY: number;
        if (clampedY + height / 2 < window.innerHeight / 2) {
          verticalAnchor = 'top';
          offsetY = Math.round(clampedY);
        } else {
          verticalAnchor = 'bottom';
          offsetY = Math.round(window.innerHeight - clampedY - height);
        }

        state.setDockPosition({ side, verticalAnchor, offsetY });
        callbacksRef.current?.onDropSettle?.();
      }

      setIsDragging(false);
      setDragPos(null);
    };

    const cleanup = () => {
      deformer.clear();
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      cleanupRef.current = null;
    };

    cleanupRef.current = cleanup;
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
  };

  return {
    isDragging,
    dragPos,
    wasDraggingRef,
    startDrag,
  };
}

export function DockMenu() {
  const state = OverlayStateManager.getInstance();
  const recorder = VoiceRecorder.getInstance();
  const [, setTick] = useState(0);
  const [voiceState, setVoiceState] = useState(recorder.getState());
  const [dockAnim, setDockAnim] = useState<DockSurfaceAnim>('idle');
  const [orbAnim, setOrbAnim] = useState<OrbSurfaceAnim>('idle');

  const isLauncherView = !state.isDockMenuOpen && state.activeTool === 'none';
  const isLive = state.reviewMode === 'live';
  const focusKey: DockFocusKey | null =
    state.activeTool === 'edit'
      ? 'edit'
      : state.activeTool === 'comment'
        ? 'comment'
        : state.activeTool === 'screenshot'
          ? 'screenshot'
          : state.isDrawerOpen
            ? 'drawer'
            : null;

  const itemRefs = useRef<Partial<Record<DockFocusKey, HTMLButtonElement | null>>>({});
  const [focusRect, setFocusRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [focusSliding, setFocusSliding] = useState(false);
  const [isFocusGliding, setIsFocusGliding] = useState(false);
  const prevFocusKeyRef = useRef<DockFocusKey | null>(null);
  const focusGlideTimerRef = useRef<number | null>(null);
  const prevWasLauncherRef = useRef(isLauncherView);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const dockToolbarRef = useRef<HTMLDivElement | null>(null);
  const focusIntentRef = useRef<'dock' | 'launcher' | null>(null);

  const handleDragStart = useCallback(() => {
    setDockAnim('idle');
    setOrbAnim('idle');
  }, []);

  const handleDropSettle = useCallback(() => {
    if (prefersReducedMotion()) return;
    if (isLauncherView) {
      setOrbAnim('settle');
    } else {
      setDockAnim('settle');
    }
  }, [isLauncherView]);

  const { isDragging, dragPos, wasDraggingRef, startDrag } = useDraggableDock({
    onDragStart: handleDragStart,
    onDropSettle: handleDropSettle,
  });

  const hasActiveOption =
    state.activeTool !== 'none' || state.isDrawerOpen || state.reviewMode === 'live';

  useEffect(() => {
    const unsubState = state.subscribe(() => setTick((t) => t + 1));
    const unsubRecorder = recorder.subscribe((s) => setVoiceState(s));
    return () => {
      unsubState();
      unsubRecorder();
      if (focusGlideTimerRef.current !== null) {
        window.clearTimeout(focusGlideTimerRef.current);
      }
    };
  }, [state, recorder]);

  useLayoutEffect(() => {
    const prevWasLauncher = prevWasLauncherRef.current;
    prevWasLauncherRef.current = isLauncherView;

    if (prefersReducedMotion()) {
      setDockAnim('idle');
      setOrbAnim('idle');
      return;
    }

    if (prevWasLauncher && !isLauncherView) {
      setDockAnim('morph');
      setOrbAnim('idle');
    } else if (!prevWasLauncher && isLauncherView) {
      setOrbAnim('morph');
      setDockAnim('idle');
    }
  }, [isLauncherView]);

  useEffect(() => {
    const intent = focusIntentRef.current;
    if (!intent) return;
    if (intent === 'dock' && !isLauncherView && state.activeTool !== 'voice') {
      focusIntentRef.current = null;
      const firstItem = dockToolbarRef.current?.querySelector('.ve-dock-item:not(:disabled)') as HTMLElement | null;
      firstItem?.focus({ preventScroll: true });
    } else if (intent === 'launcher' && isLauncherView) {
      focusIntentRef.current = null;
      launcherRef.current?.focus({ preventScroll: true });
    }
  }, [isLauncherView, state.activeTool]);

  useLayoutEffect(() => {
    if (isLauncherView || state.activeTool === 'voice') {
      prevFocusKeyRef.current = null;
      setFocusSliding(false);
      setIsFocusGliding(false);
      return;
    }

    const prevKey = prevFocusKeyRef.current;
    prevFocusKeyRef.current = focusKey;

    const targetBtn = focusKey ? itemRefs.current[focusKey] : null;
    if (!targetBtn) {
      setFocusSliding(false);
      setIsFocusGliding(false);
      return;
    }

    const FOCUS_PAD_X = 6;
    const FOCUS_PAD_Y = 4;
    const nextRect = {
      left: targetBtn.offsetLeft - FOCUS_PAD_X,
      top: targetBtn.offsetTop - FOCUS_PAD_Y,
      width: targetBtn.offsetWidth + FOCUS_PAD_X * 2,
      height: targetBtn.offsetHeight + FOCUS_PAD_Y * 2,
    };
    const shouldSlide =
      !prefersReducedMotion() &&
      prevKey !== null &&
      nextRect.width > 0 &&
      nextRect.height > 0;

    setFocusSliding(shouldSlide);
    setFocusRect((prev) =>
      prev &&
      prev.left === nextRect.left &&
      prev.top === nextRect.top &&
      prev.width === nextRect.width &&
      prev.height === nextRect.height
        ? prev
        : nextRect
    );

    if (shouldSlide && prevKey !== focusKey) {
      if (focusGlideTimerRef.current !== null) {
        window.clearTimeout(focusGlideTimerRef.current);
      }
      setIsFocusGliding(true);
      focusGlideTimerRef.current = window.setTimeout(() => {
        focusGlideTimerRef.current = null;
        setIsFocusGliding(false);
      }, 260);
    }
  }, [isLauncherView, state.activeTool, state.isDrawerOpen, isLive, focusKey]);

  const handleDockAnimationEnd = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) {
      setDockAnim('idle');
    }
  };

  const handleOrbAnimationEnd = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) {
      setOrbAnim('idle');
    }
  };

  const totalCount =
    state.mutations.length +
    state.annotations.length +
    state.voiceReviews.length +
    state.variantDecisions.length;
  const formatSuffix = (binding: string) => (binding ? ` (${formatHotkeyLabel(binding)})` : '');
  const voiceShortcutKey = formatAriaKeyShortcuts(state.hotkeys.voice);

  if (state.activeTool === 'voice') {
    const minutes = Math.floor(voiceState.durationMs / 60000);
    const seconds = Math.floor((voiceState.durationMs % 60000) / 1000);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const liveText = voiceState.interimTranscript || voiceState.transcript;

    return (
      <div
        role="toolbar"
        aria-label="Voice walkthrough recording controls"
        aria-orientation="horizontal"
        class={`ve-dock-menu ve-voice-recording-dock ${voiceState.isReady ? 'is-ready' : ''} ${isDragging ? 've-dragging' : ''} ${hasActiveOption ? 've-has-selection' : ''}`}
        data-ve-anim={dockAnim}
        onAnimationEnd={handleDockAnimationEnd}
        onKeyDown={(e) => {
          const items = Array.from((e.currentTarget as HTMLElement).querySelectorAll('button')) as HTMLElement[];
          handleRovingArrowKey(e, items, { orientation: 'horizontal', loop: true });
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={
          isDragging && dragPos
            ? {
                position: 'fixed',
                left: `${dragPos.x}px`,
                top: `${dragPos.y}px`,
                right: 'auto',
                bottom: 'auto',
                transition: 'none',
                zIndex: 2147483647,
              }
            : undefined
        }
      >
        <span class="ve-glass-surface" aria-hidden="true" />
        <span class="ve-glass-bevel" aria-hidden="true" />
        <div
          class="ve-dock-drag-handle"
          aria-hidden="true"
          title="Drag to reposition (snaps to edge)"
          onPointerDown={(e) => {
            e.stopPropagation();
            const dockEl = (e.currentTarget as HTMLElement).closest('.ve-dock-menu') as HTMLElement;
            if (dockEl) startDrag(e, dockEl);
          }}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" class="ve-dock-grip-svg" aria-hidden="true">
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="7" cy="3" r="1.5" />
            <circle cx="3" cy="7" r="1.5" />
            <circle cx="7" cy="7" r="1.5" />
            <circle cx="3" cy="11" r="1.5" />
            <circle cx="7" cy="11" r="1.5" />
          </svg>
        </div>
        <span class={`ve-voice-status-dot ${voiceState.isReady ? 'is-ready' : ''}`} aria-hidden="true" />
        <span class="ve-voice-timer">
          {voiceState.isReady ? timeStr : '00:00'}
        </span>
        <span
          class={`ve-voice-transcript-preview ${voiceState.isReady ? 'is-ready' : ''} ${voiceState.isReady && liveText ? 'is-live-text' : ''}`}
          aria-live="polite"
        >
          {!voiceState.isReady
            ? 'Connecting mic...'
            : liveText
            ? `"${liveText}"`
            : 'Speak & click (Shift+click to group)'}
        </span>
        {voiceState.pins.length > 0 && (
          <span
            class="ve-voice-pin-badge"
            title={`${voiceState.sections?.length || 1} section(s), ${voiceState.pins.length} target(s)`}
          >
            {voiceState.sections && voiceState.sections.length > 0
              ? `${voiceState.sections.length} sec • ${voiceState.pins.length} tgt`
              : `${voiceState.pins.length} target${voiceState.pins.length > 1 ? 's' : ''}`}
          </span>
        )}
        <button
          type="button"
          class={`ve-voice-done-btn ${state.isStoppingVoice ? 've-finishing' : ''}`}
          onClick={() => state.stopVoiceRecording()}
          disabled={state.isStoppingVoice}
          aria-label={state.isStoppingVoice ? 'Finishing voice recording' : 'Finish voice recording'}
          aria-keyshortcuts={voiceShortcutKey ? `${voiceShortcutKey} Escape` : 'Escape'}
          title={`Finish Recording (${state.hotkeys.voice ? `${formatHotkeyLabel(state.hotkeys.voice)} / ` : ''}Esc)`}
        >
          {state.isStoppingVoice ? (
            <>
              <svg class="ve-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
              </svg>
              <span>Finishing...</span>
            </>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
              <span>Done</span>
            </>
          )}
        </button>
        <button
          type="button"
          class="ve-voice-cancel-btn"
          onClick={() => state.cancelVoiceRecording()}
          aria-label="Cancel voice recording"
          title="Cancel Recording"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  if (isLauncherView) {
    return (
      <button
        ref={launcherRef}
        type="button"
        class={`ve-launcher-btn ${isDragging ? 've-dragging' : ''}`}
        data-ve-anim={orbAnim}
        onAnimationEnd={handleOrbAnimationEnd}
        style={
          isDragging && dragPos
            ? {
                position: 'fixed',
                left: `${dragPos.x}px`,
                top: `${dragPos.y}px`,
                right: 'auto',
                bottom: 'auto',
                transition: 'none',
                zIndex: 2147483647,
              }
            : undefined
        }
        aria-label={totalCount > 0 ? `Open LUX Tools (${totalCount} pending items)` : 'Open LUX Tools'}
        aria-expanded={false}
        title="Open LUX Tools (drag to reposition)"
        onPointerDown={(e) => startDrag(e, e.currentTarget as HTMLElement)}
        onClick={(e) => {
          if (wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
          }
          if (e.detail === 0) {
            focusIntentRef.current = 'dock';
          }
          state.setDockMenuOpen(true);
        }}
      >
        <span class="ve-glass-surface" aria-hidden="true" />
        <span class="ve-glass-bevel" aria-hidden="true" />
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        {totalCount > 0 && <span class="ve-launcher-badge" aria-hidden="true">{totalCount}</span>}
      </button>
    );
  }

  return (
    <div
      ref={dockToolbarRef}
      role="toolbar"
      aria-label="LUX Visual Edit Tools"
      aria-orientation="horizontal"
      class={`ve-dock-menu ${isDragging ? 've-dragging' : ''} ${hasActiveOption ? 've-has-selection' : ''}`}
      data-ve-anim={dockAnim}
      onAnimationEnd={handleDockAnimationEnd}
      onKeyDown={(e) => {
        const items = Array.from((e.currentTarget as HTMLElement).querySelectorAll('.ve-dock-item')) as HTMLElement[];
        handleRovingArrowKey(e, items, { orientation: 'horizontal', loop: true });
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={
        isDragging && dragPos
          ? {
              position: 'fixed',
              left: `${dragPos.x}px`,
              top: `${dragPos.y}px`,
              right: 'auto',
              bottom: 'auto',
              transition: 'none',
              zIndex: 2147483647,
            }
          : undefined
      }
    >
      <span class="ve-glass-surface" aria-hidden="true" />
      <span class="ve-glass-bevel" aria-hidden="true" />
      <span
        class={`ve-dock-focus-pill ${focusKey ? 'is-visible' : ''} ${focusSliding ? 'is-sliding' : ''} ${isFocusGliding ? 'is-gliding' : ''}`}
        aria-hidden="true"
        style={
          focusRect
            ? {
                width: `${focusRect.width}px`,
                height: `${focusRect.height}px`,
                transform: `translate3d(${focusRect.left}px, ${focusRect.top}px, 0)`,
              }
            : undefined
        }
      />
      <div
        class="ve-dock-drag-handle"
        aria-hidden="true"
        title="Drag to reposition (snaps to edge)"
        onPointerDown={(e) => {
          e.stopPropagation();
          const dockEl = (e.currentTarget as HTMLElement).closest('.ve-dock-menu') as HTMLElement;
          if (dockEl) startDrag(e, dockEl);
        }}
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" class="ve-dock-grip-svg" aria-hidden="true">
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="7" cy="3" r="1.5" />
          <circle cx="3" cy="7" r="1.5" />
          <circle cx="7" cy="7" r="1.5" />
          <circle cx="3" cy="11" r="1.5" />
          <circle cx="7" cy="11" r="1.5" />
        </svg>
      </div>
      <button
        type="button"
        class={`ve-dock-item ve-mode-pill ${isLive ? 've-active' : ''}`}
        onClick={() => state.setReviewMode(isLive ? 'batch' : 'live')}
        aria-label={isLive ? 'Review mode: Live (switch to Batch)' : 'Review mode: Batch (switch to Live)'}
        aria-pressed={isLive}
        title={
          isLive
            ? 'Live Mode Active: Feedback streams immediately to agent (Click to switch to Batch Mode)'
            : 'Batch Mode Active: Hold changes until Submit Review (Click to switch to Live Mode)'
        }
      >
        {isLive && <span class="ve-mode-live-dot" aria-hidden="true" />}
        <span>{isLive ? 'Live' : 'Batch'}</span>
      </button>
      <button
        ref={(el) => {
          itemRefs.current.edit = el;
        }}
        type="button"
        class={`ve-dock-item ${state.activeTool === 'edit' ? 've-active' : ''} ${focusKey === 'edit' ? 've-focus-target' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'edit' ? 'none' : 'edit')}
        aria-label={`Visual Edit Mode${formatSuffix(state.hotkeys.edit)}`}
        aria-pressed={state.activeTool === 'edit'}
        aria-keyshortcuts={formatAriaKeyShortcuts(state.hotkeys.edit)}
        title={`Visual Edit Mode${formatSuffix(state.hotkeys.edit)}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        ref={(el) => {
          itemRefs.current.comment = el;
        }}
        type="button"
        class={`ve-dock-item ${state.activeTool === 'comment' ? 've-active' : ''} ${focusKey === 'comment' ? 've-focus-target' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'comment' ? 'none' : 'comment')}
        aria-label={`Comment Pin Mode${formatSuffix(state.hotkeys.comment)}`}
        aria-pressed={state.activeTool === 'comment'}
        aria-keyshortcuts={formatAriaKeyShortcuts(state.hotkeys.comment)}
        title={`Comment Pin Mode${formatSuffix(state.hotkeys.comment)}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <button
        type="button"
        class="ve-dock-item"
        onClick={() => state.setTool('voice')}
        aria-label={`Voice Walkthrough${formatSuffix(state.hotkeys.voice)}`}
        aria-pressed={false}
        aria-keyshortcuts={formatAriaKeyShortcuts(state.hotkeys.voice)}
        title={`Voice Walkthrough${formatSuffix(state.hotkeys.voice)}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
      <button
        ref={(el) => {
          itemRefs.current.screenshot = el;
        }}
        type="button"
        class={`ve-dock-item ${state.activeTool === 'screenshot' ? 've-active' : ''} ${focusKey === 'screenshot' ? 've-focus-target' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'screenshot' ? 'none' : 'screenshot')}
        aria-label={`Capture Visual Screenshot${formatSuffix(state.hotkeys.screenshot)}`}
        aria-pressed={state.activeTool === 'screenshot'}
        aria-keyshortcuts={formatAriaKeyShortcuts(state.hotkeys.screenshot)}
        title={`Capture Visual Screenshot${formatSuffix(state.hotkeys.screenshot)}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
      <button
        ref={(el) => {
          itemRefs.current.drawer = el;
        }}
        type="button"
        class={`ve-dock-item ve-dock-item--relative ${state.isDrawerOpen ? 've-active' : ''} ${focusKey === 'drawer' ? 've-focus-target' : ''}`}
        onClick={() => state.setDrawerOpen(!state.isDrawerOpen)}
        aria-label={`Review Changes (${totalCount})${formatSuffix(state.hotkeys.drawer)}`}
        aria-pressed={state.isDrawerOpen}
        aria-keyshortcuts={formatAriaKeyShortcuts(state.hotkeys.drawer)}
        title={`Review Changes (${totalCount})${formatSuffix(state.hotkeys.drawer)}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        {totalCount > 0 && <span class="ve-dock-badge" aria-hidden="true">{totalCount}</span>}
      </button>
      <button
        type="button"
        class="ve-dock-item ve-dock-close"
        onClick={(e) => {
          if (e.detail === 0) {
            focusIntentRef.current = 'launcher';
          }
          state.setTool('none');
          state.setDockMenuOpen(false);
          state.setDrawerOpen(false);
        }}
        aria-label="Minimize LUX tools"
        title="Minimize (Esc)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
