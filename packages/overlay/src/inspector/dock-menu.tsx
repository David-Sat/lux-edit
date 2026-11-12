import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { VoiceRecorder } from './voice-recorder.js';

function useDraggableDock() {
  const state = OverlayStateManager.getInstance();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const wasDraggingRef = useRef(false);

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
    } catch {}

    const rect = targetElement.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = rect.left;
    const initialTop = rect.top;
    const width = rect.width;
    const height = rect.height;

    let hasMoved = false;
    wasDraggingRef.current = false;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      if (!hasMoved) {
        if (Math.hypot(dx, dy) >= 4) {
          hasMoved = true;
          setIsDragging(true);
        }
      }

      if (hasMoved) {
        moveEv.preventDefault();
        const newX = Math.max(10, Math.min(window.innerWidth - width - 10, initialLeft + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - height - 10, initialTop + dy));
        setDragPos({ x: newX, y: newY });
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      cleanup();

      try {
        if (handleEl && handleEl.hasPointerCapture && handleEl.hasPointerCapture(pointerId)) {
          handleEl.releasePointerCapture(pointerId);
        }
      } catch {}

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
      }

      setIsDragging(false);
      setDragPos(null);
    };

    const cleanup = () => {
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
  const { isDragging, dragPos, wasDraggingRef, startDrag } = useDraggableDock();

  useEffect(() => {
    const unsubState = state.subscribe(() => setTick((t) => t + 1));
    const unsubRecorder = recorder.subscribe((s) => setVoiceState(s));
    return () => {
      unsubState();
      unsubRecorder();
    };
  }, []);

  const totalCount =
    state.mutations.length +
    state.annotations.length +
    state.voiceReviews.length +
    state.variantDecisions.length;
  if (state.activeTool === 'voice') {
    const minutes = Math.floor(voiceState.durationMs / 60000);
    const seconds = Math.floor((voiceState.durationMs % 60000) / 1000);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const liveText = voiceState.interimTranscript || voiceState.transcript;

    return (
      <div
        class={`ve-dock-menu ve-voice-recording-dock ${isDragging ? 've-dragging' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(16px)',
          border: voiceState.isReady ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(245, 158, 11, 0.5)',
          borderRadius: '24px',
          boxShadow: voiceState.isReady
            ? '0 8px 32px rgba(220, 38, 38, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 8px 32px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          animation: 'veSlideUp 0.15s ease-out',
          ...(isDragging && dragPos
            ? {
                position: 'fixed',
                left: `${dragPos.x}px`,
                top: `${dragPos.y}px`,
                right: 'auto',
                bottom: 'auto',
                transition: 'none',
                zIndex: 2147483647,
              }
            : {}),
        }}
      >
        <div
          class="ve-dock-drag-handle"
          title="Drag to reposition (snaps to edge)"
          onPointerDown={(e) => {
            e.stopPropagation();
            const dockEl = (e.currentTarget as HTMLElement).closest('.ve-dock-menu') as HTMLElement;
            if (dockEl) startDrag(e, dockEl);
          }}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ pointerEvents: 'none' }}>
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="7" cy="3" r="1.5" />
            <circle cx="3" cy="7" r="1.5" />
            <circle cx="7" cy="7" r="1.5" />
            <circle cx="3" cy="11" r="1.5" />
            <circle cx="7" cy="11" r="1.5" />
          </svg>
        </div>
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: voiceState.isReady ? '#ef4444' : '#f59e0b',
            animation: voiceState.isReady ? 'vePulse 1.2s infinite ease-in-out' : 'vePulse 0.6s infinite ease-in-out',
            flexShrink: 0,
            transition: 'background-color 0.2s ease',
          }}
        />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
          {voiceState.isReady ? timeStr : '00:00'}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: voiceState.isReady ? '#cbd5e1' : '#fcd34d',
            maxWidth: '200px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontStyle: voiceState.isReady && liveText ? 'normal' : 'italic',
            fontWeight: voiceState.isReady ? 400 : 600,
          }}
        >
          {!voiceState.isReady
            ? 'Connecting mic...'
            : liveText
            ? `"${liveText}"`
            : 'Speak & click (Shift+click to group)'}
        </span>
        {voiceState.pins.length > 0 && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.25)',
              color: '#fca5a5',
              padding: '2px 7px',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              flexShrink: 0,
            }}
            title={`${voiceState.sections?.length || 1} section(s), ${voiceState.pins.length} target(s)`}
          >
            {voiceState.sections && voiceState.sections.length > 0
              ? `${voiceState.sections.length} sec • ${voiceState.pins.length} tgt`
              : `${voiceState.pins.length} target${voiceState.pins.length > 1 ? 's' : ''}`}
          </span>
        )}
        <button
          class={`ve-voice-done-btn ${state.isStoppingVoice ? 've-finishing' : ''}`}
          onClick={() => state.stopVoiceRecording()}
          disabled={state.isStoppingVoice}
          title="Finish Recording (R / Esc)"
        >
          {state.isStoppingVoice ? (
            <>
              <svg class="ve-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
              </svg>
              <span>Finishing...</span>
            </>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
              <span>Done</span>
            </>
          )}
        </button>
        <button
          class="ve-voice-cancel-btn"
          onClick={() => state.cancelVoiceRecording()}
          title="Cancel Recording"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  if (!state.isDockMenuOpen && state.activeTool === 'none') {
    return (
      <button
        class={`ve-launcher-btn ${isDragging ? 've-dragging' : ''}`}
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
        title="Open LUX Tools (drag to reposition)"
        onPointerDown={(e) => startDrag(e, e.currentTarget as HTMLElement)}
        onClick={() => {
          if (wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
          }
          state.setDockMenuOpen(true);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        {totalCount > 0 && <span class="ve-launcher-badge">{totalCount}</span>}
      </button>
    );
  }

  const isLive = state.reviewMode === 'live';

  return (
    <div
      class={`ve-dock-menu ${isDragging ? 've-dragging' : ''}`}
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
      <div
        class="ve-dock-drag-handle"
        title="Drag to reposition (snaps to edge)"
        onPointerDown={(e) => {
          e.stopPropagation();
          const dockEl = (e.currentTarget as HTMLElement).closest('.ve-dock-menu') as HTMLElement;
          if (dockEl) startDrag(e, dockEl);
        }}
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ pointerEvents: 'none' }}>
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="7" cy="3" r="1.5" />
          <circle cx="3" cy="7" r="1.5" />
          <circle cx="7" cy="7" r="1.5" />
          <circle cx="3" cy="11" r="1.5" />
          <circle cx="7" cy="11" r="1.5" />
        </svg>
      </div>
      <button
        class={`ve-dock-item ${isLive ? 've-active' : ''}`}
        onClick={() => state.setReviewMode(isLive ? 'batch' : 'live')}
        title={
          isLive
            ? 'Live Mode Active: Feedback streams immediately to agent (Click to switch to Batch Mode)'
            : 'Batch Mode Active: Hold changes until Submit Review (Click to switch to Live Mode)'
        }
        style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '0 8px',
          borderRadius: '12px',
          width: 'auto',
          height: '28px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: isLive ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.08)',
          border: isLive ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.14)',
          color: isLive ? '#34d399' : '#cbd5e1',
        }}
      >
        {isLive && (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981',
              flexShrink: 0,
            }}
          />
        )}
        <span>{isLive ? 'Live' : 'Batch'}</span>
      </button>
      <button
        class={`ve-dock-item ${state.activeTool === 'edit' ? 've-active' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'edit' ? 'none' : 'edit')}
        title="Visual Edit Mode (V)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        class={`ve-dock-item ${state.activeTool === 'comment' ? 've-active' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'comment' ? 'none' : 'comment')}
        title="Comment Pin Mode (C)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <button
        class="ve-dock-item"
        onClick={() => state.setTool('voice')}
        title="Voice Walkthrough (R)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
      <button
        class={`ve-dock-item ${state.activeTool === 'screenshot' ? 've-active' : ''}`}
        onClick={() => state.setTool(state.activeTool === 'screenshot' ? 'none' : 'screenshot')}
        title="Capture Visual Screenshot (S)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
      <button
        class={`ve-dock-item ${state.isDrawerOpen ? 've-active' : ''}`}
        style={{ position: 'relative' }}
        onClick={() => state.setDrawerOpen(!state.isDrawerOpen)}
        title={`Review Changes (${totalCount})`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        {totalCount > 0 && <span class="ve-dock-badge">{totalCount}</span>}
      </button>
      <button
        class="ve-dock-item ve-dock-close"
        onClick={() => {
          state.setTool('none');
          state.setDockMenuOpen(false);
          state.setDrawerOpen(false);
        }}
        title="Minimize (Esc)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
