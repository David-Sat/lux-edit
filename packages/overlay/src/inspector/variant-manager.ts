import {
  ElementVariant,
  ElementVariantSet,
  VariantDecision,
  ReviewMode,
  API_ROUTES,
} from '@visual-edit/core';

interface VariantStyleMutationItem {
  property?: string;
  value?: unknown;
}

type VariantWithLegacyMutations = ElementVariant & {
  styleMutations?: VariantStyleMutationItem[];
};

export interface VariantOriginalSnapshot {
  styleAttr: string | null;
  className: string;
  innerHTML: string;
  textContent: string;
}

export function applySanitizedHtml(targetEl: HTMLElement, rawHtml: string): void {
  if (typeof document === 'undefined') return;
  const template = document.createElement('template');
  template.innerHTML = rawHtml;

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tag = element.tagName.toLowerCase();
      if (['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link'].includes(tag)) {
        element.remove();
        return;
      }
      for (const attr of Array.from(element.attributes)) {
        const attrName = attr.name.toLowerCase();
        const attrVal = Array.from(attr.value.replace(/\s+/g, ''))
          .filter((ch) => {
            const code = ch.charCodeAt(0);
            return code > 0x1f && code !== 0x7f;
          })
          .join('')
          .toLowerCase();
        if (
          attrName.startsWith('on') ||
          attrVal.startsWith('javascript:') ||
          attrVal.startsWith('data:') ||
          attrVal.startsWith('vbscript:')
        ) {
          element.removeAttribute(attr.name);
        }
      }
    }
    for (const child of Array.from(node.childNodes)) {
      sanitizeNode(child);
    }
  };

  sanitizeNode(template.content);
  targetEl.replaceChildren(template.content.cloneNode(true));
}

export interface VariantManagerContext {
  getVariantSets: () => ElementVariantSet[];
  setVariantSets: (sets: ElementVariantSet[]) => void;
  getVariantDecisions: () => VariantDecision[];
  setVariantDecisions: (decisions: VariantDecision[]) => void;
  getActiveVariantPreview: () => Map<string, string | null>;
  getReviewMode: () => ReviewMode;
  getWebSocket: () => WebSocket | null;
  submitBatch: () => Promise<void>;
  autoSync: () => Promise<void>;
  notify: () => void;
  basePathPrefix: string;
}

export class VariantManager {
  private originalSnapshots = new Map<string, VariantOriginalSnapshot>();
  private ctx: VariantManagerContext;

  constructor(ctx: VariantManagerContext) {
    this.ctx = ctx;
  }

  public getOriginalSnapshots(): Map<string, VariantOriginalSnapshot> {
    return this.originalSnapshots;
  }

  public clearOriginalSnapshots(keepSetIds?: Set<string>): void {
    if (!keepSetIds || keepSetIds.size === 0) {
      this.originalSnapshots.clear();
      return;
    }
    for (const key of this.originalSnapshots.keys()) {
      if (!keepSetIds.has(key)) {
        this.originalSnapshots.delete(key);
      }
    }
  }

  public previewVariant(setId: string, variantId: string | null): void {
    const vSet = this.ctx.getVariantSets().find((s) => s.id === setId);
    if (!vSet) return;

    let el: HTMLElement | null = null;
    try {
      el = document.querySelector(vSet.targetSelector) as HTMLElement | null;
    } catch {
      // Ignore invalid target selectors when resolving variant preview node.
    }
    if (!el) return;

    if (!this.originalSnapshots.has(setId)) {
      this.originalSnapshots.set(setId, {
        styleAttr: el.getAttribute('style'),
        className: typeof el.className === 'string' ? el.className : '',
        innerHTML: el.innerHTML,
        textContent: el.textContent || '',
      });
    }

    const orig = this.originalSnapshots.get(setId)!;
    // Always restore original first before applying variant
    if (orig.styleAttr !== null) {
      el.setAttribute('style', orig.styleAttr);
    } else {
      el.removeAttribute('style');
    }
    if (typeof el.className === 'string') {
      el.className = orig.className;
    }
    el.innerHTML = orig.innerHTML;

    if (variantId !== null) {
      const variant = vSet.variants.find((v) => v.id === variantId);
      if (variant) {
        const legacyVariant = variant as VariantWithLegacyMutations;
        const rawStyles = variant.styles || legacyVariant.styleMutations;
        const stylesMap: Record<string, string> = {};
        if (Array.isArray(rawStyles)) {
          for (const m of rawStyles) {
            if (m.property && m.value !== undefined) {
              stylesMap[m.property] = String(m.value);
            }
          }
        } else if (rawStyles && typeof rawStyles === 'object') {
          Object.assign(stylesMap, rawStyles);
        }

        const styleRecord = el.style as unknown as Record<string, string>;
        for (const [k, v] of Object.entries(stylesMap)) {
          el.style.setProperty(k, v, 'important');
          const camel = k.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          try {
            styleRecord[camel] = v;
          } catch {
            // Ignore read-only style properties in constrained DOM implementations.
          }
        }

        if (variant.classes) {
          if (variant.classes.remove) {
            variant.classes.remove.forEach((c) => el!.classList.remove(c));
          }
          if (variant.classes.add) {
            variant.classes.add.forEach((c) => el!.classList.add(c));
          }
        }
        if (variant.html !== undefined) {
          applySanitizedHtml(el, variant.html);
        } else if (variant.text !== undefined) {
          el.textContent = variant.text;
        }
      }
    }

    this.ctx.getActiveVariantPreview().set(setId, variantId);
    this.ctx.notify();
  }

