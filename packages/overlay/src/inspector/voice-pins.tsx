import { h } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { OverlayStateManager } from './state.js';
import { VoiceTargetPin } from '@visual-edit/core';
import { isAnnotationOnRoute, observeNextDomCommit } from './route-utils.js';
import {
  PinAnchorOrigin,
  getPinAnchorOrigin,
  isDocumentScrollTarget,
  locatePinTarget,
} from './pin-position.js';
import { usePinPeekDrag } from './pin-drag.js';
import { handleRovingArrowKey } from './keyboard-nav.js';

export function VoicePins() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  const anchorRef = useRef<HTMLDivElement>(null);
  const anchorOriginRef = useRef<PinAnchorOrigin>({ left: 0, top: 0 });
  const needsDocScrollSyncRef = useRef(false);

  const { activeDragKey, snappingKey, startPinDrag } = usePinPeekDrag({
    onDragStart: () => setHoveredPinId(null),
  });

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

  const currentPath = state.getCurrentPathname();
  const hasVoicePins =
    (state.activeTool === 'voice' && state.activeVoicePins.length > 0) || state.voiceReviews.length > 0;

  useEffect(() => {
    setHoveredPinId(null);
    if (!hasVoicePins) return;
    return observeNextDomCommit(() => setTick((t) => t + 1));
  }, [currentPath, hasVoicePins]);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const measured = getPinAnchorOrigin(anchorRef.current);
    if (
      Math.abs(measured.left - anchorOriginRef.current.left) > 0.5 ||
      Math.abs(measured.top - anchorOriginRef.current.top) > 0.5
    ) {
      setTick((t) => t + 1);
    }
  }, [hasVoicePins, state.activeTool, state.voiceReviews.length, state.activeVoicePins.length, currentPath]);

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

  const anchor = getPinAnchorOrigin(anchorRef.current);
  anchorOriginRef.current = anchor;

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
            <span class="ve-glass-surface" aria-hidden="true" />
            <span class="ve-glass-bevel" aria-hidden="true" />
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
                <span class="ve-glass-surface" aria-hidden="true" />
                <span class="ve-glass-bevel" aria-hidden="true" />
                <span>{targetLabel}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
