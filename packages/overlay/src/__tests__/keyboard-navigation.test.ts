// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { ElementVariantSet, STORAGE_KEYS } from '@visual-edit/core';
import { OverlayRoot } from '../overlay-root.js';
import { OverlayStateManager } from '../inspector/state.js';
import { OVERLAY_STYLES } from '../inspector/styles.css.js';
import {
  DEFAULT_OVERLAY_HOTKEYS,
  eventToHotkeyBinding,
  formatHotkeyLabel,
  matchesHotkeyEvent,
  normalizeHotkey,
} from '../inspector/hotkeys.js';

const flushRender = () => new Promise<void>((resolve) => setTimeout(resolve, 30));

function mockRect(
  el: Element,
  rect: { left: number; top: number; width: number; height: number }
): void {
  el.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => ({}),
    } as DOMRect);
}

describe('Keyboard Navigation, ARIA, Focus Rings & Custom Hotkeys', () => {
  let hostEl: HTMLElement;
  let shadowRoot: ShadowRoot;
  let targetPara: HTMLParagraphElement;
  let state: OverlayStateManager;
  const storageMap = new Map<string, string>();

  beforeEach(async () => {
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

    targetPara = document.createElement('p');
    targetPara.id = 'kb-para';
    targetPara.textContent = 'Sample paragraph content';
    targetPara.style.fontSize = '16px';
    mockRect(targetPara, { left: 80, top: 140, width: 320, height: 36 });
    document.body.appendChild(targetPara);

    hostEl = document.createElement('visual-edit-overlay');
    shadowRoot = hostEl.attachShadow({ mode: 'open' });
    document.body.appendChild(hostEl);

    OverlayStateManager.resetInstance();
    state = OverlayStateManager.getInstance();
    await act(async () => {
      render(h(OverlayRoot, { shadowRoot }), shadowRoot);
      await flushRender();
    });
  });

  afterEach(async () => {
    await act(() => {
      render(null, shadowRoot);
    });
    hostEl.remove();
    document.body.innerHTML = '';
    storageMap.clear();
    OverlayStateManager.resetInstance();
    delete (globalThis as any).WebSocket;
    vi.restoreAllMocks();
  });

  it('normalizes, formats, captures, and matches hotkeys including macOS Alt+Key dead chars', () => {
    expect(normalizeHotkey('Alt + Shift + E')).toBe('alt+shift+e');
    expect(normalizeHotkey('V')).toBe('v');
    expect(normalizeHotkey(' ')).toBe('space');
    expect(normalizeHotkey('Shift')).toBe('');
    expect(normalizeHotkey('Escape')).toBe('');

    expect(formatHotkeyLabel('alt+shift+e')).toBe('Alt+Shift+E');
    expect(formatHotkeyLabel('v')).toBe('V');
    expect(formatHotkeyLabel('')).toBe('Off');

    const macAltDeadEv = new KeyboardEvent('keydown', {
      key: 'Dead',
      code: 'KeyE',
      altKey: true,
    });
    expect(eventToHotkeyBinding(macAltDeadEv)).toBe('alt+e');
    expect(matchesHotkeyEvent(macAltDeadEv, 'alt+e')).toBe(true);

    const modifierOnly = new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true });
    expect(eventToHotkeyBinding(modifierOnly)).toBeNull();
  });

  it('persists custom hotkeys, clears collisions, and resets cleanly', () => {
    state.setHotkey('edit', 'c');
    expect(state.hotkeys.edit).toBe('c');
    expect(state.hotkeys.comment).toBe('');

    const rawStored = storageMap.get(STORAGE_KEYS.HOTKEYS);
    expect(rawStored).toBeDefined();
    expect(JSON.parse(rawStored!).edit).toBe('c');

    // Reload fresh manager and confirm persisted hotkeys hydrate cleanly
    OverlayStateManager.resetInstance();
    const fresh = OverlayStateManager.getInstance();
    expect(fresh.hotkeys.edit).toBe('c');
    expect(fresh.hotkeys.comment).toBe('');

    fresh.resetHotkeys();
    expect(fresh.hotkeys).toEqual(DEFAULT_OVERLAY_HOTKEYS);
    expect(storageMap.get(STORAGE_KEYS.HOTKEYS)).toBeUndefined();
  });

  it('includes crisp :focus-visible styling in OVERLAY_STYLES', () => {
    expect(OVERLAY_STYLES).toContain(':focus-visible');
    expect(OVERLAY_STYLES).toContain('.ve-tab-btn');
    expect(OVERLAY_STYLES).toContain('.ve-slider');
    expect(OVERLAY_STYLES).toContain('.ve-hotkey-btn');
  });

  it('DockMenu exposes toolbar ARIA attributes, roving arrow navigation, and dynamic shortcuts', async () => {
    const launcher = shadowRoot.querySelector('.ve-launcher-btn') as HTMLButtonElement | null;
    expect(launcher).not.toBeNull();
    expect(launcher!.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      launcher!.click();
      await flushRender();
    });

    const toolbar = shadowRoot.querySelector('.ve-dock-menu[role="toolbar"]') as HTMLElement | null;
    expect(toolbar).not.toBeNull();

    const dockItems = Array.from(toolbar!.querySelectorAll('.ve-dock-item')) as HTMLButtonElement[];
    expect(dockItems.length).toBe(7);

    dockItems[0].focus();
    expect(shadowRoot.activeElement).toBe(dockItems[0]);

    await act(() => {
      dockItems[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
    });
    expect(shadowRoot.activeElement).toBe(dockItems[1]);

    await act(() => {
      dockItems[1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true })
      );
    });
    expect(shadowRoot.activeElement).toBe(dockItems[dockItems.length - 1]);

    // Wraps on ArrowRight from last item back to first item
    await act(() => {
      dockItems[dockItems.length - 1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
    });
    expect(shadowRoot.activeElement).toBe(dockItems[0]);

    await act(async () => {
      state.setHotkey('edit', 'alt+e');
      await flushRender();
    });
    expect(dockItems[1].getAttribute('title')).toContain('(Alt+E)');
    expect(dockItems[1].getAttribute('aria-keyshortcuts')).toBe('Alt+E');
  });

  it('FloatingToolbar supports Arrow tab switching, control group arrows, and Backspace slider reset', async () => {
    await act(async () => {
      state.setDockMenuOpen(true);
      state.setTool('edit');
      state.setActiveElement(targetPara);
      await flushRender();
    });

    const tablist = shadowRoot.querySelector('.ve-toolbar-tabs[role="tablist"]') as HTMLElement | null;
    expect(tablist).not.toBeNull();

    const tabs = Array.from(tablist!.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(tabs.length).toBe(7);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].tabIndex).toBe(0);
    expect(tabs[1].tabIndex).toBe(-1);

    tabs[0].focus();
    await act(async () => {
      tabs[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
      await flushRender();
    });

    expect(shadowRoot.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(shadowRoot.querySelector('#ve-tabpanel-spacing[role="tabpanel"]')).not.toBeNull();

    // End jumps to DOM tab, Home returns to Smart tab
    await act(async () => {
      tabs[1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true })
      );
      await flushRender();
    });
    expect(shadowRoot.activeElement).toBe(tabs[6]);
    expect(shadowRoot.querySelector('#ve-tabpanel-actions[role="tabpanel"]')).not.toBeNull();

    await act(async () => {
      tabs[6].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true })
      );
      await flushRender();
    });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    // Control group arrow keys inside Weight buttons & Action ribbon
    const weightBtns = Array.from(
      shadowRoot.querySelectorAll('[aria-label="Font weight"] button')
    ) as HTMLButtonElement[];
    expect(weightBtns.length).toBe(4);
    weightBtns[0].focus();
    await act(() => {
      weightBtns[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
    });
    expect(shadowRoot.activeElement).toBe(weightBtns[1]);

    const ribbonBtns = Array.from(
      shadowRoot.querySelectorAll('.ve-action-ribbon button')
    ) as HTMLButtonElement[];
    expect(ribbonBtns.length).toBe(5);
    ribbonBtns[0].focus();
    await act(() => {
      ribbonBtns[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
    });
    expect(shadowRoot.activeElement).toBe(ribbonBtns[1]);

    // Size slider resets on Backspace
    const sizeSlider = shadowRoot.querySelector('input[type="range"][aria-label="Size"]') as HTMLInputElement;
    expect(sizeSlider).not.toBeNull();
    state.updateElementStyle('font-size', '28px');
    expect(targetPara.style.fontSize).toBe('28px');

    sizeSlider.focus();
    await act(async () => {
      sizeSlider.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, composed: true })
      );
      await flushRender();
    });
    expect(targetPara.style.fontSize).toBe('16px');
  });

  it('CommentPins and VoicePins support focus tooltips, arrow cycling, Enter editing, and Escape focus restore', async () => {
    const secondTarget = document.createElement('div');
    secondTarget.id = 'second-pin-el';
    mockRect(secondTarget, { left: 260, top: 240, width: 140, height: 32 });
    document.body.appendChild(secondTarget);

    await act(async () => {
      state.addComment('First note', targetPara);
      state.addComment('Second note', secondTarget);
      await flushRender();
    });

    const pins = Array.from(shadowRoot.querySelectorAll('.ve-pin')) as HTMLElement[];
    expect(pins.length).toBe(2);
    expect(pins[0].getAttribute('role')).toBe('button');
    expect(pins[0].tabIndex).toBe(0);

    // Focus opens tooltip
    await act(async () => {
      pins[0].focus();
      pins[0].dispatchEvent(new FocusEvent('focus'));
      await flushRender();
    });
    expect(pins[0].getAttribute('aria-expanded')).toBe('true');

    // ArrowRight cycles to Pin 2
    await act(async () => {
      pins[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
      pins[1].dispatchEvent(new FocusEvent('focus'));
      await flushRender();
    });
    expect(shadowRoot.activeElement).toBe(pins[1]);
    expect(pins[1].getAttribute('aria-expanded')).toBe('true');

    // Enter opens edit textarea inside tooltip
    await act(async () => {
      pins[1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
      );
      await flushRender();
    });
    const editTextarea = shadowRoot.querySelector('.ve-pin-tooltip textarea') as HTMLTextAreaElement | null;
    expect(editTextarea).not.toBeNull();

    // Escape exits edit, hides tooltip, restores focus to Pin 2 without bubbling to window
    const windowKeyDown = vi.fn();
    window.addEventListener('keydown', windowKeyDown);
    await act(async () => {
      editTextarea!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true })
      );
      await flushRender();
    });
    window.removeEventListener('keydown', windowKeyDown);

    expect(windowKeyDown).not.toHaveBeenCalled();
    expect(shadowRoot.querySelector('.ve-pin-tooltip')).toBeNull();
    expect(shadowRoot.activeElement).toBe(pins[1]);

    // VoicePins arrow cycling
    await act(async () => {
      state.activeTool = 'voice';
      state.activeVoicePins = [
        { id: 'vp1', order: 1, targetSelector: '#kb-para', pathname: '/', bounds: { x: 80, y: 140, width: 100, height: 30 } },
        { id: 'vp2', order: 2, targetSelector: '#second-pin-el', pathname: '/', bounds: { x: 260, y: 240, width: 100, height: 30 } },
      ];
      state.notify({ skipSync: true });
      await flushRender();
    });

    const voicePins = Array.from(shadowRoot.querySelectorAll('.ve-voice-pin')) as HTMLElement[];
    expect(voicePins.length).toBe(2);
    voicePins[0].focus();
    await act(async () => {
      voicePins[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
      await flushRender();
    });
    expect(shadowRoot.activeElement).toBe(voicePins[1]);
  });

  it('CommentComposer traps Tab cycling cleanly and closes on Escape', async () => {
    await act(async () => {
      state.setTool('comment');
      state.setCommentTarget(targetPara);
      await flushRender();
    });

    const dialog = shadowRoot.querySelector('.ve-comment-popover[role="dialog"]') as HTMLElement | null;
    expect(dialog).not.toBeNull();

    const closeBtn = dialog!.querySelector('.ve-close-btn') as HTMLButtonElement;
    const submitBtn = dialog!.querySelector('.ve-composer-submit-btn') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Enable Submit button by filling text
    const textarea = dialog!.querySelector('.ve-comment-textarea') as HTMLTextAreaElement;
    await act(async () => {
      textarea.value = 'Check spacing here';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await flushRender();
    });
    expect(submitBtn.disabled).toBe(false);

    // Tab at last focusable element wraps back to closeBtn
    submitBtn.focus();
    await act(() => {
      dialog!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true })
      );
    });
    expect(shadowRoot.activeElement).toBe(closeBtn);

    // Shift+Tab at first focusable element wraps to submitBtn
    await act(() => {
      dialog!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );
    });
    expect(shadowRoot.activeElement).toBe(submitBtn);

    // Escape closes dialog
    await act(async () => {
      dialog!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true })
      );
      await flushRender();
    });
    expect(state.commentTargetElement).toBeNull();
  });

  it('supports D to toggle Review Drawer, ? for Shortcuts panel, isolated key rebinding, footer arrows, and Reset Defaults', async () => {
    const windowKeyDown = vi.fn();
    window.addEventListener('keydown', windowKeyDown);

    try {
      // 'd' opens Review Drawer
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true })
        );
        await flushRender();
      });
      expect(state.isDrawerOpen).toBe(true);

      // '?' opens Keyboard Shortcuts panel inside Drawer
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true, cancelable: true })
        );
        await flushRender();
      });
      expect(state.isShortcutsPanelOpen).toBe(true);
      expect(shadowRoot.querySelector('.ve-shortcuts-panel')).not.toBeNull();

      // Rebind Edit shortcut via capture button without leaking to host page
      const editHotkeyBtn = shadowRoot.querySelectorAll('.ve-hotkey-btn')[0] as HTMLButtonElement;
      expect(editHotkeyBtn.textContent).toBe('V');

      await act(async () => {
        editHotkeyBtn.click();
        await flushRender();
      });
      expect(editHotkeyBtn.getAttribute('data-ve-hotkey-capture')).toBe('true');

      // Pressing Escape cancels capture WITHOUT closing drawer
      await act(async () => {
        editHotkeyBtn.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true })
        );
        await flushRender();
      });
      expect(state.isDrawerOpen).toBe(true);
      expect(editHotkeyBtn.getAttribute('data-ve-hotkey-capture')).toBeNull();

      // Re-enter capture and bind 'k'
      await act(async () => {
        editHotkeyBtn.click();
        await flushRender();
      });
      await act(async () => {
        editHotkeyBtn.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', bubbles: true, composed: true, cancelable: true })
        );
        await flushRender();
      });
      expect(state.hotkeys.edit).toBe('k');
      expect(editHotkeyBtn.textContent).toBe('K');
      expect(windowKeyDown).not.toHaveBeenCalled();

      // Add a comment so footer Copy/Submit buttons become enabled and test ArrowRight in footer
      await act(async () => {
        state.addComment('Ready for review', targetPara);
        await flushRender();
      });

      const footerBtns = Array.from(
        shadowRoot.querySelectorAll('.ve-drawer-footer button:not(:disabled)')
      ) as HTMLButtonElement[];
      expect(footerBtns.length).toBe(3);
      footerBtns[0].focus();
      await act(() => {
        footerBtns[0].dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
        );
      });
      expect(shadowRoot.activeElement).toBe(footerBtns[1]);

      // Reset Defaults restores 'v'
      const resetBtn = shadowRoot.querySelector('.ve-shortcuts-reset-btn') as HTMLButtonElement;
      await act(async () => {
        resetBtn.click();
        await flushRender();
      });
      expect(state.hotkeys.edit).toBe('v');

      // 'd' again closes Drawer
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true })
        );
        await flushRender();
      });
      expect(state.isDrawerOpen).toBe(false);
    } finally {
      window.removeEventListener('keydown', windowKeyDown);
    }
  });

  it('VariantSwitcher supports radiogroup arrows & Enter inside Shadow DOM and ignores Alt+Arrow while typing in Shadow inputs', async () => {
    const vset: ElementVariantSet = {
      id: 'vset_kb',
      targetSelector: '#kb-para',
      label: 'Hero Copy',
      createdAt: Date.now(),
      status: 'pending',
      variants: [
        { id: 'opt1', name: 'Bold Lead', rationale: 'Stronger contrast', styles: { fontWeight: '700' } },
        { id: 'opt2', name: 'Subtle Italic', rationale: 'Softer tone', styles: { fontStyle: 'italic' } },
      ],
    };

    await act(async () => {
      state.variantSets = [vset];
      state.setTool('comment');
      state.setCommentTarget(targetPara);
      await flushRender();
    });

    // While focus is inside CommentComposer textarea in Shadow DOM, Alt+ArrowRight must NOT preview variant
    const composerTextarea = shadowRoot.querySelector('textarea.ve-comment-textarea') as HTMLTextAreaElement;
    expect(composerTextarea).not.toBeNull();
    composerTextarea.focus();

    await act(async () => {
      composerTextarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, composed: true })
      );
      await flushRender();
    });
    expect(state.activeVariantPreview.get('vset_kb') ?? null).toBeNull();

    // Dismiss composer, focus first radio option, ArrowRight previews opt1 and Enter decides it
    await act(async () => {
      state.setCommentTarget(null);
      await flushRender();
    });

    const optionBtns = Array.from(
      shadowRoot.querySelectorAll('.ve-variant-option-btn[role="radio"]')
    ) as HTMLButtonElement[];
    expect(optionBtns.length).toBe(3);

    optionBtns[0].focus();
    await act(async () => {
      optionBtns[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true })
      );
      await flushRender();
    });
    expect(shadowRoot.activeElement).toBe(optionBtns[1]);
    expect(state.activeVariantPreview.get('vset_kb')).toBe('opt1');

    await act(async () => {
      optionBtns[1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
      );
      await flushRender();
    });
    expect(vset.status).toBe('decided');
  });
});
