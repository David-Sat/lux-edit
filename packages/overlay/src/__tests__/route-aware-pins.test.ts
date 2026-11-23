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
import { clampPinDragOffset, parseTranslateOffset } from '../inspector/pin-drag.js';
import { locatePinTarget } from '../inspector/pin-position.js';
import { OverlayStateManager } from '../inspector/state.js';
import { BASE_CSS } from '../inspector/styles/base.css.js';
import { COMPOSER_CSS } from '../inspector/styles/composer.css.js';
import { LIQUID_GLASS_CSS } from '../inspector/styles/liquid-glass.css.js';

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

    it('locatePinTarget tracks document coordinates linearly across viewport edges, detects fixed parents, and resolves bounds fallback', () => {
      const docEl = document.createElement('section');
      docEl.id = 'scroll-target';
      docEl.getBoundingClientRect = () =>
        ({ left: 40, top: 2, width: 120, height: 100, right: 160, bottom: 102, x: 40, y: 2, toJSON: () => {} } as DOMRect);
      document.body.appendChild(docEl);

      // Crossing top viewport edge (top = 2 < 4 while bottom = 102 > 28) must NOT clamp to 16
      const nearTop = locatePinTarget({
        targetSelector: '#scroll-target',
        anchor: { left: 0, top: -198 },
      });
      expect(nearTop.found).toBe(true);
      expect(nearTop.fixed).toBe(false);
      expect(nearTop.viewportX).toBe(52);
      expect(nearTop.viewportY).toBe(14);
      expect(nearTop.x).toBe(52);
      expect(nearTop.y).toBe(212);

      // Scrolled further up (top = -18, bottom = 82) keeps identical document coordinate 212 without jumping
      docEl.getBoundingClientRect = () =>
        ({ left: 40, top: -18, width: 120, height: 100, right: 160, bottom: 82, x: 40, y: -18, toJSON: () => {} } as DOMRect);
      const scrolledPartway = locatePinTarget({
        targetSelector: '#scroll-target',
        anchor: { left: 0, top: -218 },
      });
      expect(scrolledPartway.viewportY).toBe(-6);
      expect(scrolledPartway.y).toBe(212);

      // Scrolled completely past bottom <= 28 (top = -80, bottom = 20) still stays locked at document coordinate 212
      docEl.getBoundingClientRect = () =>
        ({ left: 40, top: -80, width: 120, height: 100, right: 160, bottom: 20, x: 40, y: -80, toJSON: () => {} } as DOMRect);
      const scrolledPast = locatePinTarget({
        targetSelector: '#scroll-target',
        anchor: { left: 0, top: -280 },
      });
      expect(scrolledPast.viewportY).toBe(-68);
      expect(scrolledPast.y).toBe(212);

      // Element inside a position: fixed ancestor switches to fixed: true and viewport coordinates
      const fixedHeader = document.createElement('header');
      fixedHeader.style.position = 'fixed';
      const fixedBtn = document.createElement('button');
      fixedBtn.id = 'fixed-btn';
      fixedBtn.getBoundingClientRect = () =>
        ({ left: 200, top: 18, width: 80, height: 32, right: 280, bottom: 50, x: 200, y: 18, toJSON: () => {} } as DOMRect);
      fixedHeader.appendChild(fixedBtn);
      document.body.appendChild(fixedHeader);

      const fixedPos = locatePinTarget({
        targetSelector: '#fixed-btn',
        anchor: { left: 0, top: -300 },
      });
      expect(fixedPos.found).toBe(true);
      expect(fixedPos.fixed).toBe(true);
      expect(fixedPos.x).toBe(212);
      expect(fixedPos.y).toBe(30);

      // Missing selector falls back to stored document bounds relative to anchor
      Object.defineProperty(window, 'scrollX', { value: 20, configurable: true });
      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true });
      const fallback = locatePinTarget({
        targetSelector: '#does-not-exist',
        bounds: { x: 100, y: 300, width: 90, height: 40 },
        anchor: { left: -20, top: -150 },
      });
      expect(fallback.found).toBe(true);
      expect(fallback.fixed).toBe(false);
      expect(fallback.x).toBe(112);
      expect(fallback.y).toBe(312);
      expect(fallback.rect).toEqual({ left: 100, top: 300, width: 90, height: 40 });
      Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    });

    it('CommentPins uses absolute document positioning in CSS, keeps pins mounted at (0, 0), and skips document-scroll re-renders', async () => {
      const hostRule = BASE_CSS.match(/:host\s*\{[\s\S]*?\}/)?.[0] ?? '';
      expect(hostRule).toContain('position: absolute;');
      const pinCssRule = COMPOSER_CSS.match(/\/\* Comment Pins on Canvas \*\/\s*\.ve-pin\s*\{[\s\S]*?transform:/)?.[0] ?? '';
      expect(pinCssRule).toContain('position: absolute;');
      expect(COMPOSER_CSS).toContain('.ve-pins-layer {');

      const mount = document.createElement('div');
      document.body.appendChild(mount);

      const originTarget = document.createElement('div');
      originTarget.id = 'origin-pin-target';
      const originRectSpy = vi.fn(
        () => ({ left: -12, top: -12, width: 80, height: 40, right: 68, bottom: 28, x: -12, y: -12, toJSON: () => {} } as DOMRect)
      );
      originTarget.getBoundingClientRect = originRectSpy;
      document.body.appendChild(originTarget);

      state.handleRouteChange('/');
      state.addComment('Zero coordinate pin', originTarget);

      render(h(CommentPins, {}), mount);
      await flushRender();

      const renderedPin = mount.querySelector('.ve-pin') as HTMLElement | null;
      expect(renderedPin).not.toBeNull();
      expect(renderedPin!.style.left).toBe('0px');
      expect(renderedPin!.style.top).toBe('0px');

      // Normal document scroll must NOT re-render or re-measure document-anchored pins
      originRectSpy.mockClear();
      document.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(originRectSpy).not.toHaveBeenCalled();

      // Nested scrollable container scroll SHOULD schedule a pin position sync
      const scrollBox = document.createElement('div');
      scrollBox.style.overflowY = 'auto';
      Object.defineProperty(scrollBox, 'scrollHeight', { value: 600, configurable: true });
      Object.defineProperty(scrollBox, 'clientHeight', { value: 200, configurable: true });
      const nestedTarget = document.createElement('p');
      nestedTarget.id = 'nested-scroll-target';
      const nestedRectSpy = vi.fn(
        () => ({ left: 30, top: 80, width: 120, height: 24, right: 150, bottom: 104, x: 30, y: 80, toJSON: () => {} } as DOMRect)
      );
      nestedTarget.getBoundingClientRect = nestedRectSpy;
      scrollBox.appendChild(nestedTarget);
      document.body.appendChild(scrollBox);

      state.addComment('Nested pin', nestedTarget);
      await flushRender();
      nestedRectSpy.mockClear();

      scrollBox.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(nestedRectSpy).toHaveBeenCalled();

      render(null, mount);
    });

    it('parseTranslateOffset and clampPinDragOffset parse CSS translate values and bound peek offsets to viewport', () => {
      expect(parseTranslateOffset(null)).toEqual({ dx: 0, dy: 0 });
      expect(parseTranslateOffset('')).toEqual({ dx: 0, dy: 0 });
      expect(parseTranslateOffset('none')).toEqual({ dx: 0, dy: 0 });
      expect(parseTranslateOffset('40px')).toEqual({ dx: 40, dy: 0 });
      expect(parseTranslateOffset('40px -25px')).toEqual({ dx: 40, dy: -25 });
      expect(parseTranslateOffset('12.5px 8px 0px')).toEqual({ dx: 12.5, dy: 8 });

      // Clamped inside [16, viewport - 16] around homeCenter
      expect(clampPinDragOffset(80, 45, 200, 180, 1000, 800, 16)).toEqual({ dx: 80, dy: 45 });
      expect(clampPinDragOffset(-500, 900, 200, 180, 1000, 800, 16)).toEqual({
        dx: -184,
        dy: 604,
      });
      // When viewport <= margin * 2, leaves offsets unclamped safely
      expect(clampPinDragOffset(80, 45, 20, 20, 30, 30, 16)).toEqual({ dx: 80, dy: 45 });
    });

    it('CommentPins supports uniform drag-to-peek without a tether line, keeps cursor pointer on hover, snaps back on release, and preserves click editing', async () => {
      const pinCssRule = COMPOSER_CSS.match(/\/\* Comment Pins on Canvas \*\/\s*\.ve-pin\s*\{[\s\S]*?transform:/)?.[0] ?? '';
      expect(pinCssRule).toContain('cursor: pointer;');
      expect(pinCssRule).not.toContain('cursor: grab;');
      expect(COMPOSER_CSS).not.toContain('.ve-pin-drag-tether');
      expect(COMPOSER_CSS).not.toContain('inset-block-end: -16px');
      expect(COMPOSER_CSS).not.toContain('inset-block-start: -16px');
      expect(LIQUID_GLASS_CSS).not.toContain('cursor: grab;');
      expect(LIQUID_GLASS_CSS).toMatch(/\.ve-root\.ve-glass-liquid \.ve-pin-label\s*\{[^}]*pointer-events:\s*none;/);

      const mount = document.createElement('div');
      document.body.appendChild(mount);

      const target = document.createElement('button');
      target.id = 'drag-comment-target';
      target.getBoundingClientRect = () =>
        ({ left: 188, top: 168, width: 120, height: 32, right: 308, bottom: 200, x: 188, y: 168, toJSON: () => {} } as DOMRect);
      document.body.appendChild(target);

      state.handleRouteChange('/');
      state.addComment('Obscured text under pin', target);

      render(h(CommentPins, {}), mount);
      await flushRender();

      const pin = mount.querySelector('.ve-pin') as HTMLElement;
      expect(pin).not.toBeNull();
      pin.getBoundingClientRect = () =>
        ({ left: 185, top: 165, width: 30, height: 30, right: 215, bottom: 195, x: 185, y: 165, toJSON: () => {} } as DOMRect);

      // Hover first so tooltip is open, verify pointerdown inside tooltip does NOT start pin drag
      pin.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await flushRender();
      const tooltip = mount.querySelector('.ve-pin-tooltip') as HTMLElement;
      expect(tooltip).not.toBeNull();

      tooltip.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 210, clientY: 140, pointerId: 1 })
      );
      window.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 280, clientY: 200, pointerId: 1 })
      );
      await flushRender();
      expect(pin.classList.contains('ve-dragging')).toBe(false);
      expect(mount.querySelector('.ve-pin-drag-tether')).toBeNull();
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));

      // Drag >= 4px activates dragging, sets translate without rendering any tether, and hides tooltip
      pin.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 191, pointerId: 2 })
      );
      window.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 280, clientY: 236, pointerId: 2 })
      );
      await flushRender();

      expect(pin.classList.contains('ve-dragging')).toBe(true);
      expect(pin.style.translate).toBe('80px 45px');
      expect(mount.querySelector('.ve-pin-drag-tether')).toBeNull();
      expect(mount.querySelector('.ve-pin-tooltip')).toBeNull();

      // Releasing removes dragging, starts snapping to 0px 0px, and suppresses follow-up click
      window.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 280, clientY: 236, pointerId: 2 })
      );
      expect(pin.classList.contains('ve-dragging')).toBe(false);
      expect(pin.classList.contains('ve-snapping')).toBe(true);
      expect(pin.style.translate).toBe('0px 0px');

      pin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushRender();
      expect(mount.querySelector('.ve-pin-drag-tether')).toBeNull();
      expect(mount.querySelector('textarea')).toBeNull();

      // Plain click (< 4px move) after suppressed window expires opens edit textarea normally
      await new Promise((resolve) => setTimeout(resolve, 100));
      pin.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 180, pointerId: 3 })
      );
      window.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 201, clientY: 181, pointerId: 3 })
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 201, clientY: 181, pointerId: 3 })
      );
      pin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushRender();
      expect(mount.querySelector('textarea')).not.toBeNull();

      render(null, mount);
    });

    it('VoicePins supports drag-to-peek without a tether and snaps back to 0px 0px on release', async () => {
      const mount = document.createElement('div');
      document.body.appendChild(mount);

      const target = document.createElement('button');
      target.id = 'voice-drag-target';
      target.getBoundingClientRect = () =>
        ({ left: 160, top: 220, width: 140, height: 40, right: 300, bottom: 260, x: 160, y: 220, toJSON: () => {} } as DOMRect);
      document.body.appendChild(target);

      state.handleRouteChange('/');
      state.activeTool = 'voice';
      state.activeVoicePins = [
        { id: 'vp_drag', order: 1, targetSelector: '#voice-drag-target', pathname: '/', bounds: { x: 160, y: 220, width: 140, height: 40 } },
      ];

      render(h(VoicePins, {}), mount);
      await flushRender();

      const voicePin = mount.querySelector('.ve-voice-pin') as HTMLElement;
      expect(voicePin).not.toBeNull();
      voicePin.getBoundingClientRect = () =>
        ({ left: 160, top: 206, width: 76, height: 24, right: 236, bottom: 230, x: 160, y: 206, toJSON: () => {} } as DOMRect);

      voicePin.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 198, clientY: 218, pointerId: 1 })
      );
      window.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 268, clientY: 258, pointerId: 1 })
      );
      await flushRender();

      expect(voicePin.classList.contains('ve-dragging')).toBe(true);
      expect(voicePin.style.translate).toBe('70px 40px');
      expect(mount.querySelector('.ve-pin-drag-tether')).toBeNull();

      window.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 268, clientY: 258, pointerId: 1 })
      );
      expect(voicePin.classList.contains('ve-dragging')).toBe(false);
      expect(voicePin.classList.contains('ve-snapping')).toBe(true);
      expect(voicePin.style.translate).toBe('0px 0px');

      await flushRender();
      expect(mount.querySelector('.ve-pin-drag-tether')).toBeNull();

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
