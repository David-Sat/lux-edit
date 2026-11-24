import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { VoiceTargetPin } from '@visual-edit/core';
import { isAnnotationOnRoute, observeNextDomCommit } from './route-utils.js';
import { locatePinTarget, useAnchoredOverlaySync } from './pin-position.js';
import { usePinPeekDrag } from './pin-drag.js';
import { GlassChrome } from './liquid-glass-defs.js';
import { handleRovingArrowKey } from './keyboard-nav.js';

export function VoicePins() {
  const state = OverlayStateManager.getInstance();
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  const currentPath = state.getCurrentPathname();
  const hasVoicePins =
    (state.activeTool === 'voice' && state.activeVoicePins.length > 0) || state.voiceReviews.length > 0;

  const { triggerSync, anchorRef, needsDocScrollSyncRef, measureAnchor } = useAnchoredOverlaySync({
    state,
    anchorKey: `${hasVoicePins}:${state.activeTool}:${state.voiceReviews.length}:${state.activeVoicePins.length}:${currentPath}`,
  });

  const { activeDragKey, snappingKey, startPinDrag } = usePinPeekDrag({
    onDragStart: () => setHoveredPinId(null),
  });

  useEffect(() => {
    setHoveredPinId(null);
    if (!hasVoicePins) return;
    return observeNextDomCommit(triggerSync);
  }, [currentPath, hasVoicePins, triggerSync]);

  const allPins: VoiceTargetPin[] = [];
  if (state.activeTool === 'voice' && state.activeVoicePins.length > 0) {
    state.activeVoicePins.forEach((pin) => {
      if (!pin.pathname || isAnnotationOnRoute({ pathname: pin.pathname }, currentPath)) {
        allPins.push(pin);
      }
    });
  } else if (state.voiceReviews.length > 0) {
    state.voiceReviews.forEach((vr) => {
      const matchesReviewRoute = isAnnotationOnRoute({ pathname: vr.pathname, url: vr.url }, currentPath);
      vr.pins.forEach((pin) => {
        const matchesPin = pin.pathname
          ? isAnnotationOnRoute({ pathname: pin.pathname }, currentPath)
          : matchesReviewRoute;
        if (matchesPin) {
          allPins.push(pin);
        }
      });
    });
  }

  if (allPins.length === 0) {
    needsDocScrollSyncRef.current = false;
    return null;
  }

  const anchor = measureAnchor();

  let hasDynamicScrollPin = false;
  const pinPositions = allPins.map((pin) => {
    const pos = locatePinTarget({
      targetSelector: pin.targetSelector,
      sourceLoc: pin.sourceLocation,
      bounds: pin.bounds,
      anchor,
      offsetX: 0,
      offsetY: -14,
    });
    if (pos.dynamicScroll) hasDynamicScrollPin = true;

    return {
      pin,
      pos,
    };
  });

  needsDocScrollSyncRef.current = hasDynamicScrollPin || activeDragKey !== null;

  return (
    <div
      ref={anchorRef}
      class="ve-voice-pins-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 'var(--ve-z-overlay, 999998)',
      }}
    >
      {pinPositions.map(({ pin, pos }) => {
        const isDragging = activeDragKey === pin.id;
        const isSnapping = snappingKey === pin.id;
        const isHovered = hoveredPinId === pin.id;
        const targetLabel = pin.sourceLocation?.componentName
          ? `<${pin.sourceLocation.componentName}>`
          : pin.sourceLocation?.fileName
          ? `${pin.sourceLocation.fileName.split('/').pop()}:${pin.sourceLocation.lineNumber || 1}`
          : pin.targetSelector;

        return (
          <div
            key={pin.id}
            role="button"
            tabIndex={0}
            aria-label={`Voice walkthrough target ${pin.order}: ${targetLabel}`}
            aria-expanded={isHovered && !isDragging}
            class={[
              've-voice-pin',
              isHovered && !isDragging ? 've-hovered' : '',
              isDragging ? 've-dragging' : '',
              isSnapping ? 've-snapping' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              position: pos.fixed ? 'fixed' : undefined,
              left: `${pos.x}px`,
              top: `${pos.y}px`,
            }}
            onPointerDown={(e) => {
              startPinDrag(e, {
                pinKey: pin.id,
                pinEl: e.currentTarget as HTMLElement,
              });
            }}
            onFocus={() => {
              if (!activeDragKey) setHoveredPinId(pin.id);
            }}
            onBlur={() => {
              if (!activeDragKey) setHoveredPinId((prev) => (prev === pin.id ? null : prev));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setHoveredPinId(null);
                return;
              }
              const pins = anchorRef.current
                ? (Array.from(anchorRef.current.querySelectorAll('.ve-voice-pin')) as HTMLElement[])
                : [];
              handleRovingArrowKey(e, pins, {
                orientation: 'both',
                loop: true,
                currentEl: e.currentTarget as HTMLElement,
                onFocusChange: (nextEl) => {
                  nextEl.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
                },
              });
            }}
            onMouseEnter={() => {
              if (!activeDragKey) setHoveredPinId(pin.id);
            }}
            onMouseLeave={() => {
              if (!activeDragKey) setHoveredPinId(null);
            }}
            title={`Target ${pin.order}: ${targetLabel}`}
          >
            <GlassChrome />
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>Target {pin.order}</span>

            {isHovered && !isDragging && (
              <div class="ve-voice-pin-tooltip" role="tooltip">
                <GlassChrome />
                <span>{targetLabel}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
