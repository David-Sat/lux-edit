import {
  MutationRecord,
  SourceLocation,
  computeTargetHash,
  computeStyleDiff,
  computeTextDiff,
  computeClassDiff,
} from '@visual-edit/core';
import { resolveSourceLocation } from '../source-locator/index.js';
import { isAnnotationOnRoute, normalizeRoute } from './route-utils.js';

export interface ElementSnapshot {
  text: string;
  styles: Record<string, string>;
  classes: string[];
  sourceLocation: SourceLocation;
  originalStyleAttr?: string | null;
}

export interface PageMetadata {
  pathname: string;
  url: string;
}

export class DomMutationManager {
  private snapshots = new Map<HTMLElement, ElementSnapshot>();

  public getSnapshot(el: HTMLElement): ElementSnapshot | undefined {
    return this.snapshots.get(el);
  }

  public getSnapshots(): Map<HTMLElement, ElementSnapshot> {
    return this.snapshots;
  }

  public captureInitialSnapshot(el: HTMLElement): void {
    if (this.snapshots.has(el)) return;

    const sourceLocation = resolveSourceLocation(el);
    const computed = window.getComputedStyle(el);
    const styles: Record<string, string> = {
      padding: computed.padding,
      'padding-top': computed.paddingTop,
      'padding-bottom': computed.paddingBottom,
      'padding-left': computed.paddingLeft,
      'padding-right': computed.paddingRight,
      margin: computed.margin,
      'margin-top': computed.marginTop,
      'margin-bottom': computed.marginBottom,
      'margin-left': computed.marginLeft,
      'margin-right': computed.marginRight,
      'font-size': computed.fontSize,
      'font-weight': computed.fontWeight,
      color: computed.color,
      'background-color': computed.backgroundColor,
      display: computed.display,
      'flex-direction': computed.flexDirection,
      gap: computed.gap,
      'justify-content': computed.justifyContent,
      'align-items': computed.alignItems,
      'border-radius': computed.borderRadius,
      'border-width': computed.borderWidth,
      'text-align': computed.textAlign,
    };

    const classes = typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];

