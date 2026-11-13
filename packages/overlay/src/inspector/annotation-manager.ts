import {
  AnnotationTarget,
  CommentAnnotation,
  ReviewMode,
  SessionStatus,
  VoiceReviewWalkthrough,
  VoiceTargetPin,
  computeTargetHash,
} from '@visual-edit/core';
import { resolveSourceLocation } from '../source-locator/index.js';
import { flashElementHighlight } from './highlight-utils.js';
import { saveComposerDraft } from './storage.js';
import { captureVisualSnapshot } from './visual-capture.js';

export interface CommentTargetOptions {
  selectedText?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  screenshot?: string;
}

export interface AnnotationManagerContext {
  isWorkbenchMode: () => boolean;
  getCurrentPathname: () => string;
  getPageMetadata: () => { url: string; pathname: string; pageTitle: string };
  getReviewMode: () => ReviewMode;
  isCommentToolActive: () => boolean;
  clearToolToNone: () => void;
  setSessionStatus: (status: SessionStatus) => void;
  setDrawerOpen: (open: boolean) => void;
  getAnnotations: () => CommentAnnotation[];
  setAnnotations: (next: CommentAnnotation[]) => void;
  getVoiceReviews: () => VoiceReviewWalkthrough[];
  setVoiceReviews: (next: VoiceReviewWalkthrough[]) => void;
  setActiveVoicePins: (pins: VoiceTargetPin[]) => void;
  getCommentDraftText: () => string;
  setCommentDraftTextField: (text: string) => void;
  getCommentTargetElement: () => HTMLElement | null;
  setCommentTargetElement: (el: HTMLElement | null) => void;
  getCommentTargetElements: () => HTMLElement[];
  setCommentTargetElements: (els: HTMLElement[]) => void;
  getCommentTargetSelectedText: () => string | undefined;
  setCommentTargetSelectedText: (val?: string) => void;
  getCommentTargetBounds: () => { x: number; y: number; width: number; height: number } | undefined;
  setCommentTargetBounds: (bounds?: { x: number; y: number; width: number; height: number }) => void;
  getCommentPendingScreenshot: () => string | undefined;
  setCommentPendingScreenshot: (screenshot?: string) => void;
  getPendingPageReload: () => boolean;
  setPendingPageReload: (val: boolean) => void;
  submitBatch: () => Promise<void>;
  notify: () => void;
}

/** Manages comment targeting, multi-target pins, screenshot capture, and annotation CRUD. */
export class AnnotationManager {
  constructor(private readonly ctx: AnnotationManagerContext) {}

