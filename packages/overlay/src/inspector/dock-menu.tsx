import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { VoiceRecorder } from './voice-recorder.js';

export function DockMenu() {
  const state = OverlayStateManager.getInstance();
  const recorder = VoiceRecorder.getInstance();
  const [, setTick] = useState(0);
  const [voiceState, setVoiceState] = useState(recorder.getState());

  useEffect(() => {
    const unsubState = state.subscribe(() => setTick((t) => t + 1));
    const unsubRecorder = recorder.subscribe((s) => setVoiceState(s));
    return () => {
      unsubState();
      unsubRecorder();
    };
  }, []);

  const totalCount = state.mutations.length + state.annotations.length + state.voiceReviews.length;
  if (state.activeTool === 'voice') {
    const minutes = Math.floor(voiceState.durationMs / 60000);
    const seconds = Math.floor((voiceState.durationMs % 60000) / 1000);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const liveText = voiceState.interimTranscript || voiceState.transcript;

    return (
      <div
        class="ve-dock-menu ve-voice-recording-dock"
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
        }}
      >
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
            : 'Listening... speak & click elements'}
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
          >
            {voiceState.pins.length} target{voiceState.pins.length > 1 ? 's' : ''}
          </span>
        )}
        <button
          class="ve-dock-item"
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            border: 'none',
            cursor: state.isStoppingVoice ? 'default' : 'pointer',
            opacity: state.isStoppingVoice ? 0.75 : 1,
            pointerEvents: state.isStoppingVoice ? 'none' : 'auto',
          }}
          onClick={() => state.stopVoiceRecording()}
          disabled={state.isStoppingVoice}
          title="Finish Recording (R / Esc)"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
          <span>{state.isStoppingVoice ? 'Finishing...' : 'Done'}</span>
        </button>
        <button
          class="ve-dock-item"
          style={{
            background: 'transparent',
            color: '#94a3b8',
            borderRadius: '50%',
            padding: '4px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => state.cancelVoiceRecording()}
          title="Cancel Recording"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
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
        class="ve-launcher-btn"
        title="Open LUX Tools (V / C / R)"
        onClick={() => state.setDockMenuOpen(true)}
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

  return (
    <div
      class="ve-dock-menu"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
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
        class={`ve-dock-item ${state.isThemePanelOpen ? 've-active' : ''}`}
        onClick={() => state.setThemePanelOpen(!state.isThemePanelOpen)}
        title="App Theme & Design Tokens"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
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
