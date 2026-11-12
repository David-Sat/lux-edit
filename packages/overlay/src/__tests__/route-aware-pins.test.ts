// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { CommentPins } from '../inspector/comment-pins.js';
import {
  buildRoutePath,
  getRouteFromLocation,
  isAnnotationOnRoute,
  normalizeRoute,
} from '../inspector/route-utils.js';
import { VoicePins } from '../inspector/voice-pins.js';
import { EditReviewDrawer } from '../drawer/edit-review-drawer.js';
import { OverlayStateManager } from '../inspector/state.js';

const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));
const flushRender = () => new Promise<void>((resolve) => setTimeout(() => resolve(), 25));

describe('Route-aware Pins & Navigation', () => {
  let state: OverlayStateManager;
  const storageMap = new Map<string, string>();
  let originalPath = '/';

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

    originalPath = window.location.pathname + window.location.search + window.location.hash;
    window.history.replaceState({}, '', '/');

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

  afterEach(() => {
    storageMap.clear();
    OverlayStateManager.resetInstance();
    delete (globalThis as any).WebSocket;
    window.history.replaceState({}, '', originalPath || '/');
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('normalizeRoute & isAnnotationOnRoute helpers', () => {
    it('matches exact pathnames', () => {
      expect(isAnnotationOnRoute({ pathname: '/dashboard' }, '/dashboard')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/about' }, '/about')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/' }, '/')).toBe(true);
    });

    it('treats root / and /index.html (or index.htm) as equivalent routes', () => {
      expect(isAnnotationOnRoute({ pathname: '/' }, '/index.html')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/index.html' }, '/')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/index.htm' }, '/')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/sub/index.html' }, '/sub')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/sub' }, '/sub/index.html')).toBe(true);
    });

    it('strips query parameters and plain hash anchors before checking .html extensions', () => {
      expect(normalizeRoute('/about.html?x=1#section')).toBe('/about');
      expect(normalizeRoute('/index.html?ref=nav#top')).toBe('/');
      expect(isAnnotationOnRoute({ pathname: '/about.html?x=1' }, '/about')).toBe(true);
    });

    it('normalizes clean URLs and trailing slashes properly', () => {
      expect(isAnnotationOnRoute({ pathname: '/about.html' }, '/about')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/about' }, '/about.html')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/features/billing.html' }, '/features/billing')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/dashboard/' }, '/dashboard')).toBe(true);
      expect(isAnnotationOnRoute({ pathname: '/' }, '')).toBe(true);
    });

    it('supports hash-based SPA routes while ignoring plain #anchors', () => {
      expect(buildRoutePath('/', '#features')).toBe('/');
      expect(buildRoutePath('/', '#/about')).toBe('/#/about');
      expect(buildRoutePath('/app/', '#!/users?id=2')).toBe('/app/#!/users');

      expect(normalizeRoute('/#/about?tab=1')).toBe('/#/about');
      expect(normalizeRoute('/index.html#/about')).toBe('/#/about');
      expect(isAnnotationOnRoute({ pathname: '/#/home' }, '/#/about')).toBe(false);
      expect(isAnnotationOnRoute({ pathname: '/#!/about' }, '/#/about')).toBe(true);
      expect(
        isAnnotationOnRoute({ url: 'http://localhost:3000/#/about' }, '/#/contact')
      ).toBe(false);
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

  describe('OverlayStateManager route handling & multi-page isolation', () => {
    it('updates currentPathname and notifies listeners only when route or targets change', () => {
      const listener = vi.fn();
      state.subscribe(listener);

      state.handleRouteChange('/pricing');
      expect(state.currentPathname).toBe('/pricing');
      expect(listener).toHaveBeenCalledTimes(1);

      // Calling again for the same route with no detached targets should be a no-op
      state.handleRouteChange('/pricing');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unconditionally clears transient selection state on route change even before DOM unmount', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      document.body.appendChild(button1);
      document.body.appendChild(button2);

      state.setActiveElement(button1);
      state.setHoveredElement(button1);
      state.toggleCommentTarget(button1);
      state.toggleCommentTarget(button2);
      expect(state.commentTargetElements.length).toBe(2);

      // Simulate pushState microtask running BEFORE SPA framework unmounts old DOM
      state.handleRouteChange('/new-page');

      expect(state.currentPathname).toBe('/new-page');
      expect(state.activeElement).toBeNull();
      expect(state.hoveredElement).toBeNull();
      expect(state.commentTargetElement).toBeNull();
      expect(state.commentTargetElements).toEqual([]);
    });

    it('stamps pathname on TEXT_EDIT, CLASS_CHANGE, DOM_REMOVE, DOM_INSERT, and DOM_REORDER mutations', () => {
      state.handleRouteChange('/about');

      const container = document.createElement('div');
      container.id = 'wrapper';
      const itemA = document.createElement('p');
      itemA.id = 'item-a';
      itemA.textContent = 'First';
      const itemB = document.createElement('p');
      itemB.id = 'item-b';
      itemB.textContent = 'Second';
      container.appendChild(itemA);
      container.appendChild(itemB);
      document.body.appendChild(container);

      state.setActiveElement(itemA);
      state.updateElementText('First Updated');
      state.addClass('highlighted');
      state.moveElement('down');
      state.duplicateElement();
      state.deleteElement();

      const textMut = state.mutations.find((m) => m.type === 'TEXT_EDIT');
      const classMut = state.mutations.find((m) => m.type === 'CLASS_CHANGE');
      const reorderMut = state.mutations.find((m) => m.type === 'DOM_REORDER');
      const insertMut = state.mutations.find((m) => m.type === 'DOM_INSERT');
      const removeMut = state.mutations.find((m) => m.type === 'DOM_REMOVE');

      expect(textMut?.pathname).toBe('/about');
      expect(classMut?.pathname).toBe('/about');
      expect(reorderMut?.pathname).toBe('/about');
      expect(insertMut?.pathname).toBe('/about');
      expect(removeMut?.pathname).toBe('/about');

      const batch = state.getBatch();
      expect(batch.route).toBe('/about');
      expect(batch.pagesVisited).toContain('/about');
    });

    it('preserves mutations with identical selectors across different routes and guards cross-route revert', () => {
      state.handleRouteChange('/');
      const homeH1 = document.createElement('h1');
      homeH1.className = 'hero-title';
      homeH1.textContent = 'Home Title';
      document.body.appendChild(homeH1);

      state.setActiveElement(homeH1);
      state.updateElementText('Home Title Edited');
      const homeMut = state.mutations.find((m) => m.type === 'TEXT_EDIT' && m.pathname === '/');
      expect(homeMut).toBeDefined();

      // Navigate to /about which also has h1.hero-title
      document.body.innerHTML = '';
      state.handleRouteChange('/about');
      const aboutH1 = document.createElement('h1');
      aboutH1.className = 'hero-title';
      aboutH1.textContent = 'About Title';
      document.body.appendChild(aboutH1);

      state.setActiveElement(aboutH1);
      state.updateElementText('About Title Edited');

      const textEdits = state.mutations.filter((m) => m.type === 'TEXT_EDIT');
      expect(textEdits.length).toBe(2);
      expect(textEdits.map((m) => m.pathname).sort()).toEqual(['/', '/about']);

      // Reverting the '/' mutation while viewing '/about' must NOT touch aboutH1's DOM
      state.revertMutation(homeMut!.id);
      expect(aboutH1.textContent).toBe('About Title Edited');
      expect(state.mutations.some((m) => m.id === homeMut!.id)).toBe(false);
      expect(state.mutations.some((m) => m.pathname === '/about')).toBe(true);
    });

    it('flushes activeElement mutations under previous route before switching currentPathname and ignores equivalent route normalization', () => {
      state.handleRouteChange('/about');
      const heading = document.createElement('h1');
      heading.id = 'about-heading';
      heading.textContent = 'Original';
      document.body.appendChild(heading);

      state.setActiveElement(heading);
      heading.textContent = 'Modified Before Nav';

      // Equivalent route (/about -> /about/) must NOT clear activeElement
      state.handleRouteChange('/about/');
      expect(state.activeElement).toBe(heading);

      // Real route change must flush mutations under /about/ before switching to /contact
      state.handleRouteChange('/contact');
      expect(state.currentPathname).toBe('/contact');
      expect(state.activeElement).toBeNull();
      const textMuts = state.mutations.filter((m) => m.targetSelector === '#about-heading');
      expect(textMuts.length).toBe(1);
      expect(textMuts[0].pathname).toBe('/about/');
    });
  });

  describe('Component rendering & state cleanup across route changes', () => {
    it('CommentPins renders only current-route pins and resets editingPinId on navigation', async () => {
      const mount = document.createElement('div');
      document.body.appendChild(mount);

      const homeTarget = document.createElement('h1');
      homeTarget.id = 'home-el';
      homeTarget.getBoundingClientRect = () =>
        ({ left: 20, top: 30, width: 100, height: 24, right: 120, bottom: 54, x: 20, y: 30, toJSON: () => {} } as DOMRect);
      document.body.appendChild(homeTarget);

      state.handleRouteChange('/');
      state.addComment('Home pin', homeTarget);

      render(h(CommentPins, {}), mount);
      expect(mount.querySelectorAll('.ve-pin').length).toBe(1);

      // Click pin to enter edit mode
      (mount.querySelector('.ve-pin') as HTMLElement).click();
      await flushRender();
      expect(mount.querySelector('textarea')).not.toBeNull();

      // Navigate to /about with a new pin
      const aboutTarget = document.createElement('h2');
      aboutTarget.id = 'about-el';
      aboutTarget.getBoundingClientRect = () =>
        ({ left: 40, top: 60, width: 100, height: 24, right: 140, bottom: 84, x: 40, y: 60, toJSON: () => {} } as DOMRect);
      document.body.appendChild(aboutTarget);

      state.handleRouteChange('/about');
      state.addComment('About pin', aboutTarget);
      await flushRender();

      const pins = mount.querySelectorAll('.ve-pin');
      expect(pins.length).toBe(1);
      // Editing mode from previous page must be cleared so no textarea stays open and hovering works
      expect(mount.querySelector('textarea')).toBeNull();

      // Hovering pin on /about should reveal its tooltip (not blocked by stale editingPinId)
      (pins[0] as HTMLElement).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await flushRender();
      expect(mount.textContent).toContain('About pin');

      // Navigating to /empty (no pins) renders null
      state.handleRouteChange('/empty');
      await flushRender();
      expect(mount.querySelectorAll('.ve-pin').length).toBe(0);

      render(null, mount);
    });

    it('VoicePins filters voiceReviews by url fallback and isolates activeVoicePins by route', () => {
      const mount = document.createElement('div');
      document.body.appendChild(mount);

      const el = document.createElement('button');
      el.id = 'cta';
      document.body.appendChild(el);

      state.handleRouteChange('/about');
      // Legacy review missing pathname, only url present
      state.voiceReviews = [
        {
          id: 'vr_home',
          timestamp: 1,
          transcript: 'Home walkthrough',
          annotatedTranscript: 'Home walkthrough',
          url: 'http://localhost:3000/home',
          pins: [{ id: 'vp1', order: 1, targetSelector: '#cta', bounds: { x: 10, y: 10, width: 50, height: 20 } }],
        },
        {
          id: 'vr_about',
          timestamp: 2,
          transcript: 'About walkthrough',
          annotatedTranscript: 'About walkthrough',
          url: 'http://localhost:3000/about',
          pins: [{ id: 'vp2', order: 1, targetSelector: '#cta', bounds: { x: 20, y: 20, width: 50, height: 20 } }],
        },
      ];

      render(h(VoicePins, {}), mount);
      const renderedPins = mount.querySelectorAll('.ve-voice-pin');
      expect(renderedPins.length).toBe(1);

      // Active voice recording pins are also route-isolated
      state.activeTool = 'voice';
      state.activeVoicePins = [
        { id: 'ap1', order: 1, targetSelector: '#cta', pathname: '/home', bounds: { x: 10, y: 10, width: 50, height: 20 } },
        { id: 'ap2', order: 2, targetSelector: '#cta', pathname: '/about', bounds: { x: 20, y: 20, width: 50, height: 20 } },
      ];
      render(h(VoicePins, {}), mount);
      expect(mount.querySelectorAll('.ve-voice-pin').length).toBe(1);

      // Saved voiceReviews with mixed pin pathnames filter per pin
      state.activeTool = 'none';
      state.activeVoicePins = [];
      state.voiceReviews = [
        {
          id: 'vr_mixed',
          timestamp: 3,
          transcript: 'Cross-page walkthrough',
          annotatedTranscript: 'Cross-page walkthrough',
          pathname: '/home',
          pins: [
            { id: 'mp1', order: 1, targetSelector: '#cta', pathname: '/home', bounds: { x: 10, y: 10, width: 50, height: 20 } },
            { id: 'mp2', order: 2, targetSelector: '#cta', pathname: '/about', bounds: { x: 20, y: 20, width: 50, height: 20 } },
          ],
        },
      ];
      render(h(VoicePins, {}), mount);
      const mixedPinsOnAbout = mount.querySelectorAll('.ve-voice-pin');
      expect(mixedPinsOnAbout.length).toBe(1);
      expect(mixedPinsOnAbout[0].textContent).toContain('Target 2');

      render(null, mount);
    });

    it('keeps single-pin voice annotation on pin route when stopped after navigating away', async () => {
      const mount = document.createElement('div');
      document.body.appendChild(mount);

      const el = document.createElement('button');
      el.id = 'home-cta';
      el.getBoundingClientRect = () =>
        ({ left: 10, top: 20, width: 80, height: 30, right: 90, bottom: 50, x: 10, y: 20, toJSON: () => {} } as DOMRect);
      document.body.appendChild(el);

      state.handleRouteChange('/home');
      state.startVoiceRecording();
      state.recordVoicePin(el);

      // User navigates to /about before hitting Stop
      state.handleRouteChange('/about');
      await state.stopVoiceRecording();

      expect(state.annotations.length).toBe(1);
      expect(state.annotations[0].pathname).toBe('/home');

      render(h(CommentPins, {}), mount);
      expect(mount.querySelectorAll('.ve-pin').length).toBe(0);

      state.handleRouteChange('/home');
      await flushRender();
      expect(mount.querySelectorAll('.ve-pin').length).toBe(1);

      render(null, mount);
    });

    it('includes cross-route voice target pathnames in batch.pagesVisited deduplicated by normalized route', async () => {
      const elA = document.createElement('button');
      elA.id = 'home-btn';
      const elB = document.createElement('button');
      elB.id = 'about-btn';
      document.body.appendChild(elA);
      document.body.appendChild(elB);

      state.handleRouteChange('/home');
      state.startVoiceRecording();
      state.recordVoicePin(elA);

      state.handleRouteChange('/about/');
      state.recordVoicePin(elB);
      state.handleRouteChange('/about');
      await state.stopVoiceRecording();

      const batch = state.getBatch();
      expect(batch.pagesVisited).toContain('/home');
      expect(batch.pagesVisited?.filter((p) => normalizeRoute(p) === '/about').length).toBe(1);
    });

    it('CommentPins multi-target fallback does not leak targets missing pathname onto other routes', async () => {
      const mount = document.createElement('div');
      document.body.appendChild(mount);

      const elA = document.createElement('div');
      elA.id = 'el-a';
      elA.getBoundingClientRect = () =>
        ({ left: 10, top: 10, width: 40, height: 20, right: 50, bottom: 30, x: 10, y: 10, toJSON: () => {} } as DOMRect);
      const elB = document.createElement('div');
      elB.id = 'el-b';
      elB.getBoundingClientRect = () =>
        ({ left: 60, top: 10, width: 40, height: 20, right: 100, bottom: 30, x: 60, y: 10, toJSON: () => {} } as DOMRect);
      document.body.appendChild(elA);
      document.body.appendChild(elB);

      state.annotations = [
        {
          id: 'ann_mixed_targets',
          timestamp: 1,
          type: 'multi',
          pathname: '/about',
          comment: 'Mixed target paths',
          targets: [
            { targetSelector: '#el-a', pathname: '/home' },
            { targetSelector: '#el-b' },
          ],
        },
      ];

      state.handleRouteChange('/home');
      render(h(CommentPins, {}), mount);
      expect(mount.querySelectorAll('.ve-pin').length).toBe(1);
      expect(mount.querySelector('.ve-pin')?.textContent).toContain('1A');

      state.handleRouteChange('/about');
      await flushRender();
      expect(mount.querySelectorAll('.ve-pin').length).toBe(1);
      expect(mount.querySelector('.ve-pin')?.textContent).toContain('1B');

      render(null, mount);
    });

    it('EditReviewDrawer displays route badges for mutations and annotations', () => {
      const mount = document.createElement('div');
      document.body.appendChild(mount);

      state.handleRouteChange('/about');
      const heading = document.createElement('h1');
      heading.id = 'about-h1';
      heading.textContent = 'About';
      document.body.appendChild(heading);

      state.setActiveElement(heading);
      state.updateElementText('About Updated');
      state.addComment('Refine copy', heading);
      state.setDrawerOpen(true);

      render(h(EditReviewDrawer, {}), mount);
      expect(mount.textContent).toContain('/about');

      render(null, mount);
    });
  });

  describe('index.ts navigation interception & idempotency', () => {
    it('intercepts history.pushState and initializes overlay idempotently', async () => {
      delete (window as any).__LUX_OVERLAY_INITIALIZED__;
      vi.resetModules();
      await import('../index.js');
      const { OverlayStateManager: FreshManager } = await import('../inspector/state.js');
      const manager = FreshManager.getInstance();

      // Re-evaluating index.ts must not create duplicate roots or double-wrap history
      vi.resetModules();
      await import('../index.js');

      const overlays = document.querySelectorAll('visual-edit-overlay#lux-root');
      expect(overlays.length).toBe(1);

      window.history.pushState({}, '', '/spa-dashboard');
      await flushMicrotasks();

      expect(manager.currentPathname).toBe('/spa-dashboard');

      // Hash-router hashchange updates route, while plain anchor hashes are ignored
      window.history.replaceState({}, '', '/#/home');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(manager.getCurrentPathname()).toBe('/#/home');

      window.history.replaceState({}, '', '/#/settings');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(manager.getCurrentPathname()).toBe('/#/settings');

      window.history.replaceState({}, '', '/docs');
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(manager.getCurrentPathname()).toBe('/docs');

      const listener = vi.fn();
      manager.subscribe(listener);
      window.history.replaceState({}, '', '/docs#api');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(getRouteFromLocation()).toBe('/docs');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
