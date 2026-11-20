// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { ElementVariantSet } from '@visual-edit/core';
import { OverlayStateManager } from '../inspector/state.js';
import {
  VariantSwitcher,
  formatVariantOptionLabel,
  computeVariantSwitcherPosition,
} from '../inspector/variant-switcher.js';
import { OVERLAY_STYLES } from '../inspector/styles.css.js';

function mockRect(
  el: Element,
  rect: { left: number; top: number; width: number; height: number }
): void {
  const full = {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  } as DOMRect;
  el.getBoundingClientRect = () => full;
}

describe('VariantSwitcher overflow handling & helpers', () => {
  let state: OverlayStateManager;
  let mountEl: HTMLDivElement | null = null;
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    storageMap.clear();
    const mockStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, String(val)),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
      get length() {
        return storageMap.size;
      },
      key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
    };

    Object.defineProperty(window, 'localStorage', { value: mockStorage, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

    document.body.innerHTML = '';
    (globalThis as any).WebSocket = class {
      public readyState = 1;
      public send = vi.fn();
      public close = vi.fn();
      public onmessage = null;
      public onclose = null;
    };
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

    OverlayStateManager.resetInstance();
    state = OverlayStateManager.getInstance();
  });

  afterEach(async () => {
    if (mountEl) {
      const container = mountEl;
      await act(() => {
        render(null, container);
      });
      container.remove();
      mountEl = null;
    }
    document.body.innerHTML = '';
    storageMap.clear();
    OverlayStateManager.resetInstance();
    delete (globalThis as any).WebSocket;
    vi.restoreAllMocks();
  });

  describe('formatVariantOptionLabel', () => {
    it('numbers clean names and strips redundant Option/numeric prefixes', () => {
      expect(formatVariantOptionLabel('Glassmorphic', 0)).toBe('1. Glassmorphic');
      expect(formatVariantOptionLabel('Option A: Glassmorphic Surface', 0)).toBe(
        '1. Glassmorphic Surface'
      );
      expect(formatVariantOptionLabel('Option 2 - Compact Card', 1)).toBe('2. Compact Card');
      expect(formatVariantOptionLabel('Option 1. Bold Border', 0)).toBe('1. Bold Border');
      expect(formatVariantOptionLabel('1. Floating Pill', 0)).toBe('1. Floating Pill');
      expect(formatVariantOptionLabel('2) Clean Hairline', 1)).toBe('2. Clean Hairline');
      expect(formatVariantOptionLabel('3: Subtle Tint', 2)).toBe('3. Subtle Tint');
      expect(formatVariantOptionLabel('4 - Soft Shadow', 3)).toBe('4. Soft Shadow');
    });

    it('preserves compound numeric names, standalone Option labels, and falls back when empty', () => {
      expect(formatVariantOptionLabel('3-Column Grid', 0)).toBe('1. 3-Column Grid');
      expect(formatVariantOptionLabel('2-Line Header', 1)).toBe('2. 2-Line Header');
      expect(formatVariantOptionLabel('Option A', 0)).toBe('1. Option A');
      expect(formatVariantOptionLabel('', 0)).toBe('1. Option 1');
      expect(formatVariantOptionLabel('   ', 2)).toBe('3. Option 3');
    });
  });

  describe('computeVariantSwitcherPosition', () => {
    it('places card above the target when vertical space above is sufficient', () => {
      const pos = computeVariantSwitcherPosition({
        rect: { left: 100, top: 260, bottom: 320, width: 200, height: 60 },
        barWidth: 470,
        barHeight: 140,
        viewportWidth: 1200,
        viewportHeight: 800,
      });
      expect(pos).toEqual({ left: 100, top: 108, placement: 'above' });
    });

    it('flips below the target when a tall wrapped card would overflow the top of the viewport', () => {
      const pos = computeVariantSwitcherPosition({
        rect: { left: 80, top: 160, bottom: 210, width: 200, height: 50 },
        barWidth: 470,
        barHeight: 180,
        viewportWidth: 1200,
        viewportHeight: 800,
      });
      expect(pos).toEqual({ left: 80, top: 222, placement: 'below' });
    });

    it('clamps card cleanly inside viewport when target fills viewport height and narrows viewport width', () => {
      const pos = computeVariantSwitcherPosition({
        rect: { left: 320, top: 10, bottom: 780, width: 200, height: 770 },
        barWidth: 368,
        barHeight: 180,
        viewportWidth: 400,
        viewportHeight: 800,
      });
      expect(pos.placement).toBe('clamped');
      expect(pos.left).toBe(16);
      expect(pos.top).toBeGreaterThanOrEqual(16);
      expect(pos.top + 180).toBeLessThanOrEqual(800 - 16);
    });
  });

  describe('VariantSwitcher DOM rendering & styles', () => {
    it('renders all long option pills with wrapped labels, clean prefixes, full tooltips, and decision controls', async () => {
      const targetBtn = document.createElement('button');
      targetBtn.id = 'hero-cta';
      targetBtn.textContent = 'Get Started';
      mockRect(targetBtn, { left: 120, top: 300, width: 160, height: 44 });
      document.body.appendChild(targetBtn);

      const variantSet: ElementVariantSet = {
        id: 'vset_long_opts',
        targetSelector: '#hero-cta',
        label: 'Hero Primary Call-to-Action Treatment Exploration with Very Long Title',
        createdAt: Date.now(),
        status: 'pending',
        variants: [
          {
            id: 'v1',
            name: 'Option A: High-Contrast Pill with Soft Outer Neon Glow and Gradient Edge',
            rationale: 'Increases primary CTA contrast against dark hero background',
            styles: { borderRadius: '9999px' },
          },
          {
            id: 'v2',
            name: 'Option B - Ultra-Minimal Hairline Ghost Button Treatment',
            rationale: 'Reduces visual weight beside product screenshot',
            styles: { border: '1px solid #fff' },
          },
          {
            id: 'v3',
            name: '3. Frosted Glassmorphic Surface with Backdrop Blur',
            rationale: 'Matches floating overlay cards',
            styles: { opacity: '0.9' },
          },
          {
            id: 'v4',
            name: '4) 3-Column Editorial Action Bar Layout',
            rationale: 'Pairs secondary quick links inline',
            styles: { padding: '12px 24px' },
          },
        ],
      };

      state.variantSets = [variantSet];
      mountEl = document.createElement('div');
      document.body.appendChild(mountEl);

      await act(() => {
        render(h(VariantSwitcher, {}), mountEl!);
      });

      const bar = mountEl.querySelector('.ve-variant-switcher-bar') as HTMLElement | null;
      expect(bar).not.toBeNull();
      expect(bar?.style.transform).toBe('');

      const titleEl = mountEl.querySelector('.ve-variant-title') as HTMLElement | null;
      expect(titleEl?.getAttribute('title')).toBe(variantSet.label);

      const buttons = Array.from(
        mountEl.querySelectorAll('.ve-variant-options-row .ve-variant-option-btn')
      ) as HTMLButtonElement[];
      expect(buttons.length).toBe(5);

      const labels = buttons.map(
        (btn) => btn.querySelector('.ve-variant-option-label')?.textContent
      );
      expect(labels).toEqual([
        'Original',
        '1. High-Contrast Pill with Soft Outer Neon Glow and Gradient Edge',
        '2. Ultra-Minimal Hairline Ghost Button Treatment',
        '3. Frosted Glassmorphic Surface with Backdrop Blur',
        '4. 3-Column Editorial Action Bar Layout',
      ]);

      expect(buttons[1].getAttribute('title')).toBe(
        '1. High-Contrast Pill with Soft Outer Neon Glow and Gradient Edge — Increases primary CTA contrast against dark hero background'
      );

      // Click second variant to preview, then Pick & Apply to decide
      await act(() => {
        buttons[2].click();
      });
      expect(state.activeVariantPreview.get('vset_long_opts')).toBe('v2');

      const applyBtn = mountEl.querySelector('.ve-variant-apply-btn') as HTMLButtonElement | null;
      expect(applyBtn).not.toBeNull();

      await act(() => {
        applyBtn!.click();
      });
      expect(variantSet.status).toBe('decided');

      const decidedName = mountEl.querySelector('.ve-variant-decided-name') as HTMLElement | null;
      expect(decidedName?.textContent).toBe(
        'Option B - Ultra-Minimal Hairline Ghost Button Treatment'
      );
      expect(decidedName?.getAttribute('title')).toBe(
        'Option B - Ultra-Minimal Hairline Ghost Button Treatment'
      );

      const closeBtn = mountEl.querySelector('.ve-variant-close-btn') as HTMLButtonElement | null;
      expect(closeBtn).not.toBeNull();
      await act(() => {
        closeBtn!.click();
      });
      expect(variantSet.status).toBe('superseded');
    });

    it('includes multi-line wrap, line-clamp, and flex shrink safeguards in OVERLAY_STYLES', () => {
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-options-row\s*\{[^}]*flex-wrap:\s*wrap/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-options-row\s*\{[^}]*overflow-y:\s*auto/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-option-btn\s*\{[^}]*white-space:\s*normal/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-option-btn\s*\{[^}]*overflow-wrap:\s*anywhere/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-option-btn\s*\{[^}]*min-width:\s*0/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-option-btn\s*\{[^}]*max-width:\s*100%/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-option-label\s*\{[^}]*-webkit-line-clamp:\s*2/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-drag-handle\s*\{[^}]*min-width:\s*0/);
      expect(OVERLAY_STYLES).toMatch(/\.ve-variant-title\s*\{[^}]*text-overflow:\s*ellipsis/);
    });
  });
});
