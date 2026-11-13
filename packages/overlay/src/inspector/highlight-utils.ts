/** Temporarily flashes an element outline/glow and restores its prior inline style afterward. */
export function flashElementHighlight(
  el: HTMLElement,
  boxShadow: string,
  transition: string,
  durationMs: number
): void {
  try {
    const origTransition = el.style.transition;
    const origBoxShadow = el.style.boxShadow;
    el.style.transition = transition;
    el.style.boxShadow = boxShadow;
    setTimeout(() => {
      el.style.boxShadow = origBoxShadow;
      el.style.transition = origTransition;
    }, durationMs);
  } catch (err) {
    console.debug('[lux] Failed to apply highlight flash animation:', err);
  }
}
