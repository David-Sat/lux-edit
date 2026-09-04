import { h, render } from 'preact';
import { OverlayRoot } from './overlay-root.js';

class VisualEditOverlayElement extends HTMLElement {
  private shadow: ShadowRoot;
  private teardownTimeout: any = null;

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

  let overlayInstance: HTMLElement | null = null;

  const getOrCreateOverlay = (): HTMLElement => {
    if (!overlayInstance) {
      overlayInstance = document.createElement('visual-edit-overlay');
      overlayInstance.id = 'lux-root';
      // Declarative framework persistence attributes
      overlayInstance.setAttribute('data-astro-transition-persist', 'lux-overlay');
      overlayInstance.setAttribute('data-astro-rerun', 'false');
      overlayInstance.setAttribute('data-turbo-permanent', '');
      overlayInstance.setAttribute('data-swup-persist', 'lux-overlay');
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountOverlay);
  } else {
    mountOverlay();
  }

  // 1. Astro View Transitions & <ClientRouter /> lifecycle events
  document.addEventListener('astro:after-swap', mountOverlay);
  document.addEventListener('astro:page-load', mountOverlay);

  // 2. Hotwired Turbo / Turbolinks lifecycle events
  document.addEventListener('turbo:render', mountOverlay);
  document.addEventListener('turbo:load', mountOverlay);

  // 3. Browser history navigation (popstate)
  window.addEventListener('popstate', mountOverlay);

  // 4. Intercept history.pushState / history.replaceState for React Router, Next.js, Vue Router
  try {
    const wrapHistoryMethod = (type: 'pushState' | 'replaceState') => {
      const orig = history[type];
      if (typeof orig === 'function') {
        history[type] = function (data: any, unused: string, url?: string | URL | null) {
          const result = orig.call(this, data, unused, url);
          queueMicrotask(mountOverlay);
          return result;
        };
      }
    };
    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');
  } catch (e) {}

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
  } catch (e) {}
}

export { VisualEditOverlayElement };
