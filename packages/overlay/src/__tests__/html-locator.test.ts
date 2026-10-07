// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { generateCssSelector, generateXPath } from '../source-locator/html-locator.js';

describe('html-locator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('generateCssSelector', () => {
    it('returns ID selector for element with id', () => {
      document.body.innerHTML = '<button id="submit-btn">Click me</button>';
      const el = document.getElementById('submit-btn')!;
      expect(generateCssSelector(el)).toBe('#submit-btn');
    });

    it('escapes special characters in id using CSS.escape', () => {
      document.body.innerHTML = '<div id="item.123:test">Content</div>';
      const el = document.getElementById('item.123:test')!;
      const selector = generateCssSelector(el);
      expect(selector).toBe(`#${CSS.escape('item.123:test')}`);
    });

    it('generates hierarchy for nested elements without id', () => {
      document.body.innerHTML = `
        <main>
          <section>
            <p>Hello world</p>
          </section>
        </main>
      `;
      const p = document.querySelector('p')!;
      expect(generateCssSelector(p)).toBe('main > section > p');
    });

    it('includes class names while excluding internal visual-edit- classes and classes with colons', () => {
      document.body.innerHTML = `
        <div>
          <button class="btn btn-primary visual-edit-highlight hover:bg-blue-500">Action</button>
        </div>
      `;
      const btn = document.querySelector('button')!;
      const selector = generateCssSelector(btn);
      expect(selector).toContain('button.btn.btn-primary');
      expect(selector).not.toContain('visual-edit-highlight');
      expect(selector).not.toContain('hover:bg-blue-500');
    });

    it('appends :nth-of-type index when sibling elements share the same tag', () => {
      document.body.innerHTML = `
        <ul>
          <li>First</li>
          <li>Second</li>
          <li>Third</li>
        </ul>
      `;
      const items = document.querySelectorAll('li');
      expect(generateCssSelector(items[0])).toBe('ul > li:nth-of-type(1)');
      expect(generateCssSelector(items[1])).toBe('ul > li:nth-of-type(2)');
      expect(generateCssSelector(items[2])).toBe('ul > li:nth-of-type(3)');
    });

    it('stops traversal at ancestor with id', () => {
      document.body.innerHTML = `
        <div id="container">
          <section>
            <span>Target</span>
          </section>
        </div>
      `;
      const span = document.querySelector('span')!;
      expect(generateCssSelector(span)).toBe('#container > section > span');
    });
  });

  describe('generateXPath', () => {
    it('returns shortcut xpath for element with id', () => {
      document.body.innerHTML = '<header id="top-nav">Nav</header>';
      const el = document.getElementById('top-nav')!;
      expect(generateXPath(el)).toBe('//*[@id="top-nav"]');
    });

    it('returns /html/body for document.body', () => {
      expect(generateXPath(document.body)).toBe('/html/body');
    });

    it('computes accurate hierarchical xpath with sibling indices', () => {
      document.body.innerHTML = `
        <div class="content">
          <p>Para 1</p>
          <p id="target-p">Para 2</p>
          <div>Div inside</div>
          <p>Para 3</p>
        </div>
      `;
      const lastP = document.querySelectorAll('p')[2];
      const xpath = generateXPath(lastP);
      expect(xpath).toBe('/html/body/div[1]/p[3]');
    });
  });
});
