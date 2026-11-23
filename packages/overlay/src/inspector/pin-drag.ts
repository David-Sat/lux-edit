import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { createLiquidDragDeformer, prefersReducedMotion } from './liquid-glass.js';

export interface StartPinDragTarget {
  pinKey: string;
  pinEl: HTMLElement;
}

const DRAG_THRESHOLD_PX = 4;
const SNAP_BACK_TIMEOUT_MS = 380;

/**
 * Parses a CSS `translate` property value (`"none"`, `"40px"`, `"40px -18px"`, `"40px -18px 0px"`)
 * into numeric pixel offsets for smooth mid-snap re-grabbing.
 */
export function parseTranslateOffset(value: string | null | undefined): { dx: number; dy: number } {
  if (!value) return { dx: 0, dy: 0 };
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'none') return { dx: 0, dy: 0 };

  const parts = trimmed.split(/\s+/);
  const dx = Number.parseFloat(parts[0] ?? '0');
  const dy = parts.length > 1 ? Number.parseFloat(parts[1] ?? '0') : 0;

  return {
    dx: Number.isFinite(dx) ? dx : 0,
    dy: Number.isFinite(dy) ? dy : 0,
  };
}

/**
 * Clamps a pin's drag delta so its center remains within viewport margins while peeking aside.
 */
export function clampPinDragOffset(
  dx: number,
  dy: number,
  homeCenterX: number,
  homeCenterY: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 16
): { dx: number; dy: number } {
  const clampedDx =
    viewportWidth > margin * 2
      ? Math.max(margin - homeCenterX, Math.min(viewportWidth - margin - homeCenterX, dx))
      : dx;
  const clampedDy =
    viewportHeight > margin * 2
      ? Math.max(margin - homeCenterY, Math.min(viewportHeight - margin - homeCenterY, dy))
      : dy;

  return { dx: clampedDx, dy: clampedDy };
}

/**
 * Drives temporary drag-to-peek interaction and elastic snap-back for canvas pins
 * without triggering Preact re-renders on every pointer move frame.
 */
