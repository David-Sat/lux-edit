export function generateCssSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const className = current.className;
    if (typeof className === 'string' && className.trim()) {
      const primaryClasses = className
        .trim()
        .split(/\s+/)
        .filter((c) => !c.startsWith('visual-edit-') && !c.includes(':'))
        .slice(0, 2);
      if (primaryClasses.length > 0) {
        selector += `.${primaryClasses.map((c) => CSS.escape(c)).join('.')}`;
      }
    }

    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children).filter(
        (c) => c.tagName === current?.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ') || element.tagName.toLowerCase();
}

export function generateXPath(element: HTMLElement): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  if (element === document.body) {
    return '/html/body';
  }

  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.nodeName === element.nodeName) {
      index++;
    }
    sibling = sibling.previousElementSibling;
  }

  const parentXPath = element.parentElement ? generateXPath(element.parentElement) : '';
  return `${parentXPath}/${element.nodeName.toLowerCase()}[${index}]`;
}