    this.snapshots.set(el, {
      text: (el.textContent || el.innerText || '').trim(),
      styles,
      classes,
      sourceLocation,
      originalStyleAttr: el.getAttribute('style'),
    });
  }

  public resetElementProperty(el: HTMLElement, property: string): void {
    const snapshot = this.snapshots.get(el);
    if (!snapshot) return;
    if (snapshot.styles[property] !== undefined && snapshot.styles[property] !== '') {
      el.style.setProperty(property, snapshot.styles[property]);
    } else {
      el.style.removeProperty(property);
    }
  }

  public updateElementStyle(el: HTMLElement, property: string, value: string): void {
    el.style.setProperty(property, value);
  }

  public updateElementText(el: HTMLElement, newText: string): void {
    if (newText.includes('\n') && el.style.whiteSpace !== 'pre-wrap') {
      el.style.whiteSpace = 'pre-wrap';
    }
    el.textContent = newText;
  }

  public addClass(el: HTMLElement, className: string): void {
    const trimmed = className.trim();
    if (trimmed) {
      el.classList.add(trimmed);
    }
  }

  public removeClass(el: HTMLElement, className: string): void {
    const trimmed = className.trim();
    if (trimmed) {
      el.classList.remove(trimmed);
    }
  }

  public deleteElement(el: HTMLElement, pageMeta: PageMetadata): MutationRecord {
    const sourceLocation = resolveSourceLocation(el);
    const selector = sourceLocation.selector;
    const outerHtml = el.outerHTML;

    el.remove();
    return {
      id: `mut_del_${Date.now()}`,
      type: 'DOM_REMOVE',
      targetSelector: selector,
      targetHash: computeTargetHash({ selector, htmlSnippet: outerHtml.slice(0, 200) }),
      sourceLocation,
      before: outerHtml,
      after: '',
      ...pageMeta,
    };
  }

  public duplicateElement(
    el: HTMLElement,
    pageMeta: PageMetadata
  ): { clone: HTMLElement; mutation: MutationRecord } {
    const clone = el.cloneNode(true) as HTMLElement;
    if (clone.id) {
      clone.id = `${clone.id}-copy`;
    }
    clone.querySelectorAll('[id]').forEach((child) => {
      if (child.id) child.id = `${child.id}-copy`;
    });
    el.parentElement!.insertBefore(clone, el.nextSibling);

    const sourceLocation = resolveSourceLocation(clone);
    const mutation: MutationRecord = {
      id: `mut_dup_${Date.now()}`,
      type: 'DOM_INSERT',
      targetSelector: sourceLocation.selector,
      targetHash: computeTargetHash({ selector: sourceLocation.selector, htmlSnippet: clone.outerHTML.slice(0, 200) }),
      sourceLocation,
      before: '',
      after: clone.outerHTML,
      ...pageMeta,
    };
    return { clone, mutation };
  }

  public moveElement(
    el: HTMLElement,
    direction: 'up' | 'down',
    pageMeta: PageMetadata
  ): MutationRecord | null {
    if (!el.parentElement) return null;
    const parent = el.parentElement;
    const siblings = Array.from(parent.children);
    const currentIndex = siblings.indexOf(el);

    if (direction === 'up' && currentIndex > 0) {
      parent.insertBefore(el, siblings[currentIndex - 1]);
      return this.createReorderMutation(el, currentIndex, currentIndex - 1, pageMeta);
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      parent.insertBefore(el, siblings[currentIndex + 1].nextSibling);
      return this.createReorderMutation(el, currentIndex, currentIndex + 1, pageMeta);
    }
    return null;
  }

  private createReorderMutation(
    el: HTMLElement,
    beforeIndex: number,
    afterIndex: number,
    pageMeta: PageMetadata
  ): MutationRecord {
    const sourceLocation = resolveSourceLocation(el);
    return {
      id: `mut_reord_${Date.now()}`,
      type: 'DOM_REORDER',
      targetSelector: sourceLocation.selector,
      targetHash: computeTargetHash({ selector: sourceLocation.selector }),
      sourceLocation,
      before: `${beforeIndex}`,
      after: `${afterIndex}`,
      ...pageMeta,
    };
  }

  public syncMutationsForElement(
    el: HTMLElement,
    existingMutations: MutationRecord[],
    pageMeta: PageMetadata
  ): MutationRecord[] {
    const snapshot = this.snapshots.get(el);
    if (!snapshot) return existingMutations;

    const sourceLocation = resolveSourceLocation(el);
    const selector = sourceLocation.selector;
    const currentNormRoute = normalizeRoute(pageMeta.pathname);

    const filtered = existingMutations.filter((m) => {
      if (
        m.type === 'DOM_REMOVE' ||
        m.type === 'DOM_REORDER' ||
        m.type === 'DOM_INSERT'
      ) {
        return true;
      }
      const sameRoute = !m.pathname || normalizeRoute(m.pathname) === currentNormRoute;
      return !(m.targetSelector === selector && sameRoute);
    });

    const newMutations: MutationRecord[] = [];

    const textDiff = computeTextDiff(snapshot.text, el.innerText || '', selector, sourceLocation);
    if (textDiff) {
      Object.assign(textDiff, pageMeta);
      newMutations.push(textDiff);
    }

    const currentComputed = window.getComputedStyle(el);
    const currentStyles: Record<string, string> = {
      padding: currentComputed.padding,
      'padding-top': currentComputed.paddingTop,
      'padding-bottom': currentComputed.paddingBottom,
      'padding-left': currentComputed.paddingLeft,
      'padding-right': currentComputed.paddingRight,
      margin: currentComputed.margin,
      'margin-top': currentComputed.marginTop,
      'margin-bottom': currentComputed.marginBottom,
      'margin-left': currentComputed.marginLeft,
      'margin-right': currentComputed.marginRight,
      'font-size': currentComputed.fontSize,
      'font-weight': currentComputed.fontWeight,
      color: currentComputed.color,
      'background-color': currentComputed.backgroundColor,
      display: currentComputed.display,
      'flex-direction': currentComputed.flexDirection,
      gap: currentComputed.gap,
      'justify-content': currentComputed.justifyContent,
      'align-items': currentComputed.alignItems,
      'border-radius': currentComputed.borderRadius,
      'border-width': currentComputed.borderWidth,
      'text-align': currentComputed.textAlign,
    };

    const styleDiffs = computeStyleDiff(snapshot.styles, currentStyles, selector, sourceLocation);
    styleDiffs.forEach((m: MutationRecord) => {
      Object.assign(m, pageMeta);
    });
    newMutations.push(...styleDiffs);

    const currentClasses = typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];
    const classDiffs = computeClassDiff(snapshot.classes, currentClasses, selector, sourceLocation);
    classDiffs.forEach((m: MutationRecord) => {
      Object.assign(m, pageMeta);
    });
    newMutations.push(...classDiffs);

    return [...filtered, ...newMutations];
  }

  public revertMutation(
    mutationId: string,
    existingMutations: MutationRecord[],
    currentPathname: string,
    activeElement: HTMLElement | null
  ): {
    remainingMutations: MutationRecord[];
    clearActive: boolean;
    needSyncTarget: HTMLElement | null;
  } {
    const mutation = existingMutations.find((m) => m.id === mutationId);
    if (!mutation) {
      return { remainingMutations: existingMutations, clearActive: false, needSyncTarget: null };
    }

    let targetEl: HTMLElement | null = null;
    const isMutationOnCurrentRoute =
      !mutation.pathname ||
      isAnnotationOnRoute({ pathname: mutation.pathname, url: mutation.url }, currentPathname);

    if (mutation.targetSelector && isMutationOnCurrentRoute && typeof document !== 'undefined') {
      try {
        targetEl = document.querySelector(mutation.targetSelector) as HTMLElement | null;
      } catch (e) {}
    }

    let clearActive = false;
    let needSyncTarget: HTMLElement | null = null;

    if (targetEl) {
      const snapshot = this.snapshots.get(targetEl);
      if (mutation.type === 'CLASS_CHANGE' && mutation.details) {
        if (mutation.details.added) {
          (mutation.details.added as string[]).forEach((c: string) => targetEl!.classList.remove(c));
        }
        if (mutation.details.removed) {
          (mutation.details.removed as string[]).forEach((c: string) => targetEl!.classList.add(c));
        }
      } else if (mutation.type === 'STYLE_CHANGE' && mutation.property) {
        if (snapshot && snapshot.styles[mutation.property] !== undefined && snapshot.styles[mutation.property] !== '') {
          targetEl.style.setProperty(mutation.property, snapshot.styles[mutation.property]);
        } else {
          targetEl.style.removeProperty(mutation.property);
        }
      } else if (mutation.type === 'TEXT_EDIT') {
        if (snapshot) {
          if ('innerText' in targetEl && targetEl.tagName.toLowerCase() !== 'text' && targetEl.tagName.toLowerCase() !== 'tspan') {
            targetEl.innerText = snapshot.text;
          } else {
            targetEl.textContent = snapshot.text;
          }
        } else if (mutation.before) {
          if ('innerText' in targetEl && targetEl.tagName.toLowerCase() !== 'text' && targetEl.tagName.toLowerCase() !== 'tspan') {
            targetEl.innerText = mutation.before;
          } else {
            targetEl.textContent = mutation.before;
          }
        }
      } else if (mutation.type === 'DOM_INSERT') {
        targetEl.remove();
        if (activeElement === targetEl) {
          clearActive = true;
        }
      }

      if (activeElement === targetEl && document.body.contains(targetEl)) {
        needSyncTarget = targetEl;
      }
    }

    const remainingMutations = existingMutations.filter((m) => m.id !== mutationId);
    return { remainingMutations, clearActive, needSyncTarget };
  }

  public revertAll(): void {
    for (const [el, snapshot] of this.snapshots.entries()) {
      if (document.body.contains(el)) {
        el.innerText = snapshot.text;
        el.className = snapshot.classes.join(' ');
        if (snapshot.originalStyleAttr !== null && snapshot.originalStyleAttr !== undefined) {
          el.setAttribute('style', snapshot.originalStyleAttr);
        } else {
          el.removeAttribute('style');
        }
      }
    }
    this.snapshots.clear();
  }
}
