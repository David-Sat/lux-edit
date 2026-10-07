import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { VoiceTargetPin } from '@visual-edit/core';

export function VoicePins() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);
    const unsub = state.subscribe(handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
      unsub();
    };
  }, []);

  const allPins: VoiceTargetPin[] = [];
  if (state.activeTool === 'voice' && state.activeVoicePins.length > 0) {
    allPins.push(...state.activeVoicePins);
  } else if (state.voiceReviews.length > 0) {
    state.voiceReviews.forEach((vr) => {
      allPins.push(...vr.pins);
    });
  }

  if (allPins.length === 0) return null;

  const pinPositions = allPins.map((pin) => {
    let x = pin.bounds?.x || 0;
    let y = pin.bounds?.y || 0;

    try {
      const el = document.querySelector(pin.targetSelector) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        x = rect.left + window.scrollX;
        y = rect.top + window.scrollY;
      }
    } catch (e) {}

    return {
      pin,
      x: x - window.scrollX,
      y: y - window.scrollY,
    };
  });

  return (
    <div
      class="ve-voice-pins-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 'var(--ve-z-overlay, 999998)',
      }}
    >
      {pinPositions.map(({ pin, x, y }) => {
        const isHovered = hoveredPinId === pin.id;
        const targetLabel = pin.sourceLocation?.componentName
          ? `<${pin.sourceLocation.componentName}>`
          : pin.sourceLocation?.fileName
          ? `${pin.sourceLocation.fileName.split('/').pop()}:${pin.sourceLocation.lineNumber || 1}`
          : pin.targetSelector;

        return (
          <div
            key={pin.id}
            class={`ve-voice-pin ${isHovered ? 've-hovered' : ''}`}
            style={{
              position: 'absolute',
              left: `${Math.max(8, x)}px`,
              top: `${Math.max(8, y - 14)}px`,
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px 2px 6px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4), 0 0 0 1.5px rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              userSelect: 'none',
              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={() => setHoveredPinId(pin.id)}
            onMouseLeave={() => setHoveredPinId(null)}
            title={`Target ${pin.order}: ${targetLabel}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>Target {pin.order}</span>

            {isHovered && (
              <div
                class="ve-voice-pin-tooltip"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%) translateY(-6px)',
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: '#f8fafc',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                }}
              >
                {targetLabel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
