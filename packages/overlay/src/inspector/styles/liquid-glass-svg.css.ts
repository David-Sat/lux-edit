export const LIQUID_GLASS_SVG_CSS = `
/* Tier 1 Chromium Real Optical SVG Refraction on Hero Chrome (Clear Crystal) */
.ve-root.ve-glass-svg.ve-glass-clear .ve-launcher-btn > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-launcher);
  -webkit-backdrop-filter: url(#lux-glass-launcher);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.14) 0%,
      rgba(255, 255, 255, 0.01) 48%,
      rgba(255, 255, 255, 0.06) 100%
    ),
    linear-gradient(
      180deg,
      rgba(54, 62, 76, calc(0.14 + var(--ve-lg-tint, 0.35) * 0.68)) 0%,
      rgba(38, 45, 58, calc(0.2 + var(--ve-lg-tint, 0.35) * 0.72)) 100%
    );
}

.ve-root.ve-glass-svg.ve-glass-clear .ve-dock-menu > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-dock);
  -webkit-backdrop-filter: url(#lux-glass-dock);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.14) 0%,
      rgba(255, 255, 255, 0.01) 48%,
      rgba(255, 255, 255, 0.06) 100%
    ),
    linear-gradient(
      180deg,
      rgba(54, 62, 76, calc(0.14 + var(--ve-lg-tint, 0.35) * 0.68)) 0%,
      rgba(38, 45, 58, calc(0.2 + var(--ve-lg-tint, 0.35) * 0.72)) 100%
    );
}

/* Tier 1 Chromium Real Optical SVG Refraction on Hero Chrome (Dark Obsidian) */
.ve-root.ve-glass-svg.ve-glass-obsidian .ve-launcher-btn > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-launcher);
  -webkit-backdrop-filter: url(#lux-glass-launcher);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0.01) 48%,
      rgba(255, 255, 255, 0.05) 100%
    ),
    linear-gradient(
      180deg,
      rgba(14, 20, 34, calc(0.16 + var(--ve-lg-tint, 0.56) * 0.76)) 0%,
      rgba(8, 12, 22, calc(0.24 + var(--ve-lg-tint, 0.56) * 0.8)) 100%
    );
}

.ve-root.ve-glass-svg.ve-glass-obsidian .ve-dock-menu > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-dock);
  -webkit-backdrop-filter: url(#lux-glass-dock);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0.01) 48%,
      rgba(255, 255, 255, 0.05) 100%
    ),
    linear-gradient(
      180deg,
      rgba(14, 20, 34, calc(0.16 + var(--ve-lg-tint, 0.56) * 0.76)) 0%,
      rgba(8, 12, 22, calc(0.24 + var(--ve-lg-tint, 0.56) * 0.8)) 100%
    );
}

.ve-root.ve-glass-svg .ve-voice-recording-dock > .ve-glass-surface {
  background:
    linear-gradient(
      180deg,
      rgba(245, 158, 11, 0.14) 0%,
      rgba(36, 40, 54, calc(0.26 + var(--ve-lg-tint, 0.35) * 0.65)) 100%
    );
}

.ve-root.ve-glass-svg .ve-voice-recording-dock.is-ready > .ve-glass-surface {
  background:
    linear-gradient(
      180deg,
      rgba(239, 68, 68, 0.15) 0%,
      rgba(36, 40, 54, calc(0.26 + var(--ve-lg-tint, 0.35) * 0.65)) 100%
    );
}

/* High-Refraction Active Option Lens Bubbles & Pin Droplets */
.ve-root.ve-glass-svg .ve-dock-focus-pill {
  backdrop-filter: url(#lux-glass-focus);
  -webkit-backdrop-filter: url(#lux-glass-focus);
  background: radial-gradient(
    circle at 30% 22%,
    rgba(255, 255, 255, 0.24) 0%,
    rgba(255, 255, 255, 0.03) 54%,
    rgba(255, 255, 255, 0.14) 100%
  );
}

.ve-root.ve-glass-svg .ve-dock-item.ve-active {
  backdrop-filter: url(#lux-glass-bubble);
  -webkit-backdrop-filter: url(#lux-glass-bubble);
  background: radial-gradient(
    circle at 32% 24%,
    rgba(255, 255, 255, 0.28) 0%,
    rgba(255, 255, 255, 0.06) 56%,
    rgba(255, 255, 255, 0.14) 100%
  );
}

/* Focus target button yields optical lens to the sliding .ve-dock-focus-pill underneath */
.ve-root.ve-glass-liquid .ve-dock-item.ve-focus-target,
.ve-root.ve-glass-liquid .ve-dock-item.ve-focus-target:hover,
.ve-root.ve-glass-svg .ve-dock-item.ve-focus-target,
.ve-root.ve-glass-svg .ve-dock-item.ve-focus-target:hover {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  animation: none;
  transform: scale(1.02);
}

.ve-root.ve-glass-liquid .ve-dock-item.ve-focus-target:active {
  transform: scale(0.97);
}

.ve-root.ve-glass-svg .ve-mode-pill.ve-active {
  backdrop-filter: url(#lux-glass-pill-active);
  -webkit-backdrop-filter: url(#lux-glass-pill-active);
  background: linear-gradient(
    180deg,
    rgba(52, 211, 153, 0.32) 0%,
    rgba(16, 185, 129, 0.18) 100%
  );
}

.ve-root.ve-glass-svg .ve-tab-indicator {
  backdrop-filter: url(#lux-glass-tab-pill);
  -webkit-backdrop-filter: url(#lux-glass-tab-pill);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.24) 0%,
    rgba(255, 255, 255, 0.08) 100%
  );
}

.ve-root.ve-glass-svg .ve-pin > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-pin);
  -webkit-backdrop-filter: url(#lux-glass-pin);
}

.ve-root.ve-glass-svg .ve-voice-pin > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-voice-pin);
  -webkit-backdrop-filter: url(#lux-glass-voice-pin);
}

/* Full-System Panel Optical SVG Refraction (Drawer, Toolbar, Comment Composer, Variant Switcher, Pin Tooltips) */
.ve-root.ve-glass-svg.ve-glass-refract-panels .ve-drawer > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-drawer);
  -webkit-backdrop-filter: url(#lux-glass-drawer);
}

.ve-root.ve-glass-svg.ve-glass-refract-panels .ve-toolbar > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-toolbar);
  -webkit-backdrop-filter: url(#lux-glass-toolbar);
}

.ve-root.ve-glass-svg.ve-glass-refract-panels .ve-comment-popover > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-composer);
  -webkit-backdrop-filter: url(#lux-glass-composer);
}

.ve-root.ve-glass-svg.ve-glass-refract-panels .ve-variant-switcher-bar > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-switcher);
  -webkit-backdrop-filter: url(#lux-glass-switcher);
}

.ve-root.ve-glass-svg.ve-glass-refract-panels .ve-pin-tooltip > .ve-glass-surface,
.ve-root.ve-glass-svg.ve-glass-refract-panels .ve-voice-pin-tooltip > .ve-glass-surface {
  backdrop-filter: url(#lux-glass-tooltip);
  -webkit-backdrop-filter: url(#lux-glass-tooltip);
}

.ve-root.ve-glass-svg.ve-glass-refract-panels.ve-glass-clear .ve-drawer > .ve-glass-surface,
.ve-root.ve-glass-svg.ve-glass-refract-panels.ve-glass-clear .ve-toolbar > .ve-glass-surface,
.ve-root.ve-glass-svg.ve-glass-refract-panels.ve-glass-clear .ve-comment-popover > .ve-glass-surface,
.ve-root.ve-glass-svg.ve-glass-refract-panels.ve-glass-clear .ve-variant-switcher-bar > .ve-glass-surface,
.ve-root.ve-glass-svg.ve-glass-refract-panels.ve-glass-clear .ve-pin-tooltip > .ve-glass-surface,
.ve-root.ve-glass-svg.ve-glass-refract-panels.ve-glass-clear .ve-voice-pin-tooltip > .ve-glass-surface {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.14) 0%,
      rgba(255, 255, 255, 0.02) 38%,
      rgba(255, 255, 255, 0.06) 100%
    ),
    linear-gradient(
      180deg,
      rgba(44, 52, 66, calc(0.28 + var(--ve-lg-tint, 0.35) * 0.68)) 0%,
      rgba(28, 34, 46, calc(0.36 + var(--ve-lg-tint, 0.35) * 0.72)) 100%
    );
}

@media (prefers-reduced-motion: reduce) {
  .ve-root.ve-glass-liquid .ve-launcher-btn,
  .ve-root.ve-glass-liquid .ve-dock-menu,
  .ve-root.ve-glass-liquid .ve-voice-recording-dock,
  .ve-root.ve-glass-liquid .ve-drawer,
  .ve-root.ve-glass-liquid .ve-comment-popover,
  .ve-root.ve-glass-liquid .ve-toolbar,
  .ve-root.ve-glass-liquid .ve-variant-switcher-bar,
  .ve-root.ve-glass-liquid .ve-pin,
  .ve-root.ve-glass-liquid .ve-pin.ve-dragging,
  .ve-root.ve-glass-liquid .ve-pin.ve-snapping,
  .ve-root.ve-glass-liquid .ve-voice-pin,
  .ve-root.ve-glass-liquid .ve-voice-pin.ve-dragging,
  .ve-root.ve-glass-liquid .ve-voice-pin.ve-snapping,
  .ve-root.ve-glass-liquid .ve-pin-tooltip,
  .ve-root.ve-glass-liquid .ve-voice-pin-tooltip,
  .ve-root.ve-glass-liquid .ve-dock-item,
  .ve-root.ve-glass-liquid .ve-dock-item.ve-active,
  .ve-root.ve-glass-liquid .ve-dock-focus-pill,
  .ve-root.ve-glass-liquid .ve-dock-focus-pill.is-gliding,
  .ve-root.ve-glass-liquid .ve-tab-indicator,
  .ve-root.ve-glass-liquid .ve-tab-indicator.is-gliding,
  .ve-root.ve-glass-liquid .ve-glass-surface::after {
    animation: none !important;
    transition: none !important;
  }

  .ve-root.ve-glass-liquid .ve-launcher-btn.ve-dragging,
  .ve-root.ve-glass-liquid .ve-dock-menu.ve-dragging,
  .ve-root.ve-glass-liquid .ve-pin.ve-dragging,
  .ve-root.ve-glass-liquid .ve-voice-pin.ve-dragging {
    --ve-drag-sx: 1;
    --ve-drag-sy: 1;
    --ve-drag-rot: 0deg;
  }

  .ve-root.ve-glass-liquid [data-ve-pulse='true']::after {
    animation: none !important;
    opacity: 0 !important;
  }
}
`;
