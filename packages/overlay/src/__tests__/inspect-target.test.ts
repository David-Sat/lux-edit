// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { OverlayRoot } from '../overlay-root.js';
import { OverlayStateManager } from '../inspector/state.js';
import {
  INSPECT_DISABLED_STYLE_ATTR,
  isDisabledElement,
  resolveInspectTarget,
} from '../inspector/inspect-target.js';

function mockRect(el: Element, rect: { left: number; top: number; width: number; height: number }): void {
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

describe('inspect-target & deactivated element inspection', () => {
  let state: OverlayStateManager;
  let hostEl: HTMLElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let originalElementFromPoint: typeof document.elementFromPoint | undefined;
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

    document.head.innerHTML = '';
    document.body.innerHTML = '';
    originalElementFromPoint = document.elementFromPoint;

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
    if (shadowRoot) {
      const currentShadowRoot = shadowRoot;
      await act(() => {
        render(null, currentShadowRoot);
      });
      shadowRoot = null;
    }
    if (hostEl) {
      hostEl.remove();
      hostEl = null;
    }
    if (originalElementFromPoint) {
      document.elementFromPoint = originalElementFromPoint;
    }
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    storageMap.clear();
    OverlayStateManager.resetInstance();
    delete (globalThis as any).WebSocket;
    vi.restoreAllMocks();
  });

  const mountOverlay = async () => {
    hostEl = document.createElement('visual-edit-overlay');
    const sr = hostEl.attachShadow({ mode: 'open' });
    shadowRoot = sr;
    document.body.appendChild(hostEl);
    await act(() => {
      render(h(OverlayRoot, { shadowRoot: sr }), sr);
    });
    return sr;
  };

  it('injects inspect stylesheet only while an inspect tool is active and cleans up on exit or unmount', async () => {
    const sr = await mountOverlay();
    expect(document.querySelector(`style[${INSPECT_DISABLED_STYLE_ATTR}]`)).toBeNull();

    for (const tool of ['comment', 'edit', 'voice', 'screenshot'] as const) {
      await act(() => {
        state.setTool(tool);
      });
      const styleEl = document.querySelector(`style[${INSPECT_DISABLED_STYLE_ATTR}]`);
      expect(styleEl).not.toBeNull();
      expect(styleEl?.textContent).toContain('button:disabled');
      expect(styleEl?.textContent).toContain('[aria-disabled="true"]');

      await act(() => {
        state.setTool('none');
      });
      expect(document.querySelector(`style[${INSPECT_DISABLED_STYLE_ATTR}]`)).toBeNull();
    }

    await act(() => {
      state.setTool('comment');
    });
    expect(document.querySelector(`style[${INSPECT_DISABLED_STYLE_ATTR}]`)).not.toBeNull();

    await act(() => {
      render(null, sr);
    });
    shadowRoot = null;
    expect(document.querySelector(`style[${INSPECT_DISABLED_STYLE_ATTR}]`)).toBeNull();
  });

  it('selects native disabled buttons inside containers and directly under body in comment and edit modes without firing click handlers', async () => {
    await mountOverlay();

    const container = document.createElement('div');
    container.id = 'form-actions';
    mockRect(container, { left: 0, top: 0, width: 400, height: 200 });

    const nestedDisabledBtn = document.createElement('button');
    nestedDisabledBtn.id = 'submit-disabled';
    nestedDisabledBtn.disabled = true;
    nestedDisabledBtn.textContent = 'Save Changes';
    const nativeClickSpy = vi.fn();
    nestedDisabledBtn.addEventListener('click', nativeClickSpy);
    mockRect(nestedDisabledBtn, { left: 20, top: 20, width: 140, height: 40 });
    container.appendChild(nestedDisabledBtn);
    document.body.appendChild(container);

    const directDisabledBtn = document.createElement('button');
    directDisabledBtn.id = 'top-level-disabled';
    directDisabledBtn.disabled = true;
    directDisabledBtn.textContent = 'Top Disabled';
    mockRect(directDisabledBtn, { left: 20, top: 240, width: 140, height: 40 });
    document.body.appendChild(directDisabledBtn);

    await act(() => {
      state.setTool('comment');
    });

    // Hover over container at nested disabled button's coordinates
    container.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 35 }));
    expect(state.hoveredElement).toBe(nestedDisabledBtn);

    // Click lands on container (simulating pointer-events: none pass-through)
    container.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 50, clientY: 35 }));
    expect(state.commentTargetElement).toBe(nestedDisabledBtn);
    expect(nestedDisabledBtn.disabled).toBe(true);
    expect(nativeClickSpy).not.toHaveBeenCalled();

    // Direct child of body: click lands on document.body at directDisabledBtn's coordinates
    await act(() => {
      state.setTool('edit');
    });

    document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 255 }));
    expect(state.hoveredElement).toBe(directDisabledBtn);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 50, clientY: 255 }));
    expect(state.activeElement).toBe(directDisabledBtn);
    expect(directDisabledBtn.disabled).toBe(true);
  });

  it('targets controls inside disabled fieldsets, aria-disabled controls, and CSS-only pointer-events: none buttons', async () => {
    await mountOverlay();

    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    mockRect(fieldset, { left: 0, top: 0, width: 300, height: 100 });
    const fsBtn = document.createElement('button');
    fsBtn.id = 'fieldset-btn';
    fsBtn.textContent = 'Inside Fieldset';
    mockRect(fsBtn, { left: 10, top: 10, width: 120, height: 36 });
    fieldset.appendChild(fsBtn);
    document.body.appendChild(fieldset);

    const wrapper = document.createElement('div');
    wrapper.id = 'btn-wrapper';
    mockRect(wrapper, { left: 0, top: 120, width: 300, height: 120 });

    const ariaBtn = document.createElement('button');
    ariaBtn.id = 'aria-disabled-btn';
    ariaBtn.setAttribute('aria-disabled', 'true');
    ariaBtn.textContent = 'Aria Disabled';
    mockRect(ariaBtn, { left: 10, top: 130, width: 120, height: 36 });

    const cssBtn = document.createElement('button');
    cssBtn.id = 'css-disabled-btn';
    cssBtn.style.pointerEvents = 'none';
    cssBtn.textContent = 'CSS Pointer None';
    mockRect(cssBtn, { left: 10, top: 180, width: 120, height: 36 });

    wrapper.appendChild(ariaBtn);
    wrapper.appendChild(cssBtn);
    document.body.appendChild(wrapper);

    expect(isDisabledElement(fsBtn)).toBe(true);
    expect(isDisabledElement(ariaBtn)).toBe(true);
    expect(isDisabledElement(cssBtn)).toBe(false);

    await act(() => {
      state.setTool('comment');
    });

    fieldset.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 25 }));
    expect(state.commentTargetElement).toBe(fsBtn);

    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 145 }));
    expect(state.commentTargetElement).toBe(ariaBtn);

    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 195 }));
    expect(state.commentTargetElement).toBe(cssBtn);
  });

  it('respects occlusion from covering modals and restores inline styles cleanly', () => {
    const disabledBtn = document.createElement('button');
    disabledBtn.id = 'behind-modal-btn';
    disabledBtn.disabled = true;
    disabledBtn.textContent = 'Behind Modal';
    mockRect(disabledBtn, { left: 20, top: 20, width: 140, height: 40 });
    document.body.appendChild(disabledBtn);

    const modal = document.createElement('div');
    modal.id = 'covering-modal';
    mockRect(modal, { left: 0, top: 0, width: 400, height: 400 });
    document.body.appendChild(modal);

    // When modal is topmost at (50, 35), disabledBtn must NOT be selected
    document.elementFromPoint = vi.fn().mockReturnValue(modal);
    const occludedEvent = new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 35 });
    Object.defineProperty(occludedEvent, 'target', { value: modal });
    expect(resolveInspectTarget(occludedEvent)).toBe(modal);
    expect(disabledBtn.hasAttribute('style')).toBe(false);

    // When disabledBtn (or its inner span) is topmost, it IS selected and leaves no stray style attribute
    const innerSpan = document.createElement('span');
    innerSpan.textContent = 'Label';
    disabledBtn.appendChild(innerSpan);
    document.elementFromPoint = vi.fn().mockImplementation(() => {
      expect(disabledBtn.style.getPropertyValue('pointer-events')).toBe('auto');
      return innerSpan;
    });
    const visibleEvent = new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 35 });
    Object.defineProperty(visibleEvent, 'target', { value: document.body });
    expect(resolveInspectTarget(visibleEvent)).toBe(disabledBtn);
    expect(disabledBtn.hasAttribute('style')).toBe(false);
  });

  it('selects disabled buttons on double-click in edit mode without enabling contentEditable', async () => {
    await mountOverlay();

    const container = document.createElement('div');
    mockRect(container, { left: 0, top: 0, width: 300, height: 100 });
    const disabledBtn = document.createElement('button');
    disabledBtn.id = 'dblclick-disabled';
    disabledBtn.disabled = true;
    disabledBtn.textContent = 'Disabled Action';
    mockRect(disabledBtn, { left: 16, top: 16, width: 120, height: 36 });
    container.appendChild(disabledBtn);
    document.body.appendChild(container);

    await act(() => {
      state.setTool('edit');
    });

    container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 40, clientY: 30 }));
    expect(state.activeElement).toBe(disabledBtn);
    expect(disabledBtn.contentEditable).not.toBe('true');
    expect(disabledBtn.contentEditable).not.toBe('plaintext-only');
  });

  it('does not select decorative pointer-events: none div elements over underlying content', async () => {
    await mountOverlay();

    const card = document.createElement('div');
    card.id = 'content-card';
    mockRect(card, { left: 0, top: 0, width: 300, height: 200 });

    const decorativeGlow = document.createElement('div');
    decorativeGlow.id = 'decorative-glow';
    decorativeGlow.style.pointerEvents = 'none';
    mockRect(decorativeGlow, { left: 0, top: 0, width: 300, height: 200 });

    const title = document.createElement('h2');
    title.id = 'card-title';
    title.textContent = 'Card Title';
    mockRect(title, { left: 20, top: 20, width: 200, height: 32 });

    card.appendChild(decorativeGlow);
    card.appendChild(title);
    document.body.appendChild(card);

    await act(() => {
      state.setTool('comment');
    });

    title.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 30 }));
    expect(state.commentTargetElement).toBe(title);
  });
});
