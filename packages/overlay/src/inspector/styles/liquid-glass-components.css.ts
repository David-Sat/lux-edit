export const LIQUID_GLASS_COMPONENTS_CSS = `
/* Tier 2 Hero Compact Chrome — Clear Crystal Mode (De-frosted + Feathered Depth) */
.ve-root.ve-glass-liquid.ve-glass-clear .ve-launcher-btn,
.ve-root.ve-glass-liquid.ve-glass-clear .ve-dock-menu {
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.22),
    inset 0 0 8px 1px rgba(8, 14, 26, 0.18),
    inset 0 2px 3.5px 0 rgba(255, 255, 255, calc(0.98 * var(--ve-lg-spec, 0.78))),
    inset 0 -2px 3.5px 0 rgba(255, 255, 255, calc(0.6 * var(--ve-lg-spec, 0.78))),
    inset 0 0 16px 0 rgba(255, 255, 255, calc(0.24 * var(--ve-lg-spec, 0.78))),
    0 12px 34px -6px rgba(0, 0, 0, 0.22),
    0 3px 10px -1px rgba(0, 0, 0, 0.12);
}

.ve-root.ve-glass-liquid.ve-glass-clear .ve-launcher-btn > .ve-glass-surface,
.ve-root.ve-glass-liquid.ve-glass-clear .ve-dock-menu > .ve-glass-surface {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.02) 48%,
      rgba(255, 255, 255, 0.08) 100%
    ),
    linear-gradient(
      180deg,
      rgba(54, 62, 76, calc(0.16 + var(--ve-lg-tint, 0.35) * 0.72)) 0%,
      rgba(36, 43, 56, calc(0.22 + var(--ve-lg-tint, 0.35) * 0.76)) 100%
    );
  backdrop-filter:
    blur(calc(var(--ve-lg-hero-blur, 3.5px) * 0.35))
    saturate(calc(var(--ve-lg-sat, 180%) * 1.15))
    contrast(110%)
    brightness(105%);
  -webkit-backdrop-filter:
    blur(calc(var(--ve-lg-hero-blur, 3.5px) * 0.35))
    saturate(calc(var(--ve-lg-sat, 180%) * 1.15))
    contrast(110%)
    brightness(105%);
}

/* Tier 2 Hero Compact Chrome — Dark Obsidian Mode */
.ve-root.ve-glass-liquid.ve-glass-obsidian .ve-launcher-btn,
.ve-root.ve-glass-liquid.ve-glass-obsidian .ve-dock-menu {
  box-shadow:
    0 0 0 0.5px rgba(255, 255, 255, 0.18),
    inset 0 0 8px 1px rgba(0, 0, 0, 0.26),
    inset 0 2px 3.5px 0 rgba(255, 255, 255, calc(0.84 * var(--ve-lg-spec, 0.72))),
    inset 0 -2px 3.5px 0 rgba(255, 255, 255, calc(0.44 * var(--ve-lg-spec, 0.72))),
    inset 0 0 16px 0 rgba(255, 255, 255, calc(0.16 * var(--ve-lg-spec, 0.72))),
    0 14px 36px -6px rgba(0, 0, 0, 0.36),
    0 5px 14px -2px rgba(0, 0, 0, 0.24);
}

.ve-root.ve-glass-liquid.ve-glass-obsidian .ve-launcher-btn > .ve-glass-surface,
.ve-root.ve-glass-liquid.ve-glass-obsidian .ve-dock-menu > .ve-glass-surface {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.14) 0%,
      rgba(255, 255, 255, 0.02) 45%,
      rgba(255, 255, 255, 0.07) 100%
    ),
    linear-gradient(
      180deg,
      rgba(15, 22, 36, calc(0.18 + var(--ve-lg-tint, 0.56) * 0.82)) 0%,
      rgba(8, 13, 24, calc(0.26 + var(--ve-lg-tint, 0.56) * 0.85)) 100%
    );
  backdrop-filter:
    blur(calc(var(--ve-lg-hero-blur, 4px) * 0.35))
    saturate(calc(var(--ve-lg-sat, 180%) * 1.15))
    contrast(110%)
    brightness(105%);
  -webkit-backdrop-filter:
    blur(calc(var(--ve-lg-hero-blur, 4px) * 0.35))
    saturate(calc(var(--ve-lg-sat, 180%) * 1.15))
    contrast(110%)
    brightness(105%);
}

.ve-root.ve-glass-liquid .ve-launcher-btn,
.ve-root.ve-glass-liquid .ve-dock-menu {
  transition:
    inset-inline-start 0.28s var(--ve-ease-spring),
    inset-inline-end 0.28s var(--ve-ease-spring),
    inset-block-start 0.28s var(--ve-ease-spring),
    inset-block-end 0.28s var(--ve-ease-spring),
    transform 0.24s var(--ve-ease-liquid),
    box-shadow 0.22s var(--ve-ease-spring);
}

/* Heightened optical elevation when an option is selected inside the dock */
.ve-root.ve-glass-liquid .ve-dock-menu.ve-has-selection {
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.2),
    inset 0 0 6px 0 rgba(10, 16, 28, 0.16),
    inset 0 2px 3px 0 rgba(255, 255, 255, calc(1 * var(--ve-lg-spec, 0.78))),
    inset 0 -2px 3px 0 rgba(255, 255, 255, calc(0.65 * var(--ve-lg-spec, 0.78))),
    inset 0 0 18px 0 rgba(255, 255, 255, calc(0.28 * var(--ve-lg-spec, 0.78))),
    0 14px 36px -6px rgba(0, 0, 0, 0.24),
    0 4px 12px -2px rgba(0, 0, 0, 0.12);
}

/* Pointer-tracking Specular Glint Layer on Hero & Panel Surfaces (excludes .ve-pin-tooltip::after hover bridge) */
.ve-root.ve-glass-liquid .ve-launcher-btn::after,
.ve-root.ve-glass-liquid .ve-dock-menu::after,
.ve-root.ve-glass-liquid .ve-drawer::after,
.ve-root.ve-glass-liquid .ve-toolbar::after,
.ve-root.ve-glass-liquid .ve-comment-popover::after,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
  z-index: 1;
}

.ve-root.ve-glass-liquid .ve-launcher-btn::after,
.ve-root.ve-glass-liquid .ve-dock-menu::after {
  background: radial-gradient(
    circle at var(--ve-gx, 30%) var(--ve-gy, 22%),
    rgba(255, 255, 255, calc(0.38 * var(--ve-lg-spec, 0.78))),
    rgba(255, 255, 255, calc(0.09 * var(--ve-lg-spec, 0.78))) 35%,
    transparent 68%
  );
}

.ve-root.ve-glass-liquid .ve-drawer::after,
.ve-root.ve-glass-liquid .ve-toolbar::after,
.ve-root.ve-glass-liquid .ve-comment-popover::after,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar::after {
  background: radial-gradient(
    circle 180px at var(--ve-gx, 30%) var(--ve-gy, 22%),
    rgba(255, 255, 255, calc(0.14 * var(--ve-lg-spec, 0.78))),
    rgba(255, 255, 255, calc(0.03 * var(--ve-lg-spec, 0.78))) 42%,
    transparent 74%
  );
}

.ve-root.ve-glass-liquid .ve-launcher-btn[data-ve-glint='true']::after,
.ve-root.ve-glass-liquid .ve-dock-menu[data-ve-glint='true']::after,
.ve-root.ve-glass-liquid .ve-drawer[data-ve-glint='true']::after,
.ve-root.ve-glass-liquid .ve-toolbar[data-ve-glint='true']::after,
.ve-root.ve-glass-liquid .ve-comment-popover[data-ve-glint='true']::after,
.ve-root.ve-glass-liquid .ve-variant-switcher-bar[data-ve-glint='true']::after {
  opacity: 1;
}

.ve-root.ve-glass-liquid .ve-launcher-btn[data-ve-pulse='true']::after {
  opacity: 1;
  background: radial-gradient(
    circle at var(--ve-rx, 50%) var(--ve-ry, 50%),
    rgba(255, 255, 255, 0.56) 0%,
    rgba(186, 230, 253, 0.24) 36%,
    transparent 68%
  );
  animation: veLiquidTapGlow 0.38s ease-out forwards;
}

/* Touch-Point Illumination Ripples on Interactive Glass Controls */
.ve-root.ve-glass-liquid .ve-btn,
.ve-root.ve-glass-liquid .ve-mini-btn,
.ve-root.ve-glass-liquid .ve-variant-option-btn {
  position: relative;
  overflow: hidden;
}

.ve-root.ve-glass-liquid .ve-dock-item[data-ve-pulse='true']::after,
.ve-root.ve-glass-liquid .ve-btn[data-ve-pulse='true']::after,
.ve-root.ve-glass-liquid .ve-mini-btn[data-ve-pulse='true']::after,
.ve-root.ve-glass-liquid .ve-variant-option-btn[data-ve-pulse='true']::after,
.ve-root.ve-glass-liquid .ve-tab-btn[data-ve-pulse='true']::after,
.ve-root.ve-glass-liquid .ve-mode-pill[data-ve-pulse='true']::after,
.ve-root.ve-glass-liquid .ve-pin[data-ve-pulse='true']::after,
.ve-root.ve-glass-liquid .ve-voice-pin[data-ve-pulse='true']::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    circle at var(--ve-rx, 50%) var(--ve-ry, 50%),
    rgba(255, 255, 255, 0.55) 0%,
    rgba(186, 230, 253, 0.22) 38%,
    transparent 68%
  );
  pointer-events: none;
  z-index: 3;
  animation: veLiquidTapGlow 0.4s ease-out forwards;
}

/* Keep voice dock children above the ::after glint overlay and preserve semantic recording glow */
.ve-root.ve-glass-liquid .ve-dock-drag-handle,
.ve-root.ve-glass-liquid .ve-voice-status-dot,
.ve-root.ve-glass-liquid .ve-voice-timer,
.ve-root.ve-glass-liquid .ve-voice-transcript-preview,
.ve-root.ve-glass-liquid .ve-voice-pin-badge {
  position: relative;
  z-index: 2;
}

.ve-root.ve-glass-liquid .ve-voice-recording-dock {
  box-shadow:
    0 8px 28px rgba(245, 158, 11, 0.22),
    inset 0 1.5px 2px rgba(255, 255, 255, calc(0.65 * var(--ve-lg-spec, 0.78))),
    0 0 0 1px rgba(245, 158, 11, 0.42);
}

.ve-root.ve-glass-liquid .ve-voice-recording-dock > .ve-glass-surface {
  background:
    linear-gradient(
      180deg,
      rgba(245, 158, 11, 0.16) 0%,
      rgba(36, 40, 54, calc(0.32 + var(--ve-lg-tint, 0.35) * 0.68)) 100%
    );
}

.ve-root.ve-glass-liquid .ve-voice-recording-dock.is-ready {
  box-shadow:
    0 8px 28px rgba(220, 38, 38, 0.26),
    inset 0 1.5px 2px rgba(255, 255, 255, calc(0.65 * var(--ve-lg-spec, 0.78))),
    0 0 0 1px rgba(239, 68, 68, 0.46);
}

.ve-root.ve-glass-liquid .ve-voice-recording-dock.is-ready > .ve-glass-surface {
  background:
    linear-gradient(
      180deg,
      rgba(239, 68, 68, 0.18) 0%,
      rgba(36, 40, 54, calc(0.32 + var(--ve-lg-tint, 0.35) * 0.68)) 100%
    );
}

/* Native macOS Control Center Iconography & Pill Legibility */
.ve-root.ve-glass-liquid .ve-launcher-btn > svg,
.ve-root.ve-glass-liquid .ve-dock-item > svg,
.ve-root.ve-glass-liquid .ve-dock-drag-handle > svg {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.34));
}

.ve-root.ve-glass-liquid .ve-dock-drag-handle {
  color: rgba(255, 255, 255, 0.84);
  opacity: 0.9;
}

.ve-root.ve-glass-liquid .ve-dock-item,
.ve-root.ve-glass-liquid .ve-mode-pill,
.ve-root.ve-glass-liquid .ve-voice-timer,
.ve-root.ve-glass-liquid .ve-voice-transcript-preview {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.34);
}

.ve-root.ve-glass-liquid.ve-glass-clear .ve-mode-pill {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.24);
  color: #ffffff;
  box-shadow:
    inset 0 1px 0.5px rgba(255, 255, 255, 0.48),
    0 1px 4px rgba(0, 0, 0, 0.14);
}

.ve-root.ve-glass-liquid.ve-glass-obsidian .ve-mode-pill {
  background: rgba(8, 13, 24, 0.46);
  border-color: rgba(255, 255, 255, 0.22);
  color: #f8fafc;
}

.ve-root.ve-glass-liquid .ve-mode-pill.ve-active {
  background: linear-gradient(
    180deg,
    rgba(52, 211, 153, 0.36) 0%,
    rgba(16, 185, 129, 0.2) 100%
  );
  border-color: rgba(110, 231, 183, 0.42);
  color: #ecfdf5;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.45),
    inset 0 -1px 1px rgba(16, 185, 129, 0.35),
    0 4px 12px rgba(16, 185, 129, 0.22);
}

.ve-root.ve-glass-liquid .ve-dock-item {
  color: rgba(255, 255, 255, 0.96);
  transition:
    transform 0.2s var(--ve-ease-liquid),
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease;
}

.ve-root.ve-glass-liquid .ve-dock-item:hover {
  transform: scale(1.03);
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.42),
    0 4px 12px rgba(0, 0, 0, 0.16);
}

.ve-root.ve-glass-liquid .ve-dock-item:active {
  transform: scale(0.96);
}

.ve-root.ve-glass-liquid .ve-dock-item:focus-visible,
.ve-root.ve-glass-liquid .ve-launcher-btn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
  box-shadow:
    0 0 0 4px rgba(56, 189, 248, 0.45),
    0 8px 24px rgba(0, 0, 0, 0.35);
}

/* Sliding Liquid Glass Focus Pill inside .ve-dock-menu */
.ve-root.ve-glass-liquid .ve-dock-focus-pill {
  display: block;
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 9999px;
  border: none;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(
    circle at 32% 24%,
    rgba(255, 255, 255, 0.36) 0%,
    rgba(255, 255, 255, 0.08) 54%,
    rgba(255, 255, 255, 0.2) 100%
  );
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.22),
    inset 0 0 8px 1px rgba(8, 14, 26, 0.2),
    inset 0 2.5px 4px 0 rgba(255, 255, 255, 0.68),
    inset 0 -2.5px 4px 0 rgba(186, 230, 253, 0.42),
    inset 0 0 12px 0 rgba(255, 255, 255, 0.22),
    0 6px 18px -2px rgba(0, 0, 0, 0.28),
    0 2px 6px rgba(0, 0, 0, 0.18);
  opacity: 0;
  scale: 0.9;
  transition:
    opacity 0.16s ease,
    scale 0.2s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-dock-focus-pill.is-visible {
  opacity: 1;
  scale: 1;
}

.ve-root.ve-glass-liquid .ve-dock-focus-pill.is-sliding {
  transition:
    transform 0.28s var(--ve-ease-liquid),
    opacity 0.16s ease,
    scale 0.2s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-dock-focus-pill.is-gliding {
  animation: veLiquidFocusGlide 0.26s ease-out;
}

/* Raised Convex Optical Meniscus on Selected Options (Subtle Glass Rim, Zero Harsh White Ring) */
.ve-root.ve-glass-liquid .ve-dock-item.ve-active {
  background: radial-gradient(
    circle at 34% 24%,
    rgba(255, 255, 255, 0.34) 0%,
    rgba(255, 255, 255, 0.1) 54%,
    rgba(255, 255, 255, 0.18) 100%
  );
  border-color: rgba(255, 255, 255, 0.24);
  box-shadow:
    inset 0 1.5px 2px rgba(255, 255, 255, 0.48),
    inset 0 -1.5px 2px rgba(186, 230, 253, 0.25),
    0 6px 14px rgba(0, 0, 0, 0.22);
  transform: scale(1.03);
  animation: veLiquidPop 0.2s var(--ve-ease-liquid);
}

.ve-root.ve-glass-liquid .ve-btn:active,
.ve-root.ve-glass-liquid .ve-mini-btn:active,
.ve-root.ve-glass-liquid .ve-variant-option-btn:active {
  transform: scale(0.98);
}

.ve-root.ve-glass-liquid .ve-mini-btn.ve-active,
.ve-root.ve-glass-liquid .ve-variant-option-btn.is-selected {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.28) 0%,
    rgba(56, 189, 248, 0.22) 100%
  );
  border-color: rgba(255, 255, 255, 0.28);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.42),
    inset 0 -1px 1px rgba(56, 189, 248, 0.28),
    0 3px 10px rgba(0, 0, 0, 0.22);
}

.ve-root.ve-glass-liquid .ve-launcher-btn:hover {
  transform: scale(1.03);
}

.ve-root.ve-glass-liquid .ve-launcher-btn:active {
  transform: scale(0.96);
}

.ve-root.ve-glass-liquid .ve-launcher-btn.ve-dragging,
.ve-root.ve-glass-liquid .ve-dock-menu.ve-dragging {
  transform: scale(calc(1.03 * var(--ve-drag-sx, 1)), calc(1.03 * var(--ve-drag-sy, 1)))
    rotate(var(--ve-drag-rot, 0deg));
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.26),
    inset 0 2px 2px rgba(255, 255, 255, 0.85),
    0 0 0 0.5px rgba(255, 255, 255, 0.45) !important;
}

/* Toolbar Sliding Liquid Pill Tab Indicator */
.ve-tab-indicator {
  display: none;
}

.ve-root.ve-glass-liquid .ve-toolbar-tabs {
  display: grid;
  grid-template-columns: repeat(var(--ve-tab-count, 7), minmax(0, 1fr));
  position: relative;
  gap: 0;
  padding: 3px 4px;
}

.ve-root.ve-glass-liquid .ve-tab-indicator {
  display: block;
  position: absolute;
  inset-block: 2px;
  inset-inline-start: 4px;
  inline-size: calc((100% - 8px) / var(--ve-tab-count, 7));
  border-radius: 9px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.26);
  box-shadow:
    inset 0 0 6px rgba(10, 16, 28, 0.18),
    inset 0 2px 3px rgba(255, 255, 255, 0.55),
    inset 0 -2px 3px rgba(186, 230, 253, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.22);
  transform: translateX(calc(var(--ve-tab-index, 0) * 100%));
  transition: transform 0.28s var(--ve-ease-liquid);
  pointer-events: none;
  z-index: 0;
}

.ve-root.ve-glass-liquid .ve-tab-indicator.is-gliding {
  animation: veLiquidTabGlide 0.26s ease-out;
}

.ve-root.ve-glass-liquid .ve-tab-btn {
  position: relative;
  z-index: 1;
  padding-inline: 2px;
  color: rgba(248, 250, 252, 0.78);
}

.ve-root.ve-glass-liquid .ve-tab-btn.ve-active {
  background: transparent;
  box-shadow: none;
  color: #ffffff;
}

/* Comment Pins — Borderless Spherical Magnifying Glass Lenses */
.ve-root.ve-glass-liquid .ve-pin,
.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi {
  inline-size: 30px;
  block-size: 30px;
  cursor: pointer;
  touch-action: none;
  background: transparent;
  border: none;
  overflow: visible;
  box-shadow:
    0 4px 12px -2px rgba(2, 132, 199, 0.34),
    0 1px 4px rgba(15, 23, 42, 0.2);
}

.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi {
  box-shadow:
    0 4px 12px -2px rgba(79, 70, 229, 0.36),
    0 1px 4px rgba(15, 23, 42, 0.22);
}

.ve-root.ve-glass-liquid .ve-pin::before {
  content: '';
  position: absolute;
  inset: 3px 6px auto 6px;
  block-size: 34%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at 44% 22%,
    rgba(255, 255, 255, calc(0.56 * var(--ve-lg-spec, 0.78))) 0%,
    rgba(255, 255, 255, calc(0.14 * var(--ve-lg-spec, 0.78))) 46%,
    transparent 72%
  );
  pointer-events: none;
  z-index: 3;
}

.ve-root.ve-glass-liquid .ve-pin > .ve-glass-bevel {
  display: none;
}

.ve-root.ve-glass-liquid .ve-pin > .ve-glass-surface {
  background: linear-gradient(
    180deg,
    rgba(14, 165, 233, 0.36) 0%,
    rgba(2, 132, 199, 0.46) 100%
  );
  backdrop-filter: blur(1.5px) saturate(190%) contrast(106%);
  -webkit-backdrop-filter: blur(1.5px) saturate(190%) contrast(106%);
}

.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi > .ve-glass-surface {
  background: linear-gradient(
    180deg,
    rgba(99, 102, 241, 0.38) 0%,
    rgba(67, 56, 202, 0.48) 100%
  );
}

.ve-root.ve-glass-liquid .ve-pin-label {
  pointer-events: none;
  color: #ffffff;
  font-weight: 700;
  text-shadow:
    0 1px 2.5px rgba(7, 24, 48, 0.88),
    0 0 5px rgba(2, 62, 118, 0.65);
}

.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi .ve-pin-label {
  text-shadow:
    0 1px 2.5px rgba(15, 18, 58, 0.88),
    0 0 5px rgba(49, 46, 129, 0.65);
}

.ve-root.ve-glass-liquid .ve-pin:hover,
.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi:hover {
  background: transparent;
  transform: translate(-50%, -50%) scale(1.07);
  box-shadow:
    0 6px 16px -2px rgba(14, 165, 233, 0.44),
    0 2px 6px rgba(15, 23, 42, 0.26);
}

.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi:hover {
  box-shadow:
    0 6px 16px -2px rgba(79, 70, 229, 0.46),
    0 2px 6px rgba(15, 23, 42, 0.28);
}

.ve-root.ve-glass-liquid .ve-pin:active {
  transform: translate(-50%, -50%) scale(0.95);
}

.ve-root.ve-glass-liquid .ve-pin:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
  box-shadow:
    0 0 0 2px rgba(14, 165, 233, 0.9),
    0 0 18px rgba(56, 189, 248, 0.65);
}

.ve-root.ve-glass-liquid .ve-pin.ve-dragging,
.ve-root.ve-glass-liquid .ve-pin.ve-dragging:hover,
.ve-root.ve-glass-liquid .ve-pin.ve-dragging:active,
.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi.ve-dragging,
.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi.ve-dragging:hover,
.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi.ve-dragging:active {
  cursor: grabbing;
  z-index: var(--ve-z-tooltip);
  transition: box-shadow 0.14s ease;
  transform:
    translate(-50%, -50%)
    scale(calc(1.08 * var(--ve-drag-sx, 1)), calc(1.08 * var(--ve-drag-sy, 1)))
    rotate(var(--ve-drag-rot, 0deg));
  box-shadow:
    0 10px 24px -4px rgba(2, 132, 199, 0.48),
    0 4px 10px rgba(15, 23, 42, 0.28);
}

.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi.ve-dragging,
.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi.ve-dragging:hover,
.ve-root.ve-glass-liquid .ve-pin.ve-pin-multi.ve-dragging:active {
  box-shadow:
    0 10px 24px -4px rgba(79, 70, 229, 0.5),
    0 4px 10px rgba(15, 23, 42, 0.3);
}

.ve-root.ve-glass-liquid .ve-pin.ve-snapping {
  z-index: var(--ve-z-tooltip);
  transition:
    translate 0.34s cubic-bezier(0.22, 1.18, 0.36, 1),
    transform 0.28s var(--ve-ease-liquid),
    box-shadow 0.22s ease;
}

.ve-root.ve-glass-liquid .ve-pin-link-badge {
  z-index: 4;
  background: linear-gradient(
    180deg,
    rgba(56, 189, 248, 0.88) 0%,
    rgba(2, 132, 199, 0.94) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.55),
    0 2px 6px rgba(15, 23, 42, 0.35);
}

.ve-root.ve-glass-liquid .ve-pin-tooltip.ve-pin-tooltip-above {
  inset-block-end: 34px;
}

.ve-root.ve-glass-liquid .ve-pin-tooltip.ve-pin-tooltip-below {
  inset-block-start: 34px;
}

/* Voice Target Pins & Tooltip — Translucent Liquid Ruby Capsules */
.ve-root.ve-glass-liquid .ve-voice-pin {
  position: absolute;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px 3px 7px;
  border-radius: 9999px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  background: transparent;
  box-shadow:
    0 0 0 0.5px rgba(127, 29, 29, 0.35),
    inset 0 1px 1.5px rgba(255, 255, 255, 0.55),
    0 4px 14px rgba(220, 38, 38, 0.36);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: transform 0.18s var(--ve-ease-liquid), box-shadow 0.18s ease;
}

.ve-root.ve-glass-liquid .ve-voice-pin.ve-hovered {
  transform: scale(1.04);
  box-shadow:
    0 0 0 0.5px rgba(127, 29, 29, 0.4),
    inset 0 1.5px 2px rgba(255, 255, 255, 0.72),
    0 6px 18px rgba(220, 38, 38, 0.48);
}

.ve-root.ve-glass-liquid .ve-voice-pin:active {
  transform: scale(0.97);
}

.ve-root.ve-glass-liquid .ve-voice-pin:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
  box-shadow:
    0 0 0 2px rgba(239, 68, 68, 0.9),
    0 0 18px rgba(248, 113, 113, 0.65);
}

.ve-root.ve-glass-liquid .ve-voice-pin.ve-dragging,
.ve-root.ve-glass-liquid .ve-voice-pin.ve-dragging:hover,
.ve-root.ve-glass-liquid .ve-voice-pin.ve-dragging:active,
.ve-root.ve-glass-liquid .ve-voice-pin.ve-hovered.ve-dragging {
  cursor: grabbing;
  z-index: var(--ve-z-tooltip);
  transition: box-shadow 0.14s ease;
  transform:
    scale(calc(1.05 * var(--ve-drag-sx, 1)), calc(1.05 * var(--ve-drag-sy, 1)))
    rotate(var(--ve-drag-rot, 0deg));
  box-shadow:
    0 0 0 0.5px rgba(127, 29, 29, 0.42),
    inset 0 1.5px 2px rgba(255, 255, 255, 0.72),
    0 10px 24px rgba(220, 38, 38, 0.5);
}

.ve-root.ve-glass-liquid .ve-voice-pin.ve-snapping {
  z-index: var(--ve-z-tooltip);
  transition:
    translate 0.34s cubic-bezier(0.22, 1.18, 0.36, 1),
    transform 0.28s var(--ve-ease-liquid),
    box-shadow 0.22s ease;
}

.ve-root.ve-glass-liquid .ve-voice-pin > .ve-glass-surface {
  background: linear-gradient(
    180deg,
    rgba(248, 113, 113, 0.46) 0%,
    rgba(185, 28, 28, 0.64) 100%
  );
  backdrop-filter: blur(2.5px) saturate(190%);
  -webkit-backdrop-filter: blur(2.5px) saturate(190%);
}

.ve-root.ve-glass-liquid .ve-voice-pin-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-6px);
  border-radius: 10px;
  padding: 4px 9px;
  color: #f8fafc;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}

.ve-root.ve-glass-liquid .ve-voice-pin-tooltip > .ve-glass-surface {
  background: var(--ve-glass-bg);
  backdrop-filter: blur(5px) saturate(190%);
  -webkit-backdrop-filter: blur(5px) saturate(190%);
}

/* Verification Halo Badge — Translucent Emerald Liquid Pill */
.ve-root.ve-glass-liquid .ve-verification-halo-badge {
  background: linear-gradient(
    180deg,
    rgba(16, 185, 129, 0.58) 0%,
    rgba(5, 150, 105, 0.72) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.36);
  backdrop-filter: blur(4px) saturate(180%);
  -webkit-backdrop-filter: blur(4px) saturate(180%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.55),
    0 4px 12px rgba(5, 150, 105, 0.36);
}

`;