  public decideVariant(setId: string, variantId: string, userNote?: string): void {
    const vSet = this.ctx.getVariantSets().find((s) => s.id === setId);
    if (!vSet) return;
    const variant = vSet.variants.find((v) => v.id === variantId);
    if (!variant) return;

    this.previewVariant(setId, variantId);

    const decision: VariantDecision = {
      id: `vdec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      setId,
      targetSelector: vSet.targetSelector,
      selectedVariantId: variantId,
      variantName: variant.name,
      variant,
      userNote,
      timestamp: Date.now(),
    };

    const decisions = this.ctx.getVariantDecisions();
    const existingIdx = decisions.findIndex((d) => d.setId === setId);
    if (existingIdx !== -1) {
      decisions[existingIdx] = decision;
    } else {
      decisions.push(decision);
    }
    vSet.selectedVariantId = variantId;
    vSet.status = 'decided';

    const ws = this.ctx.getWebSocket();
    const openState = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
    if (ws && ws.readyState === openState) {
      ws.send(JSON.stringify({ type: 'DECIDE_VARIANT', payload: decision }));
    }

    if (this.ctx.getReviewMode() === 'live') {
      this.ctx.submitBatch();
    } else {
      this.ctx.notify();
    }
  }

  private sendVariantAction(wsType: string, action: string, setId: string): void {
    const ws = this.ctx.getWebSocket();
    const openState = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
    if (ws && ws.readyState === openState) {
      ws.send(JSON.stringify({ type: wsType, payload: { setId } }));
    } else if (typeof fetch !== 'undefined') {
      fetch(`${this.ctx.basePathPrefix}${API_ROUTES.VARIANTS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, setId }),
      }).catch(() => {});
    }
  }

  public revertVariantDecision(setId: string): void {
    const vSet = this.ctx.getVariantSets().find((s) => s.id === setId);
    if (vSet) {
      vSet.status = 'pending';
      vSet.selectedVariantId = undefined;
    }
    this.ctx.setVariantDecisions(this.ctx.getVariantDecisions().filter((d) => d.setId !== setId));
    this.sendVariantAction('REVERT_VARIANT_DECISION', 'revert', setId);

    if (this.ctx.getReviewMode() === 'live') {
      this.ctx.autoSync();
    }
    this.ctx.notify();
  }

  public deleteVariantDecision(setId: string): void {
    const vSet = this.ctx.getVariantSets().find((s) => s.id === setId);
    this.previewVariant(setId, null);

    if (vSet) {
      vSet.status = 'superseded';
      vSet.selectedVariantId = undefined;
    }
    this.ctx.setVariantDecisions(this.ctx.getVariantDecisions().filter((d) => d.setId !== setId));
    this.ctx.setVariantSets(this.ctx.getVariantSets().filter((s) => s.id !== setId));
    this.sendVariantAction('DELETE_VARIANT_DECISION', 'delete', setId);

    if (this.ctx.getReviewMode() === 'live') {
      this.ctx.autoSync();
    }
    this.ctx.notify();
  }

  public dismissVariantSet(setId: string): void {
    const vSet = this.ctx.getVariantSets().find((s) => s.id === setId);
    if (!vSet) return;
    vSet.status = 'superseded';
    this.previewVariant(setId, null);
    this.sendVariantAction('DISMISS_VARIANT', 'dismiss', setId);
    this.ctx.notify();
  }

  public revertAll(): void {
    for (const [setId] of this.originalSnapshots.entries()) {
      this.previewVariant(setId, null);
    }
    this.originalSnapshots.clear();
  }
}
