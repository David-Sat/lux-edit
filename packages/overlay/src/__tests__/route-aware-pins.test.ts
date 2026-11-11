// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isAnnotationOnRoute } from '../inspector/comment-pins.js';
import { OverlayStateManager } from '../inspector/state.js';

describe('Route-aware Pins & Navigation', () => {
  let state: OverlayStateManager;
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

    (OverlayStateManager as any).instance = undefined;
    state = OverlayStateManager.getInstance();
  });

  afterEach(() => {
    storageMap.clear();
    delete (globalThis as any).WebSocket;
    vi.restoreAllMocks();
  });

  describe('isAnnotationOnRoute matching helper', () => {
    it('matches exact pathnames', () => {
      expect(isAnnotationOnRoute({ pathname: '/dashboard' }, '/dashboard')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/about' }, '/about')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/' }, '/')).toBe(true);
    });

    it('normalizes trailing slashes properly', () => {
      expect(isAnnotationOnRoute({ pathname: '/dashboard/' }, '/dashboard')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/dashboard' }, '/dashboard/')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/' }, '')).toBe(true);
    });

    it('rejects annotations on differing routes', () => {
      expect(isAnnotationOnRoute({ pathname: '/dashboard' }, '/settings')).toBe(false);
      expect(isAnnotationOnRoute({ pathname: '/' }, '/about')).toBe(false);
      expect(isAnnotationOnRoute({ pathname: '/products/1' }, '/products/2')).toBe(false);
    });

    it('extracts pathname from full url when pathname is omitted', () => {
      expect(
        isAnnotationOnRoute(
          { url: 'http://localhost:3000/checkout?coupon=test' },
          '/checkout'
        )
      ).toBe(true);
      expect(
        isAnnotationOnRoute(
          { url: 'http://localhost:3000/checkout' },
          '/cart'
        )
      ).toBe(false);
    });

    it('falls back to true if neither pathname nor url is available', () => {
      expect(isAnnotationOnRoute({}, '/any-route')).toBe(true);
    });
  });

  describe('OverlayStateManager route handling', () => {
    it('updates currentPathname and notifies listeners on handleRouteChange', () => {
      const listener = vi.fn();
      state.subscribe(listener);

      state.handleRouteChange('/pricing');
      expect(state.currentPathname).toBe('/pricing');
      expect(listener).toHaveBeenCalled();
    });

    it('clears active and detached element references when route changes', () => {
      const button = document.createElement('button');
      button.textContent = 'Old page button';
      document.body.appendChild(button);

      state.setActiveElement(button);
      state.setCommentTarget(button);
      expect(state.activeElement).toBe(button);
      expect(state.commentTargetElement).toBe(button);

      // Simulate SPA route change where old page DOM elements are removed
      document.body.removeChild(button);
      state.handleRouteChange('/new-page');

      expect(state.currentPathname).toBe('/new-page');
      expect(state.activeElement).toBeNull();
      expect(state.commentTargetElement).toBeNull();
    });

    it('isolates annotations across routes in multi-page flow and tracks visited pages', () => {
      // Simulate page 1: /
      state.handleRouteChange('/');
      const homeHeading = document.createElement('h1');
      homeHeading.id = 'home-title';
      document.body.appendChild(homeHeading);
      state.addComment('Make headline bolder', homeHeading);

      // Simulate page 2: /contact
      document.body.innerHTML = '';
      state.handleRouteChange('/contact');
      const contactForm = document.createElement('form');
      contactForm.id = 'contact-form';
      document.body.appendChild(contactForm);
      state.addComment('Add captcha verification', contactForm);

      expect(state.annotations.length).toBe(2);

      // Verify route-specific filtering
      const homePins = state.annotations.filter((ann) =>
        isAnnotationOnRoute(ann, '/')
      );
      const contactPins = state.annotations.filter((ann) =>
        isAnnotationOnRoute(ann, '/contact')
      );

      expect(homePins.length).toBe(1);
      expect(homePins[0].comment).toBe('Make headline bolder');

      expect(contactPins.length).toBe(1);
      expect(contactPins[0].comment).toBe('Add captcha verification');

      // Batch should collect all annotations and report pages visited
      const batch = state.getBatch();
      expect(batch.annotations?.length).toBe(2);
      expect(batch.pagesVisited).toContain('/contact');
    });
  });
});
