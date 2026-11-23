// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { ElementVariantSet } from '@visual-edit/core';
import { SelectionBox } from '../inspector/selection-box.js';
import { VerificationHalo } from '../inspector/verification-halo.js';
import { VariantSwitcher } from '../inspector/variant-switcher.js';
import { locateElementRect } from '../inspector/pin-position.js';
import { OverlayStateManager } from '../inspector/state.js';
import { BASE_CSS } from '../inspector/styles/base.css.js';
import { DRAWER_CSS } from '../inspector/styles/drawer.css.js';

const flushAnimationFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setTimeout(resolve, 10));
    } else {
      setTimeout(resolve, 25);
    }
  });

describe('Scroll-Locked SelectionBox, VerificationHalo & VariantSwitcher Bounds', () => {
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
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

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
    storageMap.clear();
    OverlayStateManager.resetInstance();
    delete (globalThis as any).WebSocket;
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('locateElementRect distinguishes document-flow, fixed, sticky, and nested scroll-container targets', () => {
    const flowEl = document.createElement('div');
    flowEl.getBoundingClientRect = () =>
      ({ left: 40, top: 100, width: 200, height: 50, right: 240, bottom: 150, x: 40, y: 100, toJSON: () => {} } as DOMRect);
    document.body.appendChild(flowEl);

    const flowPos = locateElementRect(flowEl, { left: -20, top: -300 });
    expect(flowPos).toEqual({
      fixed: false,
      dynamicScroll: false,
      rect: { left: 60, top: 400, width: 200, height: 50 },
      viewportRect: { left: 40, top: 100, width: 200, height: 50 },
    });

    const fixedAncestor = document.createElement('div');
    fixedAncestor.style.position = 'fixed';
    const fixedChild = document.createElement('button');
    fixedChild.getBoundingClientRect = () =>
      ({ left: 16, top: 12, width: 100, height: 32, right: 116, bottom: 44, x: 16, y: 12, toJSON: () => {} } as DOMRect);
    fixedAncestor.appendChild(fixedChild);
    document.body.appendChild(fixedAncestor);

    const fixedPos = locateElementRect(fixedChild, { left: -20, top: -300 });
    expect(fixedPos.fixed).toBe(true);
    expect(fixedPos.dynamicScroll).toBe(false);
    expect(fixedPos.rect).toEqual({ left: 16, top: 12, width: 100, height: 32 });

    const stickyEl = document.createElement('header');
    stickyEl.style.position = 'sticky';
    stickyEl.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 56, right: 800, bottom: 56, x: 0, y: 0, toJSON: () => {} } as DOMRect);
    document.body.appendChild(stickyEl);

    const stickyPos = locateElementRect(stickyEl, { left: 0, top: -200 });
    expect(stickyPos.fixed).toBe(false);
    expect(stickyPos.dynamicScroll).toBe(true);

    const scrollBox = document.createElement('div');
    scrollBox.style.overflowY = 'auto';
    Object.defineProperty(scrollBox, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(scrollBox, 'clientHeight', { value: 200, configurable: true });
    const nestedChild = document.createElement('p');
    nestedChild.getBoundingClientRect = () =>
      ({ left: 25, top: 90, width: 140, height: 24, right: 165, bottom: 114, x: 25, y: 90, toJSON: () => {} } as DOMRect);
    scrollBox.appendChild(nestedChild);
    document.body.appendChild(scrollBox);

    const nestedPos = locateElementRect(nestedChild, { left: 0, top: -200 });
    expect(nestedPos.fixed).toBe(false);
    expect(nestedPos.dynamicScroll).toBe(true);
  });

  it('SelectionBox uses absolute document space without transition inertia, skips document-scroll re-renders, and syncs nested scroll', async () => {
    expect(BASE_CSS).toContain('.ve-selection-layer {');
    const hlRule = BASE_CSS.match(/\.ve-highlight-box\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(hlRule).toContain('position: absolute;');
    expect(hlRule).not.toContain('transition: all');

    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });

    const target = document.createElement('div');
    target.id = 'sel-flow-target';
    const rectSpy = vi.fn(
      () => ({ left: 40, top: 100, width: 200, height: 50, right: 240, bottom: 150, x: 40, y: 100, toJSON: () => {} } as DOMRect)
    );
    target.getBoundingClientRect = rectSpy;
    document.body.appendChild(target);

    state.setTool('edit');
    state.setActiveElement(target);

    mountEl = document.createElement('div');
    document.body.appendChild(mountEl);

    await act(async () => {
      render(h(SelectionBox, {}), mountEl!);
      await flushAnimationFrame();
    });

    const layer = mountEl.querySelector('.ve-selection-layer');
    expect(layer).not.toBeNull();
    const box = mountEl.querySelector('.ve-highlight-box') as HTMLElement | null;
    expect(box).not.toBeNull();
    expect(box!.style.position).toBe('');
    expect(box!.style.left).toBe('40px');
    expect(box!.style.top).toBe('400px');

    // Document scroll must not re-measure document-flow highlight box
    rectSpy.mockClear();
    document.dispatchEvent(new Event('scroll'));
    await flushAnimationFrame();
    expect(rectSpy).not.toHaveBeenCalled();

    // Nested scroll container child MUST sync on container scroll
    const scrollBox = document.createElement('div');
    scrollBox.style.overflowY = 'auto';
    Object.defineProperty(scrollBox, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scrollBox, 'clientHeight', { value: 150, configurable: true });
    const nestedTarget = document.createElement('p');
    const nestedSpy = vi.fn(
      () => ({ left: 20, top: 16, width: 120, height: 24, right: 140, bottom: 40, x: 20, y: 16, toJSON: () => {} } as DOMRect)
    );
    nestedTarget.getBoundingClientRect = nestedSpy;
    scrollBox.appendChild(nestedTarget);
    document.body.appendChild(scrollBox);

    await act(async () => {
      state.setActiveElement(nestedTarget);
      await flushAnimationFrame();
    });

    const nestedBox = mountEl.querySelector('.ve-highlight-box') as HTMLElement;
    expect(nestedBox.querySelector('.ve-badge--inside')).not.toBeNull();
    nestedSpy.mockClear();

    scrollBox.dispatchEvent(new Event('scroll'));
    await flushAnimationFrame();
    expect(nestedSpy).toHaveBeenCalled();

    // Fixed target uses inline position: fixed and viewport coords
    const fixedEl = document.createElement('button');
    fixedEl.style.position = 'fixed';
    fixedEl.getBoundingClientRect = () =>
      ({ left: 10, top: 14, width: 90, height: 32, right: 100, bottom: 46, x: 10, y: 14, toJSON: () => {} } as DOMRect);
    document.body.appendChild(fixedEl);

    await act(async () => {
      state.setActiveElement(fixedEl);
      await flushAnimationFrame();
    });

    const fixedBox = mountEl.querySelector('.ve-highlight-box') as HTMLElement;
    expect(fixedBox.style.position).toBe('fixed');
    expect(fixedBox.style.left).toBe('10px');
    expect(fixedBox.style.top).toBe('14px');
  });

  it('VerificationHalo renders in document space with bounds fallback and skips root scroll re-renders', async () => {
    expect(DRAWER_CSS).toMatch(/\.ve-verification-halo-layer\s*\{[^}]*position:\s*absolute;/);
    const haloRule = DRAWER_CSS.match(/\.ve-verification-halo-box\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(haloRule).toContain('position: absolute;');
    expect(haloRule).not.toContain('transition: all');

    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });

    const liveTarget = document.createElement('section');
    liveTarget.id = 'verified-card';
    const rectSpy = vi.fn(
      () => ({ left: 50, top: 120, width: 240, height: 80, right: 290, bottom: 200, x: 50, y: 120, toJSON: () => {} } as DOMRect)
    );
    liveTarget.getBoundingClientRect = rectSpy;
    document.body.appendChild(liveTarget);

    state.verificationTargets = [
      { selector: '#verified-card', label: 'Updated Card', timestamp: Date.now() },
      {
        selector: '#missing-fallback',
        bounds: { x: 80, y: 500, width: 120, height: 36 },
        variant: 'fetched',
        timestamp: Date.now(),
      },
    ];

    mountEl = document.createElement('div');
    document.body.appendChild(mountEl);

    await act(async () => {
      render(h(VerificationHalo, {}), mountEl!);
      await flushAnimationFrame();
    });

    const boxes = Array.from(mountEl.querySelectorAll('.ve-verification-halo-box')) as HTMLElement[];
    expect(boxes.length).toBe(2);

    // Live target: (50, 120 - (-200) = 320), expanded by -4px / +8px
    expect(boxes[0].style.position).toBe('');
    expect(boxes[0].style.left).toBe('46px');
    expect(boxes[0].style.top).toBe('316px');
    expect(boxes[0].style.width).toBe('248px');
    expect(boxes[0].style.height).toBe('88px');

    // Missing selector fallback: document bounds (80, 500) expanded by -4px / +8px
    expect(boxes[1].style.left).toBe('76px');
    expect(boxes[1].style.top).toBe('496px');
    expect(boxes[1].style.width).toBe('128px');
    expect(boxes[1].style.height).toBe('44px');

    rectSpy.mockClear();
    document.dispatchEvent(new Event('scroll'));
    await flushAnimationFrame();
    expect(rectSpy).not.toHaveBeenCalled();
  });

  it('VariantSwitcher anchors .ve-variant-bounds in document space for flow targets and fixed for fixed targets', async () => {
    expect(DRAWER_CSS).toMatch(/\.ve-variant-switcher-layer\s*\{[^}]*position:\s*absolute;/);
    expect(DRAWER_CSS).toMatch(/\.ve-variant-bounds\s*\{[^}]*position:\s*absolute;/);

    Object.defineProperty(window, 'scrollY', { value: 250, configurable: true });

    const flowTarget = document.createElement('button');
    flowTarget.id = 'var-flow-btn';
    flowTarget.getBoundingClientRect = () =>
      ({ left: 100, top: 100, width: 160, height: 40, right: 260, bottom: 140, x: 100, y: 100, toJSON: () => {} } as DOMRect);
    document.body.appendChild(flowTarget);

    const vset: ElementVariantSet = {
      id: 'vset_scroll_lock',
      targetSelector: '#var-flow-btn',
      label: 'Hero Button',
      createdAt: Date.now(),
      status: 'pending',
      variants: [{ id: 'v1', name: 'Soft Pill', rationale: 'Cleaner', styles: {} }],
    };

    state.variantSets = [vset];
    mountEl = document.createElement('div');
    document.body.appendChild(mountEl);

    await act(async () => {
      render(h(VariantSwitcher, {}), mountEl!);
      await flushAnimationFrame();
    });

    const bounds = mountEl.querySelector('.ve-variant-bounds') as HTMLElement | null;
    expect(bounds).not.toBeNull();
    // top = (100 - (-250)) - 6 = 344px
    expect(bounds!.style.position).toBe('');
    expect(bounds!.style.left).toBe('94px');
    expect(bounds!.style.top).toBe('344px');
    expect(bounds!.style.width).toBe('172px');
    expect(bounds!.style.height).toBe('52px');

    // Now make target fixed
    flowTarget.style.position = 'fixed';
    await act(async () => {
      state.notify({ skipSync: true });
      await flushAnimationFrame();
    });

    const fixedBounds = mountEl.querySelector('.ve-variant-bounds') as HTMLElement;
    expect(fixedBounds.style.position).toBe('fixed');
    expect(fixedBounds.style.left).toBe('94px');
    expect(fixedBounds.style.top).toBe('94px');
  });
});
