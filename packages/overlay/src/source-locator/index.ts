import { SourceLocation } from '@visual-edit/core';
import { resolveReactSource } from './react-fiber.js';
import { generateCssSelector, generateXPath } from './html-locator.js';

export function getElementHtmlSnippet(element: HTMLElement): string {
  try {
    const clone = element.cloneNode(true) as HTMLElement;
    // If children are huge, trim innerHTML
    if (clone.children.length > 3) {
      return `<${element.tagName.toLowerCase()}${element.id ? ` id="${element.id}"` : ''}${element.className ? ` class="${element.className}"` : ''}>...</${element.tagName.toLowerCase()}>`;
    }
    const outer = clone.outerHTML.replace(/\s+/g, ' ').trim();
    if (outer.length > 120) {
      return outer.slice(0, 117) + '...>';
    }
    return outer;
  } catch (e) {
    return `<${element.tagName.toLowerCase()}>`;
  }
}

export function resolveSourceLocation(element: HTMLElement): SourceLocation {
  const reactLoc = resolveReactSource(element);
  const selector = generateCssSelector(element);
  const xpath = generateXPath(element);
  const htmlSnippet = getElementHtmlSnippet(element);

  const classes = typeof element.className === 'string'
    ? element.className.trim().split(/\s+/).filter(Boolean)
    : [];

  return {
    fileName: reactLoc?.fileName,
    lineNumber: reactLoc?.lineNumber,
    columnNumber: reactLoc?.columnNumber,
    componentName: reactLoc?.componentName,
    framework: reactLoc?.framework || (window as any).React ? 'react' : 'html',
    selector,
    xpath,
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    classes,
    htmlSnippet,
  };
}
