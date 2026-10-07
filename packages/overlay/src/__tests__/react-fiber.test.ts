// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveReactSource } from '../source-locator/react-fiber.js';
import { resolveSourceLocation, getElementHtmlSnippet } from '../source-locator/index.js';

describe('react-fiber locator and source resolution', () => {
  let element: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    element = document.createElement('button');
    element.id = 'cta-btn';
    element.className = 'btn primary';
    element.textContent = 'Sign up';
    document.body.appendChild(element);
  });

  describe('resolveReactSource', () => {
    it('returns null when no react fiber instance is present on element', () => {
      const source = resolveReactSource(element);
      expect(source).toBeNull();
    });

    it('extracts source info when _debugSource is directly on the fiber', () => {
      function CtaButton() {}
      (element as any)['__reactFiber$12345'] = {
        type: CtaButton,
        _debugSource: {
          fileName: 'src/components/CtaButton.tsx',
          lineNumber: 42,
          columnNumber: 10,
        },
        return: null,
      };

      const source = resolveReactSource(element);
      expect(source).toEqual({
        fileName: 'src/components/CtaButton.tsx',
        lineNumber: 42,
        columnNumber: 10,
        componentName: 'CtaButton',
        framework: 'react',
      });
    });

    it('climbs fiber.return to locate _debugSource from parent component', () => {
      function HeroBanner() {}
      HeroBanner.displayName = 'HeroBannerComponent';

      const parentFiber = {
        type: HeroBanner,
        _debugSource: {
          fileName: 'src/sections/HeroBanner.tsx',
          lineNumber: 18,
          columnNumber: 4,
        },
        return: null,
      };

      // Native DOM host fiber (e.g. 'button') pointing to parent
      (element as any)['__reactFiber$abc'] = {
        type: 'button',
        _debugSource: null,
        return: parentFiber,
      };

      const source = resolveReactSource(element);
      expect(source).toEqual({
        fileName: 'src/sections/HeroBanner.tsx',
        lineNumber: 18,
        columnNumber: 4,
        componentName: 'HeroBannerComponent',
        framework: 'react',
      });
    });

    it('falls back to componentName and framework: react when _debugSource is absent', () => {
      const ForwardRefComponent = {
        displayName: 'CustomInput',
        render: { name: 'InputRender' },
      };

      (element as any)['__reactInternalInstance$xyz'] = {
        type: ForwardRefComponent,
        _debugSource: null,
        return: null,
      };

      const source = resolveReactSource(element);
      expect(source).toEqual({
        componentName: 'CustomInput',
        framework: 'react',
      });
    });

    it('handles legacy __reactInternalInstance$ prefix', () => {
      function Header() {}
      (element as any)['__reactInternalInstance$old'] = {
        type: Header,
        _debugSource: {
          fileName: 'src/Header.jsx',
          lineNumber: 5,
          columnNumber: 1,
        },
        return: null,
      };

      const source = resolveReactSource(element);
      expect(source?.fileName).toBe('src/Header.jsx');
      expect(source?.componentName).toBe('Header');
    });

    it('returns null and does not throw when fiber getter throws error', () => {
      Object.defineProperty(element, '__reactFiber$err', {
        get() {
          throw new Error('Access denied');
        },
      });

      const source = resolveReactSource(element);
      expect(source).toBeNull();
    });
  });

  describe('getElementHtmlSnippet and resolveSourceLocation', () => {
    it('trims snippet if element contains many children', () => {
      element.innerHTML = '<span>1</span><span>2</span><span>3</span><span>4</span>';
      const snippet = getElementHtmlSnippet(element);
      expect(snippet).toBe('<button id="cta-btn" class="btn primary">...</button>');
    });

    it('truncates snippet when outerHTML exceeds 120 chars', () => {
      element.textContent = 'A'.repeat(200);
      const snippet = getElementHtmlSnippet(element);
      expect(snippet.length).toBeLessThanOrEqual(121);
      expect(snippet.endsWith('...>')).toBe(true);
    });

    it('resolves complete SourceLocation structure', () => {
      function Modal() {}
      (element as any)['__reactFiber$test'] = {
        type: Modal,
        _debugSource: {
          fileName: 'src/Modal.tsx',
          lineNumber: 15,
          columnNumber: 2,
        },
        return: null,
      };

      const loc = resolveSourceLocation(element);
      expect(loc.fileName).toBe('src/Modal.tsx');
      expect(loc.lineNumber).toBe(15);
      expect(loc.componentName).toBe('Modal');
      expect(loc.framework).toBe('react');
      expect(loc.selector).toBe('#cta-btn');
      expect(loc.tag).toBe('button');
      expect(loc.id).toBe('cta-btn');
      expect(loc.classes).toEqual(['btn', 'primary']);
    });
  });
});
