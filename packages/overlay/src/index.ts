import { h, render } from 'preact';
import { OverlayRoot } from './overlay-root.js';
import { OverlayStateManager } from './inspector/state.js';

interface LuxWindow extends Window {
  __LUX_OVERLAY_INITIALIZED__?: boolean;
}

type PatchedHistoryMethod = History['pushState'] & { __luxPatched?: boolean };

class VisualEditOverlayElement extends HTMLElement {
  private shadow: ShadowRoot;
  private teardownTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (this.teardownTimeout) {
      clearTimeout(this.teardownTimeout);
      this.teardownTimeout = null;
    }
    render(h(OverlayRoot, { shadowRoot: this.shadow }), this.shadow);
  }

  disconnectedCallback() {
    // Delay teardown so transient detachment during SPA page transitions
    // (Astro View Transitions, Turbo, Next.js) preserves UI state
    this.teardownTimeout = setTimeout(() => {
      render(null, this.shadow);
      this.teardownTimeout = null;
    }, 100);
  }
}

if (typeof window !== 'undefined') {
  if (!customElements.get('visual-edit-overlay')) {
    customElements.define('visual-edit-overlay', VisualEditOverlayElement);
  }

  const luxWin = window as LuxWindow;
  if (!luxWin.__LUX_OVERLAY_INITIALIZED__) {
    luxWin.__LUX_OVERLAY_INITIALIZED__ = true;

    let overlayInstance: HTMLElement | null = null;

    const getOrCreateOverlay = (): HTMLElement => {
      if (!overlayInstance) {
        const existing = document.getElementById('lux-root');
        if (existing && existing.tagName.toLowerCase() === 'visual-edit-overlay') {
          overlayInstance = existing;
        } else {
          overlayInstance = document.createElement('visual-edit-overlay');
          overlayInstance.id = 'lux-root';
          // Declarative framework persistence attributes
          overlayInstance.setAttribute('data-astro-transition-persist', 'lux-overlay');
          overlayInstance.setAttribute('data-astro-rerun', 'false');
          overlayInstance.setAttribute('data-turbo-permanent', '');
          overlayInstance.setAttribute('data-swup-persist', 'lux-overlay');
        }
      }
      return overlayInstance;
    };

    const mountOverlay = () => {
      if (!document.body) return;
      const overlayEl = getOrCreateOverlay();
      if (!overlayEl.isConnected || !document.body.contains(overlayEl)) {
        document.body.appendChild(overlayEl);
        console.log('[lux] Live User eXperience Overlay mounted.');
      }
    };

    const handleNavigation = () => {
      mountOverlay();
      try {
        OverlayStateManager.getInstance().handleRouteChange();
      } catch (err) {
        console.debug('[lux] Route change sync failed:', err);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountOverlay);
    } else {
      mountOverlay();
    }

    // 1. Astro View Transitions & <ClientRouter /> lifecycle events
    document.addEventListener('astro:after-swap', handleNavigation);
    document.addEventListener('astro:page-load', handleNavigation);

    // 2. Hotwired Turbo / Turbolinks lifecycle events
    document.addEventListener('turbo:render', handleNavigation);
    document.addEventListener('turbo:load', handleNavigation);

    // 3. Browser history navigation (popstate & hashchange)
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);

    // 4. Intercept history.pushState / history.replaceState for React Router, Next.js, Vue Router
    try {
      const wrapHistoryMethod = (type: 'pushState' | 'replaceState') => {
        const orig = history[type] as PatchedHistoryMethod;
        if (typeof orig === 'function' && !orig.__luxPatched) {
          const wrapped: PatchedHistoryMethod = function (this: History, ...args: Parameters<History['pushState']>) {
            const result = orig.apply(this, args);
            queueMicrotask(handleNavigation);
            return result;
          };
          wrapped.__luxPatched = true;
          history[type] = wrapped;
        }
      };
      wrapHistoryMethod('pushState');
      wrapHistoryMethod('replaceState');
    } catch (err) {
      console.debug('[lux] History navigation hooks unavailable in this environment:', err);
    }

    // 5. MutationObserver fallback to re-attach if body is replaced or cleared
    try {
      const observer = new MutationObserver(() => {
        if (document.body && overlayInstance && !overlayInstance.isConnected) {
          mountOverlay();
        }
      });

      const observeBody = () => {
        if (document.documentElement) {
          observer.observe(document.documentElement, { childList: true });
        }
        if (document.body) {
          observer.observe(document.body, { childList: true });
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeBody);
      } else {
        observeBody();
      }
    } catch (err) {
      console.debug('[lux] Failed to attach overlay MutationObserver:', err);
    }
  }
}

export { VisualEditOverlayElement };
