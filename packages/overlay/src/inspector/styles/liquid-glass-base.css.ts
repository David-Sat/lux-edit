export const LIQUID_GLASS_BASE_CSS = `
/* Hidden by default when decoupled surfaces are not active */
.ve-glass-surface,
.ve-glass-bevel,
.ve-dock-focus-pill {
  display: none;
}

@keyframes veLiquidPop {
  0% {
    transform: scale(0.96);
  }
  100% {
    transform: scale(1.03);
  }
}

@keyframes veLiquidDockMorph {
  0% {
    transform: scaleX(0.68) scaleY(1.01);
  }
  100% {
    transform: scale(1, 1);
  }
}

@keyframes veLiquidOrbSettle {
  0% {
    transform: scale(1.04, 0.97);
  }
  100% {
    transform: scale(1, 1);
  }
}

@keyframes veLiquidJellySettle {
  0% {
    transform: scale(1.02, 0.985);
  }
  100% {
    transform: scale(1, 1);
  }
}

@keyframes veLiquidSlideUp {
  0% {
    transform: translateY(10px) scale(0.985);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes veLiquidSlideDown {
  0% {
    transform: translateY(-10px) scale(0.985);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes veLiquidPopIn {
  0% {
    transform: scale(0.96);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes veLiquidPinDrop {
  0% {
    scale: 0.84;
  }
  70% {
    scale: 1.02;
  }
  100% {
    scale: 1;
  }
}

@keyframes veLiquidTooltipBloom {
  0% {
    scale: 0.96;
    translate: 0 4px;
  }
  100% {
    scale: 1;
    translate: 0 0;
  }
}

@keyframes veLiquidGlide {
  0% {
    scale: 1 1;
  }
  45% {
    scale: 1.06 0.98;
  }
  100% {
    scale: 1 1;
  }
}

@keyframes veLiquidTapGlow {
  0% {
    opacity: 0.78;
    transform: scale(0.35);
  }
  100% {
    opacity: 0;
    transform: scale(1.45);
  }
}

@keyframes veLiquidSheenSweep {
  0% {
    opacity: 0;
    transform: translateX(-115%) rotate(22deg);
  }
  20% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
    transform: translateX(145%) rotate(22deg);
  }
}

/* Liquid Glass Material Tokens & Tiered Surfaces */
.ve-root.ve-glass-liquid {
  --ve-glass-border: transparent;
  --ve-glass-backdrop:
    blur(calc(var(--ve-lg-panel-blur, 5px) * 0.6))
    saturate(var(--ve-lg-sat, 180%))
    brightness(102%)
    contrast(104%);
  --ve-ease-liquid: cubic-bezier(0.2, 0.9, 0.25, 1);
}

/* Luminous Apple Control Center Clear Crystal Tone */
.ve-root.ve-glass-liquid.ve-glass-clear {
  --ve-glass-bg:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.14) 0%,
      rgba(255, 255, 255, 0.02) 38%,
      rgba(255, 255, 255, 0.06) 100%
    ),
    linear-gradient(
      180deg,
      rgba(44, 52, 66, calc(0.32 + var(--ve-lg-tint, 0.35) * 0.72)) 0%,
      rgba(28, 34, 46, calc(0.4 + var(--ve-lg-tint, 0.35) * 0.74)) 100%
    );
  --ve-glass-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.2),
    inset 0 0 8px 1px rgba(8, 14, 26, 0.18),
    inset 0 2px 3.5px 0 rgba(255, 255, 255, calc(0.95 * var(--ve-lg-spec, 0.78))),
    inset 0 -2px 3.5px 0 rgba(255, 255, 255, calc(0.5 * var(--ve-lg-spec, 0.78))),
    inset 0 0 18px 0 rgba(255, 255, 255, calc(0.2 * var(--ve-lg-spec, 0.78))),
    0 18px 46px -8px rgba(0, 0, 0, 0.26),
    0 5px 14px -2px rgba(0, 0, 0, 0.16);
}

/* Dark Obsidian Crystal Tone */
.ve-root.ve-glass-liquid.ve-glass-obsidian {
  --ve-glass-bg:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0.02) 34%,
      rgba(255, 255, 255, 0.04) 100%
    ),
    linear-gradient(
      180deg,
      rgba(16, 22, 36, calc(0.34 + var(--ve-lg-tint, 0.56) * 0.85)) 0%,
      rgba(9, 13, 24, calc(0.44 + var(--ve-lg-tint, 0.56) * 0.85)) 100%
    );
  --ve-glass-shadow:
    0 0 0 0.5px rgba(255, 255, 255, 0.16),
    inset 0 0 8px 1px rgba(0, 0, 0, 0.26),
    inset 0 2px 3.5px 0 rgba(255, 255, 255, calc(0.8 * var(--ve-lg-spec, 0.72))),
    inset 0 -2px 3.5px 0 rgba(255, 255, 255, calc(0.36 * var(--ve-lg-spec, 0.72))),
    inset 0 0 16px 0 rgba(255, 255, 255, calc(0.14 * var(--ve-lg-spec, 0.72))),
    0 18px 46px -6px rgba(0, 0, 0, 0.36),
    0 5px 16px -2px rgba(0, 0, 0, 0.24);
}

/* Highlight target badge keeps single-layer glass styling */
.ve-root.ve-glass-liquid .ve-badge {
  position: absolute;
  background: var(--ve-glass-bg);
  border-color: transparent;
  box-shadow: var(--ve-glass-shadow);
  backdrop-filter: var(--ve-glass-backdrop);
  -webkit-backdrop-filter: var(--ve-glass-backdrop);
}

/* Decoupled containers: .ve-glass-surface owns fill + backdrop-filter so child lenses never nest */
.ve-root.ve-glass-liquid .ve-launcher-btn,
.ve-root.ve-glass-liquid .ve-dock-menu,
.ve-root.ve-glass-liquid .ve-toolbar,
.ve-root.ve-glass-liquid .ve-drawer,
.ve-root.ve-glass-liquid .ve-comment-popover,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar,
.ve-root.ve-glass-liquid .ve-pin-tooltip,
.ve-root.ve-glass-liquid .ve-voice-pin-tooltip {
  background: transparent;
  border-color: transparent;
  box-shadow: var(--ve-glass-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* Opacity < 1 on ancestors creates a Backdrop Root and delays child refraction until animation end */
.ve-root.ve-glass-liquid .ve-launcher-btn,
.ve-root.ve-glass-liquid .ve-dock-menu {
  animation: none;
}

.ve-root.ve-glass-liquid.ve-dock-right .ve-dock-menu {
  transform-origin: calc(100% - 26px) 50%;
}

.ve-root.ve-glass-liquid.ve-dock-left .ve-dock-menu {
  transform-origin: 26px 50%;
}

.ve-root.ve-glass-liquid .ve-voice-recording-dock {
  animation: veLiquidSlideUp 0.2s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-dock-menu[data-ve-anim='morph'] {
  animation: veLiquidDockMorph 0.24s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-dock-menu[data-ve-anim='settle'] {
  animation: veLiquidJellySettle 0.2s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-launcher-btn[data-ve-anim='morph'],
.ve-root.ve-glass-liquid .ve-launcher-btn[data-ve-anim='settle'] {
  animation: veLiquidOrbSettle 0.2s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-drawer {
  animation: veLiquidSlideUp 0.22s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid.ve-dock-right.ve-dock-bottom .ve-drawer {
  transform-origin: bottom right;
}

.ve-root.ve-glass-liquid.ve-dock-left.ve-dock-bottom .ve-drawer {
  transform-origin: bottom left;
}

.ve-root.ve-glass-liquid.ve-dock-top .ve-drawer {
  animation: veLiquidSlideDown 0.22s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid.ve-dock-right.ve-dock-top .ve-drawer {
  transform-origin: top right;
}

.ve-root.ve-glass-liquid.ve-dock-left.ve-dock-top .ve-drawer {
  transform-origin: top left;
}

.ve-root.ve-glass-liquid .ve-comment-popover,
.ve-root.ve-glass-liquid .ve-toolbar,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar {
  animation: veLiquidPopIn 0.2s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-pin,
.ve-root.ve-glass-liquid .ve-voice-pin {
  animation: veLiquidPinDrop 0.22s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-pin-tooltip,
.ve-root.ve-glass-liquid .ve-voice-pin-tooltip {
  animation: veLiquidTooltipBloom 0.18s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-dock-menu {
  overflow: visible;
}

.ve-root.ve-glass-liquid .ve-glass-surface {
  display: block;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

/* One-shot optical glass sheen sweep on panel & tooltip surfaces (never uses tooltip ::after hover bridge) */
.ve-root.ve-glass-liquid .ve-drawer > .ve-glass-surface::after,
.ve-root.ve-glass-liquid .ve-toolbar > .ve-glass-surface::after,
.ve-root.ve-glass-liquid .ve-comment-popover > .ve-glass-surface::after,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar > .ve-glass-surface::after,
.ve-root.ve-glass-liquid .ve-pin-tooltip > .ve-glass-surface::after {
  content: '';
  position: absolute;
  inset-block: -40%;
  left: 0;
  inline-size: 56%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, calc(0.24 * var(--ve-lg-spec, 0.78))) 50%,
    transparent 100%
  );
  pointer-events: none;
  opacity: 0;
  animation: veLiquidSheenSweep 0.58s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.ve-root.ve-glass-liquid .ve-toolbar > .ve-glass-surface,
.ve-root.ve-glass-liquid .ve-drawer > .ve-glass-surface,
.ve-root.ve-glass-liquid .ve-comment-popover > .ve-glass-surface,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar > .ve-glass-surface,
.ve-root.ve-glass-liquid .ve-pin-tooltip > .ve-glass-surface {
  background: var(--ve-glass-bg);
  backdrop-filter: var(--ve-glass-backdrop);
  -webkit-backdrop-filter: var(--ve-glass-backdrop);
}

/* Keep all direct panel/pin content children stacked cleanly above .ve-glass-surface (z=0) and .ve-glass-bevel (z=1) */
.ve-root.ve-glass-liquid .ve-drawer-autosave-bar,
.ve-root.ve-glass-liquid .ve-comment-targets-list,
.ve-root.ve-glass-liquid .ve-composer-screenshot-box,
.ve-root.ve-glass-liquid .ve-comment-footer,
.ve-root.ve-glass-liquid .ve-variant-header,
.ve-root.ve-glass-liquid .ve-variant-decided-row,
.ve-root.ve-glass-liquid .ve-variant-options-row,
.ve-root.ve-glass-liquid .ve-variant-footer-row,
.ve-root.ve-glass-liquid .ve-pin-label,
.ve-root.ve-glass-liquid .ve-pin-tooltip-header,
.ve-root.ve-glass-liquid .ve-pin-tooltip-quote,
.ve-root.ve-glass-liquid .ve-pin-tooltip-body,
.ve-root.ve-glass-liquid .ve-pin-edit-stack,
.ve-root.ve-glass-liquid .ve-voice-pin > svg,
.ve-root.ve-glass-liquid .ve-voice-pin > span:not(.ve-glass-surface):not(.ve-glass-bevel),
.ve-root.ve-glass-liquid .ve-voice-pin-tooltip > span:not(.ve-glass-surface):not(.ve-glass-bevel) {
  position: relative;
  z-index: 2;
}

/* Pure-CSS 3D Optical Cylindrical Lens Sheen & Feathered Bevel (CSS fallback mode) */
.ve-root.ve-glass-liquid:not(.ve-glass-svg) .ve-glass-bevel {
  display: block;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.3) 0%,
      rgba(255, 255, 255, 0.08) 18%,
      rgba(255, 255, 255, 0) 44%,
      rgba(255, 255, 255, 0) 76%,
      rgba(255, 255, 255, 0.14) 94%,
      rgba(255, 255, 255, 0.26) 100%
    );
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, calc(0.5 * var(--ve-lg-spec, 0.78))),
    inset 0 -2px 6px rgba(255, 255, 255, calc(0.28 * var(--ve-lg-spec, 0.78))),
    inset 5px 0 10px -3px rgba(186, 230, 253, calc(0.28 * var(--ve-lg-spec, 0.78))),
    inset -5px 0 10px -3px rgba(216, 180, 254, calc(0.24 * var(--ve-lg-spec, 0.78))),
    inset 0 0 12px 1px rgba(10, 16, 28, 0.14);
}

/* Lighter internal chrome bars inside translucent panels */
.ve-root.ve-glass-liquid.ve-glass-clear .ve-toolbar-header,
.ve-root.ve-glass-liquid.ve-glass-clear .ve-drawer-header {
  background: rgba(15, 23, 42, 0.16);
  border-bottom-color: rgba(255, 255, 255, 0.16);
}

.ve-root.ve-glass-liquid.ve-glass-clear .ve-toolbar-tabs {
  background: rgba(15, 23, 42, 0.18);
  border-bottom-color: rgba(255, 255, 255, 0.14);
}

.ve-root.ve-glass-liquid.ve-glass-clear .ve-drawer-autosave-bar {
  background: rgba(15, 23, 42, 0.18);
  border-top-color: rgba(255, 255, 255, 0.14);
}

.ve-root.ve-glass-liquid.ve-glass-clear .ve-drawer-footer {
  background: rgba(255, 255, 255, 0.08);
  border-top-color: rgba(255, 255, 255, 0.14);
}

/* Preserve crisp contrast on inner drawer cards over bright host pages */
.ve-root.ve-glass-liquid .ve-mutation-card,
.ve-root.ve-glass-liquid .ve-reply-item,
.ve-root.ve-glass-liquid .ve-card--proposal,
.ve-root.ve-glass-liquid .ve-card--voice,
.ve-root.ve-glass-liquid .ve-card--screenshot {
  background: rgba(12, 18, 32, 0.56);
  border-color: rgba(255, 255, 255, 0.2);
}

/* Opposing Double-Arc Pure White Fresnel Specular Rim via CSS Mask */
.ve-root.ve-glass-liquid .ve-launcher-btn::before,
.ve-root.ve-glass-liquid .ve-dock-menu::before,
.ve-root.ve-glass-liquid .ve-dock-focus-pill::before,
.ve-root.ve-glass-liquid .ve-toolbar::before,
.ve-root.ve-glass-liquid .ve-comment-popover::before,
.ve-root.ve-glass-liquid .ve-drawer::before,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar::before,
.ve-root.ve-glass-liquid .ve-pin-tooltip::before,
.ve-root.ve-glass-liquid .ve-voice-pin::before,
.ve-root.ve-glass-liquid .ve-voice-pin-tooltip::before,
.ve-root.ve-glass-liquid .ve-badge::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1.75px;
  background: linear-gradient(
    var(--ve-rim-angle, 135deg),
    rgba(255, 255, 255, calc(0.98 * var(--ve-lg-spec, 0.78))) 0%,
    rgba(255, 255, 255, calc(0.62 * var(--ve-lg-spec, 0.78))) 18%,
    rgba(255, 255, 255, calc(0.24 * var(--ve-lg-spec, 0.78))) 46%,
    rgba(255, 255, 255, calc(0.26 * var(--ve-lg-spec, 0.78))) 56%,
    rgba(255, 255, 255, calc(0.66 * var(--ve-lg-spec, 0.78))) 82%,
    rgba(255, 255, 255, calc(0.96 * var(--ve-lg-spec, 0.78))) 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 3;
}

.ve-root.ve-glass-liquid .ve-voice-pin::before {
  inset: 0;
  padding: 1.4px;
}

.ve-root.ve-glass-liquid .ve-dock-focus-pill::before {
  inset: 0;
  padding: 1.65px;
}

`;
