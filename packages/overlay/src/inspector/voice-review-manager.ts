import {
  CommentAnnotation,
  ReviewMode,
  SessionStatus,
  VoiceReviewWalkthrough,
  VoiceTargetPin,
} from '@visual-edit/core';
import { resolveSourceLocation } from '../source-locator/index.js';
import { flashElementHighlight } from './highlight-utils.js';
import { normalizeRoute } from './route-utils.js';
import { VoiceRecorder } from './voice-recorder.js';

export interface VoiceReviewManagerContext {
  getCurrentPathname: () => string;
  getReviewMode: () => ReviewMode;
  getAnnotations: () => CommentAnnotation[];
  setAnnotations: (next: CommentAnnotation[]) => void;
  getVoiceReviews: () => VoiceReviewWalkthrough[];
  setVoiceReviews: (next: VoiceReviewWalkthrough[]) => void;
  getActiveVoicePins: () => VoiceTargetPin[];
  setActiveVoicePins: (pins: VoiceTargetPin[]) => void;
  getIsStoppingVoice: () => boolean;
  setIsStoppingVoice: (val: boolean) => void;
  onStartVoiceMode: () => void;
  clearToolToNone: () => void;
  setSessionStatus: (status: SessionStatus) => void;
  setDrawerOpen: (open: boolean) => void;
  submitBatch: () => Promise<void>;
  scheduleAutoSync: () => void;
  notify: () => void;
}

/** Coordinates voice walkthrough recording, pin capture, and annotation synthesis. */
export class VoiceReviewManager {
  constructor(private readonly ctx: VoiceReviewManagerContext) {}

  public startVoiceRecording(): void {
    this.ctx.onStartVoiceMode();
    VoiceRecorder.getInstance().start();
    this.ctx.notify();
  }

  public async stopVoiceRecording(): Promise<void> {
    if (this.ctx.getIsStoppingVoice()) return;
    this.ctx.setIsStoppingVoice(true);
    this.ctx.notify();
    try {
      const currentRoute = this.ctx.getCurrentPathname();
      const review = await VoiceRecorder.getInstance().stop(currentRoute);
      if (review) {
        const primaryPin = review.pins[0];
        const pinRoutes = Array.from(
          new Set(
            review.pins
              .map((p) => p.pathname)
              .filter((p): p is string => Boolean(p))
              .map((p) => normalizeRoute(p))
          )
        );
        const resolvedPathname =
          pinRoutes.length === 1
            ? review.pins.find((p) => p.pathname)?.pathname || currentRoute
            : review.pathname || primaryPin?.pathname || currentRoute;
        const annotation: CommentAnnotation = {
          id: review.id,
          timestamp: review.timestamp,
          type: 'voice',
          comment: review.annotatedTranscript || review.transcript,
          targetSelector: primaryPin?.targetSelector,
          targetHash: primaryPin?.targetHash,
          sourceLocation: primaryPin?.sourceLocation,
          htmlSnippet: primaryPin?.htmlSnippet,
          bounds: primaryPin?.bounds,
          url: review.url,
          pathname: resolvedPathname,
          pageTitle: review.pageTitle,
          targets: review.pins.map((p) => ({
            targetSelector: p.targetSelector,
            targetHash: p.targetHash,
            sourceLocation: p.sourceLocation,
            htmlSnippet: p.htmlSnippet,
            bounds: p.bounds,
            pathname: p.pathname,
          })),
          voiceSections: review.sections,
        };
        this.ctx.setAnnotations([...this.ctx.getAnnotations(), annotation]);
        this.ctx.setVoiceReviews([...this.ctx.getVoiceReviews(), review]);
        if (this.ctx.getReviewMode() === 'live') {
          await this.ctx.submitBatch();
        } else {
          this.ctx.setSessionStatus('draft');
          this.ctx.scheduleAutoSync();
          this.ctx.setDrawerOpen(true);
        }
      }
      this.ctx.clearToolToNone();
      this.ctx.setActiveVoicePins([]);
    } finally {
      this.ctx.setIsStoppingVoice(false);
      this.ctx.notify();
    }
  }

  public cancelVoiceRecording(): void {
    VoiceRecorder.getInstance().cancel();
    this.ctx.setActiveVoicePins([]);
    this.ctx.clearToolToNone();
    this.ctx.notify();
  }

  public recordVoicePin(targetEl: HTMLElement, appendToCurrentSection: boolean = false): void {
    const recorder = VoiceRecorder.getInstance();
    const sourceLocation = resolveSourceLocation(targetEl);
    const rect = targetEl.getBoundingClientRect();
    const bounds = {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
    const selector =
      targetEl.tagName.toLowerCase() +
      (targetEl.id ? `#${targetEl.id}` : '') +
      (targetEl.className && typeof targetEl.className === 'string'
        ? `.${targetEl.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '');

    const snippet = targetEl.outerHTML.slice(0, 200);

    const pin = recorder.addPin(
      {
        selector,
        sourceLocation,
        htmlSnippet: snippet,
        bounds,
        pathname: this.ctx.getCurrentPathname(),
      },
      { appendToCurrentSection }
    );

    this.ctx.setActiveVoicePins([...this.ctx.getActiveVoicePins(), pin]);

    // Visual ripple effect on clicked element
    flashElementHighlight(
      targetEl,
      '0 0 0 4px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.4)',
      'box-shadow 0.2s ease, transform 0.2s ease',
      400
    );

    this.ctx.notify();
  }

  public deleteVoiceReview(id: string): void {
    this.ctx.setVoiceReviews(this.ctx.getVoiceReviews().filter((v) => v.id !== id));
    this.ctx.setAnnotations(this.ctx.getAnnotations().filter((a) => a.id !== id));
    this.ctx.setActiveVoicePins([]);
    if (this.ctx.getReviewMode() === 'batch') {
      this.ctx.setSessionStatus('draft');
    }
    this.ctx.notify();
  }
}