  private flushPendingReload(): void {
    if (!this.ctx.getPendingPageReload()) return;
    this.ctx.setPendingPageReload(false);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 150);
  }

  public isComposingComment(): boolean {
    return Boolean(
      this.ctx.getCommentTargetElement() ||
      this.ctx.getCommentTargetElements().length > 0 ||
      (this.ctx.isCommentToolActive() && this.ctx.getCommentDraftText().trim().length > 0)
    );
  }

  public setCommentDraftText(text: string): void {
    this.ctx.setCommentDraftTextField(text);
    if (!this.ctx.isWorkbenchMode()) {
      saveComposerDraft(text.trim() ? text : '');
    }
  }

  public setCommentTarget(el: HTMLElement | null, options?: CommentTargetOptions): void {
    this.ctx.setCommentTargetElement(el);
    this.ctx.setCommentTargetElements(el ? [el] : []);
    this.ctx.setCommentTargetSelectedText(options?.selectedText);
    this.ctx.setCommentTargetBounds(options?.bounds);
    this.ctx.setCommentPendingScreenshot(options?.screenshot);

    if (!el) {
      this.setCommentDraftText('');
      this.flushPendingReload();
    }

    this.ctx.notify();
  }

  public setPendingScreenshot(screenshot?: string): void {
    this.ctx.setCommentPendingScreenshot(screenshot);
    this.ctx.notify();
  }

  public toggleCommentTarget(el: HTMLElement): void {
    if (this.ctx.getCommentTargetSelectedText()) {
      this.setCommentTarget(el);
      return;
    }

    const targets = [...this.ctx.getCommentTargetElements()];
    const idx = targets.indexOf(el);
    if (idx === -1) {
      targets.push(el);
      this.ctx.setCommentTargetElements(targets);
      this.ctx.setCommentTargetElement(el);
    } else if (targets.length > 1) {
      targets.splice(idx, 1);
      this.ctx.setCommentTargetElements(targets);
      this.ctx.setCommentTargetElement(targets[targets.length - 1]);
    } else {
      this.setCommentTarget(null);
      return;
    }
    this.ctx.setCommentTargetBounds(undefined);
    this.ctx.notify();
  }

  public removeCommentTarget(el: HTMLElement): void {
    const targets = [...this.ctx.getCommentTargetElements()];
    const idx = targets.indexOf(el);
    if (idx === -1) return;

    targets.splice(idx, 1);
    this.ctx.setCommentTargetElements(targets);
    if (targets.length === 0) {
      this.setCommentTarget(null);
      return;
    }
    this.ctx.setCommentTargetElement(targets[targets.length - 1]);
    this.ctx.notify();
  }

  public addComment(comment: string, el?: HTMLElement, options?: CommentTargetOptions): void {
    const commentText = comment.trim();
    const screenshot = options?.screenshot || this.ctx.getCommentPendingScreenshot();
    if (!commentText && !screenshot) return;

    const currentTargets = this.ctx.getCommentTargetElements();
    const singleTarget = this.ctx.getCommentTargetElement();
    const targetsList =
      currentTargets.length > 1
        ? currentTargets
        : el
        ? [el]
        : currentTargets.length > 0
        ? currentTargets
        : singleTarget
        ? [singleTarget]
        : [];

    const isMulti = targetsList.length > 1;
    const primaryTarget = targetsList[0];
    const selectedText = options?.selectedText || this.ctx.getCommentTargetSelectedText();
    const customBounds = options?.bounds || this.ctx.getCommentTargetBounds();

    const scrollX = typeof window !== 'undefined' ? window.scrollX || window.pageXOffset || 0 : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;
    const primaryLoc = primaryTarget ? resolveSourceLocation(primaryTarget) : undefined;
    const primaryElBounds = primaryTarget ? primaryTarget.getBoundingClientRect() : undefined;
    const primaryBounds = customBounds
      ? {
          x: Math.round(customBounds.x + scrollX),
          y: Math.round(customBounds.y + scrollY),
          width: Math.round(customBounds.width),
          height: Math.round(customBounds.height),
        }
      : primaryElBounds
      ? {
          x: Math.round(primaryElBounds.left + scrollX),
          y: Math.round(primaryElBounds.top + scrollY),
          width: Math.round(primaryElBounds.width),
          height: Math.round(primaryElBounds.height),
        }
      : undefined;
    const primarySnippet = primaryLoc?.htmlSnippet || (primaryTarget ? primaryTarget.outerHTML.slice(0, 300) : undefined);
    const primaryHash = primaryLoc?.selector
      ? computeTargetHash({ selector: primaryLoc.selector, htmlSnippet: primarySnippet })
      : undefined;

    const annotationTargets: AnnotationTarget[] | undefined = isMulti
      ? targetsList.map((targetEl) => {
          const loc = resolveSourceLocation(targetEl);
          const b = targetEl.getBoundingClientRect();
          const snippet = loc.htmlSnippet || targetEl.outerHTML.slice(0, 300);
          return {
            targetSelector: loc.selector,
            targetHash: computeTargetHash({ selector: loc.selector, htmlSnippet: snippet }),
            sourceLocation: loc,
            bounds: {
              x: Math.round(b.left + scrollX),
              y: Math.round(b.top + scrollY),
              width: Math.round(b.width),
              height: Math.round(b.height),
            },
            htmlSnippet: snippet,
            pathname: this.ctx.getCurrentPathname(),
          };
        })
      : undefined;

    const componentLabel = primaryLoc?.componentName ? `<${primaryLoc.componentName}>` : primaryLoc?.selector || 'element';
    const finalComment = commentText || `Visual snapshot of ${componentLabel}`;

    const annotation: CommentAnnotation = {
      id: `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: screenshot ? 'screenshot' : isMulti ? 'multi' : selectedText ? 'text' : 'element',
      targets: annotationTargets,
      targetSelector: primaryLoc?.selector,
      targetHash: primaryHash,
      sourceLocation: primaryLoc,
      htmlSnippet: primarySnippet,
      ...this.ctx.getPageMetadata(),
      bounds: primaryBounds,
      selectedText,
      screenshot,
      comment: finalComment,
    };

    this.ctx.setAnnotations([...this.ctx.getAnnotations(), annotation]);
    this.ctx.setCommentTargetElement(null);
    this.ctx.setCommentTargetElements([]);
    this.ctx.setCommentTargetSelectedText(undefined);
    this.ctx.setCommentTargetBounds(undefined);
    this.ctx.setCommentPendingScreenshot(undefined);
    this.setCommentDraftText('');
    this.ctx.clearToolToNone();

    this.flushPendingReload();

    if (this.ctx.getReviewMode() === 'live') {
      void this.ctx.submitBatch();
    } else {
      this.ctx.setSessionStatus('draft');
      this.ctx.notify();
    }
  }

  private async captureElementSnapshotWithFlash(el: HTMLElement): Promise<{
    loc: ReturnType<typeof resolveSourceLocation>;
    targetSelector: string;
    screenshotDataUrl: string;
  }> {
    const loc = resolveSourceLocation(el);
    const targetSelector = loc.selector || (el.id ? `#${el.id}` : el.tagName.toLowerCase());

    let screenshotDataUrl = '';
    try {
      const snap = await captureVisualSnapshot({
        selector: targetSelector,
        resolution: 'draft',
        includeOverlay: false,
      });
      if (snap && snap.success && snap.imageBase64) {
        screenshotDataUrl = snap.imageBase64;
      }
    } catch (err) {
      console.debug('[lux] Element screenshot capture failed, continuing without snapshot:', err);
    }

    // Flash shutter feedback after clean capture snapshot has been recorded
    flashElementHighlight(
      el,
      '0 0 0 3px #f59e0b, 0 0 24px rgba(245, 158, 11, 0.6)',
      'box-shadow 0.15s ease, outline 0.15s ease',
      350
    );

    return { loc, targetSelector, screenshotDataUrl };
  }

  public async snapElementToComposer(el: HTMLElement): Promise<void> {
    if (!el || typeof document === 'undefined') return;
    const { screenshotDataUrl } = await this.captureElementSnapshotWithFlash(el);
    this.setCommentTarget(el, { screenshot: screenshotDataUrl });
  }

  public async captureElementScreenshot(el: HTMLElement, commentText?: string): Promise<CommentAnnotation | null> {
    if (!el || typeof document === 'undefined') return null;
    const { loc, targetSelector, screenshotDataUrl } = await this.captureElementSnapshotWithFlash(el);

    const componentLabel = loc.componentName ? `<${loc.componentName}>` : targetSelector;
    const defaultComment = (commentText || '').trim() || `Visual snapshot of ${componentLabel}`;

    this.addComment(defaultComment, el, { screenshot: screenshotDataUrl });
    if (this.ctx.getReviewMode() !== 'live') {
      this.ctx.setDrawerOpen(true);
    }
    const annotations = this.ctx.getAnnotations();
    return annotations[annotations.length - 1] || null;
  }

  public updateAnnotation(id: string, newText: string): void {
    const ann = this.ctx.getAnnotations().find((a) => a.id === id);
    if (ann && newText.trim()) {
      ann.comment = newText.trim();
      if (this.ctx.getReviewMode() === 'batch') {
        this.ctx.setSessionStatus('draft');
      }
      this.ctx.notify();
    }
  }

  public deleteAnnotation(id: string): void {
    this.ctx.setAnnotations(this.ctx.getAnnotations().filter((a) => a.id !== id));
    this.ctx.setVoiceReviews(this.ctx.getVoiceReviews().filter((v) => v.id !== id));
    this.ctx.setActiveVoicePins([]);
    if (this.ctx.getReviewMode() === 'batch') {
      this.ctx.setSessionStatus('draft');
    }
    this.ctx.notify();
  }
}