export function usePinPeekDrag(options?: { onDragStart?: (pinKey: string) => void }) {
  const [activeDragKey, setActiveDragKey] = useState<string | null>(null);
  const [snappingKey, setSnappingKey] = useState<string | null>(null);

  const activeDragCleanupRef = useRef<(() => void) | null>(null);
  const snapCleanupsRef = useRef<Map<HTMLElement, () => void>>(new Map());
  const suppressedClickKeyRef = useRef<string | null>(null);
  const suppressedClickTimerRef = useRef<number | null>(null);
  const onDragStartRef = useRef(options?.onDragStart);
  onDragStartRef.current = options?.onDragStart;

  const clearSuppressedClick = useCallback(() => {
    suppressedClickKeyRef.current = null;
    if (suppressedClickTimerRef.current !== null) {
      window.clearTimeout(suppressedClickTimerRef.current);
      suppressedClickTimerRef.current = null;
    }
  }, []);

  const consumeSuppressedClick = useCallback(
    (pinKey: string): boolean => {
      if (suppressedClickKeyRef.current === pinKey) {
        clearSuppressedClick();
        return true;
      }
      return false;
    },
    [clearSuppressedClick]
  );

  useEffect(() => {
    const snapCleanups = snapCleanupsRef.current;
    return () => {
      activeDragCleanupRef.current?.();
      activeDragCleanupRef.current = null;
      snapCleanups.forEach((fn) => fn());
      snapCleanups.clear();
      clearSuppressedClick();
    };
  }, [clearSuppressedClick]);

  const cancelSnapForElement = useCallback((el: HTMLElement) => {
    const cancel = snapCleanupsRef.current.get(el);
    if (cancel) {
      cancel();
      snapCleanupsRef.current.delete(el);
    }
  }, []);

  const startPinDrag = useCallback(
    (e: PointerEvent, target: StartPinDragTarget) => {
      if (e.button !== 0) return;
      const rawTarget = e.target as Element | null;
      if (rawTarget?.closest?.('.ve-pin-tooltip, .ve-voice-pin-tooltip')) {
        return;
      }

      e.stopPropagation();

      if (activeDragCleanupRef.current) {
        activeDragCleanupRef.current();
        activeDragCleanupRef.current = null;
      }

      const { pinKey, pinEl } = target;
      const pointerId = e.pointerId;
      const startClientX = e.clientX;
      const startClientY = e.clientY;

      let computedTranslate = '';
      if (typeof window.getComputedStyle === 'function') {
        computedTranslate = window.getComputedStyle(pinEl).translate || '';
      }
      const inFlight = parseTranslateOffset(
        computedTranslate && computedTranslate !== 'none' ? computedTranslate : pinEl.style.translate
      );

      cancelSnapForElement(pinEl);

      const rect = pinEl.getBoundingClientRect();
      const homeCenterX = rect.left + rect.width / 2 - inFlight.dx;
      const homeCenterY = rect.top + rect.height / 2 - inFlight.dy;

      const regrabbedMidSnap = Math.hypot(inFlight.dx, inFlight.dy) > 0.5;
      let hasMoved = false;
      let lastClientX = startClientX;
      let lastClientY = startClientY;
      const deformer = createLiquidDragDeformer(pinEl);

      const syncVisualOffset = (dx: number, dy: number) => {
        pinEl.style.translate = `${dx}px ${dy}px`;
      };

      const activateDrag = (dx: number, dy: number) => {
        hasMoved = true;
        onDragStartRef.current?.(pinKey);
        pinEl.classList.remove('ve-snapping');
        pinEl.classList.add('ve-dragging');
        setSnappingKey((prev) => (prev === pinKey ? null : prev));

        try {
          if (pinEl.setPointerCapture) {
            pinEl.setPointerCapture(pointerId);
          }
        } catch (err) {
          console.debug('[lux] Failed to capture pin drag pointer:', err);
        }

        syncVisualOffset(dx, dy);
        setActiveDragKey(pinKey);
      };

      if (regrabbedMidSnap) {
        activateDrag(inFlight.dx, inFlight.dy);
      }

      const onPointerMove = (moveEv: PointerEvent) => {
        const rawDx = inFlight.dx + (moveEv.clientX - startClientX);
        const rawDy = inFlight.dy + (moveEv.clientY - startClientY);
        const stepDx = moveEv.clientX - lastClientX;
        const stepDy = moveEv.clientY - lastClientY;
        lastClientX = moveEv.clientX;
        lastClientY = moveEv.clientY;

        if (!hasMoved) {
          if (Math.hypot(moveEv.clientX - startClientX, moveEv.clientY - startClientY) < DRAG_THRESHOLD_PX) {
            return;
          }
          const clamped = clampPinDragOffset(
            rawDx,
            rawDy,
            homeCenterX,
            homeCenterY,
            window.innerWidth || 0,
            window.innerHeight || 0
          );
          moveEv.preventDefault();
          activateDrag(clamped.dx, clamped.dy);
        } else {
          moveEv.preventDefault();
          const clamped = clampPinDragOffset(
            rawDx,
            rawDy,
            homeCenterX,
            homeCenterY,
            window.innerWidth || 0,
            window.innerHeight || 0
          );
          syncVisualOffset(clamped.dx, clamped.dy);
        }

        deformer.push(stepDx, stepDy);
      };

      const finishSnapBack = () => {
        clearSuppressedClick();
        suppressedClickKeyRef.current = pinKey;
        suppressedClickTimerRef.current = window.setTimeout(() => {
          suppressedClickKeyRef.current = null;
          suppressedClickTimerRef.current = null;
        }, 80);

        pinEl.classList.remove('ve-dragging');
        setActiveDragKey(null);

        if (prefersReducedMotion()) {
          pinEl.style.removeProperty('translate');
          setSnappingKey((prev) => (prev === pinKey ? null : prev));
          return;
        }

        pinEl.classList.add('ve-snapping');
        setSnappingKey(pinKey);
        // Flush styles with `.ve-snapping` active before resetting `translate` so the spring transition starts from the peek offset.
        void pinEl.offsetWidth;
        pinEl.style.translate = '0px 0px';

        let done = false;
        let fallbackTimerId = 0;

        const completeSnap = () => {
          if (done) return;
          done = true;
          pinEl.removeEventListener('transitionend', onTransitionEnd);
          window.clearTimeout(fallbackTimerId);
          snapCleanupsRef.current.delete(pinEl);
          pinEl.classList.remove('ve-snapping');
          pinEl.style.removeProperty('translate');
          setSnappingKey((prev) => (prev === pinKey ? null : prev));
        };

        const cancelMidSnap = () => {
          if (done) return;
          done = true;
          pinEl.removeEventListener('transitionend', onTransitionEnd);
          window.clearTimeout(fallbackTimerId);
          pinEl.classList.remove('ve-snapping');
        };

        const onTransitionEnd = (ev: TransitionEvent) => {
          if (ev.target === pinEl && ev.propertyName === 'translate') {
            completeSnap();
          }
        };

        pinEl.addEventListener('transitionend', onTransitionEnd);
        fallbackTimerId = window.setTimeout(completeSnap, SNAP_BACK_TIMEOUT_MS);
        snapCleanupsRef.current.set(pinEl, cancelMidSnap);
      };

      const detachListeners = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        deformer.clear();

        try {
          if (pinEl.hasPointerCapture && pinEl.hasPointerCapture(pointerId)) {
            pinEl.releasePointerCapture(pointerId);
          }
        } catch (err) {
          console.debug('[lux] Failed to release pin drag pointer:', err);
        }
      };

      const onPointerUp = () => {
        detachListeners();
        if (activeDragCleanupRef.current === forceAbort) {
          activeDragCleanupRef.current = null;
        }
        if (hasMoved) {
          finishSnapBack();
        }
      };

      const forceAbort = () => {
        detachListeners();
        pinEl.classList.remove('ve-dragging');
        pinEl.classList.remove('ve-snapping');
        pinEl.style.removeProperty('translate');
      };

      activeDragCleanupRef.current = forceAbort;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [cancelSnapForElement, clearSuppressedClick]
  );

  return {
    activeDragKey,
    snappingKey,
    startPinDrag,
    consumeSuppressedClick,
  };
}
