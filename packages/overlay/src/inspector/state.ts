import {
  AgentReply,
  CommentAnnotation,
  MutationRecord,
  SessionStatus,
  SourceLocation,
  VisualEditBatch,
} from '@visual-edit/core';
import { resolveSourceLocation } from '../source-locator/index.js';
import { computeStyleDiff, computeTextDiff, computeClassDiff } from '@visual-edit/core';

export type ActiveTool = 'none' | 'edit' | 'comment' | 'area';

export interface ElementSnapshot {
  text: string;
  styles: Record<string, string>;
  classes: string[];
  sourceLocation: SourceLocation;
}

export class OverlayStateManager {
  private static instance: OverlayStateManager;

  public activeTool: ActiveTool = 'none';
  public isDockMenuOpen = false;
  public isDrawerOpen = false;

  public activeElement: HTMLElement | null = null;
  public hoveredElement: HTMLElement | null = null;
  public commentTargetElement: HTMLElement | null = null;

  public userPrompt = '';
  public sessionId = `session_${Date.now().toString(36)}`;
  public sessionStatus: SessionStatus = 'draft';
  public mutations: MutationRecord[] = [];
  public annotations: CommentAnnotation[] = [];
  public agentReplies: AgentReply[] = [];

  private snapshots = new Map<HTMLElement, ElementSnapshot>();
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;

