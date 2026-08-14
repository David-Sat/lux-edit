import { h, render } from 'preact';
import { OverlayRoot } from './overlay-root.js';

class VisualEditOverlayElement extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    render(h(OverlayRoot, { shadowRoot: this.shadow }), this.shadow);
  }

  disconnectedCallback() {
    render(null, this.shadow);
  }
}

if (typeof window !== 'undefined') {
  if (!customElements.get('visual-edit-overlay')) {
    customElements.define('visual-edit-overlay', VisualEditOverlayElement);
  }

  const mountOverlay = () => {
    if (!document.querySelector('visual-edit-overlay')) {
      const overlayEl = document.createElement('visual-edit-overlay');
      document.body.appendChild(overlayEl);
      console.log('[visual-edit] Live Visual Edit Overlay initialized.');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountOverlay);
  } else {
    mountOverlay();
  }
}

export { VisualEditOverlayElement };