  private constructor() {
    this.loadFromStorage();
    this.initWebSocket();
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('visual_edit_active_draft');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.status !== 'implemented' && data.status !== 'resolved') {
          this.sessionId = data.id || this.sessionId;
          this.sessionStatus = data.status || 'draft';
          this.mutations = data.mutations || [];
          this.annotations = data.annotations || [];
          this.userPrompt = data.userPrompt || '';
        }
      }
    } catch (e) {}
  }

  private saveToStorage(): void {
    try {
      if (this.sessionStatus === 'implemented' || this.sessionStatus === 'resolved') {
        localStorage.removeItem('visual_edit_active_draft');
      } else {
        localStorage.setItem('visual_edit_active_draft', JSON.stringify(this.getBatch()));
      }
    } catch (e) {}
  }

  public static getInstance(): OverlayStateManager {
    if (!OverlayStateManager.instance) {
      OverlayStateManager.instance = new OverlayStateManager();
    }
    return OverlayStateManager.instance;
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public notify(): void {
    this.listeners.forEach((fn) => fn());
    this.saveToStorage();
    this.scheduleAutoSync();
  }

  private syncTimer: any = null;
  public scheduleAutoSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.autoSync();
    }, 200);
  }

  public async autoSync(): Promise<void> {
    const batch = this.getBatch();
    if (
      batch.mutations.length > 0 ||
      (batch.annotations && batch.annotations.length > 0) ||
      (batch.userPrompt && batch.userPrompt.trim())
    ) {
      this.sessionStatus = 'submitted';
      batch.status = 'submitted';
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'SUBMIT_BATCH', payload: batch }));
    } else {
      try {
        await fetch('/__visual_edit__/api/edits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        });
      } catch (e) {}
    }
  }

  public setTool(tool: ActiveTool): void {
    if (this.activeTool === tool) {
      this.activeTool = 'none';
    } else {
      this.activeTool = tool;
    }

    if (this.activeTool !== 'edit') {
      this.setActiveElement(null);
    }
    if (this.activeTool !== 'comment') {
      this.commentTargetElement = null;
    }
    this.hoveredElement = null;
    this.notify();
  }

  public setDockMenuOpen(val: boolean): void {
    this.isDockMenuOpen = val;
    this.notify();
  }

  public setDrawerOpen(val: boolean): void {
    this.isDrawerOpen = val;
    this.notify();
  }

  public setHoveredElement(el: HTMLElement | null): void {
    if (this.hoveredElement === el) return;
    this.hoveredElement = el;
    this.notify();
  }

  public setActiveElement(el: HTMLElement | null): void {
    if (this.activeElement === el) return;

    if (this.activeElement) {
      this.syncMutationsForElement(this.activeElement);
    }

    this.activeElement = el;
    if (el) {
      this.captureInitialSnapshot(el);
    }
    this.notify();
  }

  public setCommentTarget(el: HTMLElement | null): void {
    this.commentTargetElement = el;
    this.notify();
  }

  public addComment(comment: string, el?: HTMLElement): void {
    if (!comment.trim()) return;

    const target = el || this.commentTargetElement;
    const sourceLocation = target ? resolveSourceLocation(target) : undefined;
    const bounds = target ? target.getBoundingClientRect() : undefined;

    const annotation: CommentAnnotation = {
      id: `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'element',
      targetSelector: sourceLocation?.selector,
      sourceLocation,
      bounds: bounds ? { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height } : undefined,
      comment: comment.trim(),
    };

    this.annotations.push(annotation);
    this.commentTargetElement = null;
    this.notify();
  }

  public deleteAnnotation(id: string): void {
    this.annotations = this.annotations.filter((a) => a.id !== id);
    this.notify();
  }

  public setUserPrompt(prompt: string): void {
    this.userPrompt = prompt;
    this.notify();
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
      text: el.innerText || '',
      styles,
      classes,
      sourceLocation,
    });
  }

  public updateElementStyle(property: string, value: string): void {
    if (!this.activeElement) return;
    this.activeElement.style.setProperty(property, value);
    this.syncMutationsForElement(this.activeElement);
    this.notify();
  }

  public updateElementText(newText: string): void {
    if (!this.activeElement) return;
    this.activeElement.innerText = newText;
    this.syncMutationsForElement(this.activeElement);
    this.notify();
  }

  public addClass(className: string): void {
    if (!this.activeElement || !className.trim()) return;
    this.activeElement.classList.add(className.trim());
    this.syncMutationsForElement(this.activeElement);
    this.notify();
  }

  public removeClass(className: string): void {
    if (!this.activeElement || !className.trim()) return;
    this.activeElement.classList.remove(className.trim());
    this.syncMutationsForElement(this.activeElement);
    this.notify();
  }

  public deleteElement(): void {
    if (!this.activeElement) return;
    const el = this.activeElement;
    const sourceLocation = resolveSourceLocation(el);
    const selector = sourceLocation.selector;
    const outerHtml = el.outerHTML;

    el.remove();
    this.mutations.push({
      id: `mut_del_${Date.now()}`,
      type: 'DOM_REMOVE',
      targetSelector: selector,
      sourceLocation,
      before: outerHtml,
      after: '',
    });
    this.setActiveElement(null);
    this.notify();
  }

  public duplicateElement(): void {
    if (!this.activeElement || !this.activeElement.parentElement) return;
    const clone = this.activeElement.cloneNode(true) as HTMLElement;
    this.activeElement.parentElement.insertBefore(clone, this.activeElement.nextSibling);

    const sourceLocation = resolveSourceLocation(clone);
    this.mutations.push({
      id: `mut_dup_${Date.now()}`,
      type: 'DOM_INSERT',
      targetSelector: sourceLocation.selector,
      sourceLocation,
      before: '',
      after: clone.outerHTML,
    });
    this.setActiveElement(clone);
    this.notify();
  }

  public revertMutation(mutationId: string): void {
    const mutation = this.mutations.find((m) => m.id === mutationId);
    if (!mutation) return;

    let targetEl: HTMLElement | null = null;
    if (mutation.targetSelector) {
      try {
        targetEl = document.querySelector(mutation.targetSelector) as HTMLElement | null;
      } catch (e) {
        // ignore selector error
      }
    }

    if (targetEl) {
      const snapshot = this.snapshots.get(targetEl);
      if (mutation.type === 'STYLE_CHANGE' && mutation.property) {
        targetEl.style.removeProperty(mutation.property);
      } else if (mutation.type === 'TEXT_EDIT') {
        if (snapshot) {
          targetEl.innerText = snapshot.text;
        } else {
          targetEl.innerText = mutation.before;
        }
      } else if (mutation.type === 'CLASS_CHANGE') {
        if (snapshot) {
          targetEl.className = snapshot.classes.join(' ');
        }
      }
    }

    this.mutations = this.mutations.filter((m) => m.id !== mutationId);
    this.notify();
  }

  public revertAll(): void {
    for (const [el, snapshot] of this.snapshots.entries()) {
      if (document.body.contains(el)) {
        el.innerText = snapshot.text;
        el.className = snapshot.classes.join(' ');
        el.removeAttribute('style');
      }
    }
    this.mutations = [];
    this.annotations = [];
    this.sessionStatus = 'draft';
    this.activeElement = null;
    this.commentTargetElement = null;
    this.notify();
  }

  public moveElement(direction: 'up' | 'down'): void {
    if (!this.activeElement || !this.activeElement.parentElement) return;
    const parent = this.activeElement.parentElement;
    const siblings = Array.from(parent.children);
    const currentIndex = siblings.indexOf(this.activeElement);

    if (direction === 'up' && currentIndex > 0) {
      parent.insertBefore(this.activeElement, siblings[currentIndex - 1]);
      this.recordReorder(currentIndex, currentIndex - 1);
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      parent.insertBefore(this.activeElement, siblings[currentIndex + 1].nextSibling);
      this.recordReorder(currentIndex, currentIndex + 1);
    }
  }

  private recordReorder(beforeIndex: number, afterIndex: number): void {
    if (!this.activeElement) return;
    const sourceLocation = resolveSourceLocation(this.activeElement);
    this.mutations.push({
      id: `mut_reord_${Date.now()}`,
      type: 'DOM_REORDER',
      targetSelector: sourceLocation.selector,
      sourceLocation,
      before: `${beforeIndex}`,
      after: `${afterIndex}`,
    });
    this.notify();
  }

  public syncMutationsForElement(el: HTMLElement): void {
    const snapshot = this.snapshots.get(el);
    if (!snapshot) return;

    const sourceLocation = resolveSourceLocation(el);
    const selector = sourceLocation.selector;

    this.mutations = this.mutations.filter(
      (m) => m.targetSelector !== selector && m.type !== 'DOM_REMOVE' && m.type !== 'DOM_REORDER'
    );

    const textDiff = computeTextDiff(snapshot.text, el.innerText || '', selector, sourceLocation);
    if (textDiff) this.mutations.push(textDiff);

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
    this.mutations.push(...styleDiffs);

    const currentClasses = typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];
    const classDiffs = computeClassDiff(snapshot.classes, currentClasses, selector, sourceLocation);
    this.mutations.push(...classDiffs);
  }

  public getBatch(): VisualEditBatch {
    if (this.activeElement) {
      this.syncMutationsForElement(this.activeElement);
    }

    const primarySource = this.activeElement ? resolveSourceLocation(this.activeElement) : this.mutations[0]?.sourceLocation;

    return {
      id: this.sessionId,
      timestamp: Date.now(),
      route: window.location.pathname + window.location.search,
      status: this.sessionStatus,
      userPrompt: this.userPrompt,
      primarySource,
      mutations: this.mutations,
      annotations: this.annotations,
      replies: this.agentReplies,
    };
  }

  public async submitBatch(): Promise<void> {
    const batch = this.getBatch();
    this.sessionStatus = 'submitted';
    batch.status = 'submitted';

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'SUBMIT_BATCH', payload: batch }));
    } else {
      await fetch('/__visual_edit__/api/edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    }

    this.notify();
  }

  private initWebSocket(): void {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/__visual_edit__/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATUS_CHANGE') {
            this.sessionStatus = data.payload.status;
            if (data.payload.status === 'implemented' || data.payload.status === 'resolved') {
              this.mutations = [];
              this.annotations = [];
              this.userPrompt = '';
              try {
                localStorage.removeItem('visual_edit_active_draft');
              } catch (e) {}
            }
            if (data.payload.replies) {
              this.agentReplies = data.payload.replies;
            }
            this.notify();
          } else if (data.type === 'AGENT_REPLY') {
            this.agentReplies.push(data.payload);
            this.notify();
          } else if (data.type === 'RELOAD_PAGE') {
            window.location.reload();
          }
        } catch (e) {
          console.error('[visual-edit] WebSocket error parsing message:', e);
        }
      };

      this.ws.onclose = () => {
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      console.debug('[visual-edit] WebSocket connection not available');
    }
  }
}
