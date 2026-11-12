// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OverlayStateManager } from '../inspector/state.js';

describe('OverlayStateManager', () => {
  let state: OverlayStateManager;
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    storageMap.clear();
    const mockStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, String(val)),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
      get length() {
        return storageMap.size;
      },
      key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
    };

    Object.defineProperty(window, 'localStorage', { value: mockStorage, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

    document.body.innerHTML = '';
    // Mock WebSocket to prevent network errors in test environment
    (globalThis as any).WebSocket = class {
      public readyState = 1; // OPEN
      public send = vi.fn();
      public close = vi.fn();
      public onmessage = null;
      public onclose = null;
    };

    // Mock fetch to prevent pending unhandled HTTP requests in happy-dom
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

    // Reset singleton instance
    OverlayStateManager.resetInstance();
    state = OverlayStateManager.getInstance();
  });

  afterEach(() => {
    storageMap.clear();
    OverlayStateManager.resetInstance();
    delete (globalThis as any).WebSocket;
    vi.restoreAllMocks();
  });

  describe('singleton & initial state', () => {
    it('returns the same singleton instance', () => {
      const another = OverlayStateManager.getInstance();
      expect(another).toBe(state);
    });

    it('initializes with default tool and drawer states', () => {
      expect(state.activeTool).toBe('none');
      expect(state.isDockMenuOpen).toBe(false);
      expect(state.isDrawerOpen).toBe(false);
      expect(state.mutations).toEqual([]);
      expect(state.annotations).toEqual([]);
    });

    it('notifies subscribers on state change', () => {
      const listener = vi.fn();
      const unsubscribe = state.subscribe(listener);

      state.setDockMenuOpen(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(state.isDockMenuOpen).toBe(true);

      unsubscribe();
      state.setDockMenuOpen(false);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('tool management', () => {
    it('toggles tools on and off', () => {
      state.setTool('comment');
      expect(state.activeTool).toBe('comment');

      // Toggling the same tool sets it back to none
      state.setTool('comment');
      expect(state.activeTool).toBe('none');

      state.setTool('edit');
      expect(state.activeTool).toBe('edit');
    });

    it('clears active and comment targets when switching tools', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);

      state.setTool('edit');
      state.setActiveElement(btn);
      expect(state.activeElement).toBe(btn);

      state.setTool('comment');
      expect(state.activeElement).toBeNull();
      expect(state.activeTool).toBe('comment');
    });
  });

  describe('screenshot capture and tool selection', () => {
    it('selects screenshot tool and captures element screenshot', async () => {
      state.setTool('screenshot');
      expect(state.activeTool).toBe('screenshot');

      const card = document.createElement('div');
      card.id = 'hero-card';
      document.body.appendChild(card);

      await state.captureElementScreenshot(card, 'Check padding on hero card');

      expect(state.annotations.length).toBe(1);
      const ann = state.annotations[0];
      expect(ann.type).toBe('screenshot');
      expect(ann.comment).toBe('Check padding on hero card');
      expect(ann.targetSelector).toBe('#hero-card');
      expect(ann.screenshot).toBeDefined();
      expect(state.isDrawerOpen).toBe(true);

      document.body.removeChild(card);
    });

    it('snaps element to composer with attached screenshot and custom user comment', async () => {
      const banner = document.createElement('div');
      banner.id = 'promo-banner';
      document.body.appendChild(banner);

      await state.snapElementToComposer(banner);
      expect(state.commentTargetElement).toBe(banner);
      expect(state.commentPendingScreenshot).toBeDefined();

      state.addComment('The gradient colors do not match the brand guidelines.');

      expect(state.annotations.length).toBe(1);
      const ann = state.annotations[0];
      expect(ann.type).toBe('screenshot');
      expect(ann.comment).toBe('The gradient colors do not match the brand guidelines.');
      expect(ann.screenshot).toBeDefined();
      expect(state.commentTargetElement).toBeNull();
      expect(state.commentPendingScreenshot).toBeUndefined();

      document.body.removeChild(banner);
    });

    it('allows attaching screenshot on a normal comment pin and detaching it', () => {
      const btn = document.createElement('button');
      btn.id = 'submit-btn';
      document.body.appendChild(btn);

      state.setCommentTarget(btn);
      expect(state.commentPendingScreenshot).toBeUndefined();

      state.setPendingScreenshot('data:image/png;base64,mockpngdata');
      expect(state.commentPendingScreenshot).toBe('data:image/png;base64,mockpngdata');

      // Detach screenshot
      state.setPendingScreenshot(undefined);
      expect(state.commentPendingScreenshot).toBeUndefined();

      document.body.removeChild(btn);
    });
  });

  describe('comments and annotations', () => {
    it('adds and deletes element comment annotations', () => {
      const card = document.createElement('div');
      card.id = 'feature-card';
      document.body.appendChild(card);

      state.addComment('Make this card more prominent', card);
      expect(state.annotations.length).toBe(1);
      expect(state.annotations[0].comment).toBe('Make this card more prominent');
      expect(state.annotations[0].targetSelector).toBe('#feature-card');
      expect(state.annotations[0].type).toBe('element');

      const annotationId = state.annotations[0].id;
      state.updateAnnotation(annotationId, 'Updated: Make card violet with shadow');
      expect(state.annotations[0].comment).toBe('Updated: Make card violet with shadow');

      state.deleteAnnotation(annotationId);
      expect(state.annotations.length).toBe(0);
    });

    it('adds multi-element comment annotations when multiple targets selected', () => {
      const el1 = document.createElement('span');
      el1.id = 'tag-1';
      const el2 = document.createElement('span');
      el2.id = 'tag-2';
      document.body.appendChild(el1);
      document.body.appendChild(el2);

      state.toggleCommentTarget(el1);
      state.toggleCommentTarget(el2);
      expect(state.commentTargetElements).toEqual([el1, el2]);

      state.addComment('Align both tags horizontally');
      expect(state.annotations.length).toBe(1);
      expect(state.annotations[0].type).toBe('multi');
      expect(state.annotations[0].targets?.length).toBe(2);
    });

    it('deleting a voice transcript annotation also deletes from voiceReviews and activeVoicePins', () => {
      const reviewId = 'voice_test_123';
      state.annotations.push({
        id: reviewId,
        timestamp: Date.now(),
        type: 'voice',
        comment: 'Voice walkthrough transcript',
        targetSelector: '#feature-card',
      });
      state.voiceReviews.push({
        id: reviewId,
        timestamp: Date.now(),
        durationMs: 5000,
        transcript: 'Voice walkthrough transcript',
        annotatedTranscript: 'Voice walkthrough transcript',
        pins: [{
          id: 'pin_1',
          order: 1,
          targetSelector: '#feature-card',
          timestampMs: 1000,
        }],
        sections: [],
      });

      expect(state.annotations.length).toBe(1);
      expect(state.voiceReviews.length).toBe(1);

      state.deleteAnnotation(reviewId);

      expect(state.annotations.length).toBe(0);
      expect(state.voiceReviews.length).toBe(0);
      expect(state.activeVoicePins.length).toBe(0);
    });
  });

  describe('element mutations and undo/redo', () => {
    it('captures text edit mutations and supports reverting', () => {
      const p = document.createElement('p');
      p.id = 'desc';
      p.textContent = 'Original copy';
      document.body.appendChild(p);

      state.setActiveElement(p);
      state.updateElementText('Updated copy with punchier headline');

      expect(p.textContent).toBe('Updated copy with punchier headline');
      const textMutation = state.mutations.find((m) => m.type === 'TEXT_EDIT');
      expect(textMutation).toBeDefined();
      expect(textMutation?.before).toBe('Original copy');
      expect(textMutation?.after).toBe('Updated copy with punchier headline');

      // Revert mutation
      state.revertMutation(textMutation!.id);
      expect(p.textContent).toBe('Original copy');
    });

    it('captures class changes on active element', () => {
      const div = document.createElement('div');
      div.id = 'badge';
      div.className = 'pill';
      document.body.appendChild(div);

      state.setActiveElement(div);
      state.addClass('pill-lg');
      state.addClass('bg-primary');

      expect(div.classList.contains('pill-lg')).toBe(true);
      expect(div.classList.contains('bg-primary')).toBe(true);

      const classMutation = state.mutations.find((m) => m.type === 'CLASS_CHANGE');
      expect(classMutation).toBeDefined();
    });

    it('reverts all active mutations cleanly via revertAll()', () => {
      const heading = document.createElement('h1');
      heading.id = 'hero-text';
      heading.textContent = 'Welcome';
      document.body.appendChild(heading);

      state.setActiveElement(heading);
      state.updateElementText('New Welcome Header');

      expect(state.mutations.length).toBeGreaterThan(0);

      state.revertAll();
      expect(heading.textContent).toBe('Welcome');
      expect(state.mutations.length).toBe(0);
      expect(state.annotations.length).toBe(0);
      expect(state.sessionStatus).toBe('draft');
    });
  });

  describe('draft storage and recovery', () => {
    it('serializes non-empty draft to localStorage', () => {
      state.setUserPrompt('Change color theme to emerald');
      const stored = window.localStorage.getItem('lux_draft_default');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.userPrompt).toBe('Change color theme to emerald');
    });

    it('clears localStorage when draft is emptied', () => {
      state.setUserPrompt('Temporary prompt');
      expect(window.localStorage.getItem('lux_draft_default')).not.toBeNull();

      state.setUserPrompt('');
      expect(window.localStorage.getItem('lux_draft_default')).toBeNull();
    });

    it('restores draft from localStorage on new instance initialization', () => {
      const draftBatch = {
        id: 'recovered_session_42',
        status: 'draft',
        userPrompt: 'Recovered prompt from previous tab',
        mutations: [],
        annotations: [{ id: 'a1', timestamp: 12345, type: 'element', comment: 'Recovered pin' }],
      };
      window.localStorage.setItem('lux_draft_default', JSON.stringify(draftBatch));

      // Reset instance to simulate page load
      OverlayStateManager.resetInstance();
      const newInstance = OverlayStateManager.getInstance();

      expect(newInstance.sessionId).toBe('recovered_session_42');
      expect(newInstance.userPrompt).toBe('Recovered prompt from previous tab');
      expect(newInstance.annotations.length).toBe(1);
      expect(newInstance.annotations[0].comment).toBe('Recovered pin');
    });

    it('prunes orphaned voice reviews from localStorage on load if annotation was deleted', () => {
      const draftBatch = {
        id: 'recovered_session_43',
        status: 'draft',
        mutations: [],
        annotations: [], // User deleted the voice annotation
        voiceReviews: [{
          id: 'orphaned_voice_1',
          pins: [{ id: 'p1', order: 1, targetSelector: '#btn' }],
        }],
      };
      window.localStorage.setItem('lux_draft_default', JSON.stringify(draftBatch));

      (OverlayStateManager as any).instance = undefined;
      const newInstance = OverlayStateManager.getInstance();

      expect(newInstance.annotations.length).toBe(0);
      expect(newInstance.voiceReviews.length).toBe(0);
    });
  });

  describe('batch export (getBatch)', () => {
    it('exports well-formed VisualEditBatch structure', () => {
      const section = document.createElement('section');
      section.id = 'cta-section';
      document.body.appendChild(section);

      state.setActiveElement(section);
      state.setUserPrompt('Refactor CTA buttons');
      state.addComment('Make primary CTA sticky', section);

      const batch = state.getBatch();
      expect(batch.id).toBe(state.sessionId);
      expect(batch.userPrompt).toBe('Refactor CTA buttons');
      expect(batch.annotations?.length).toBe(1);
      expect(batch.pagesVisited).toBeDefined();
      expect(batch.route).toBeDefined();
      expect(batch.status).toBe('draft');
    });
  });

  describe('dock positioning & edge-snapping persistence', () => {
    it('initializes with default bottom-right position', () => {
      expect(state.dockPosition).toEqual({
        side: 'right',
        verticalAnchor: 'bottom',
        offsetY: 24,
      });
    });

    it('updates position, notifies listeners, and persists to localStorage', () => {
      const listener = vi.fn();
      state.subscribe(listener);

      state.setDockPosition({
        side: 'left',
        verticalAnchor: 'top',
        offsetY: 120,
      });

      expect(listener).toHaveBeenCalled();
      expect(state.dockPosition).toEqual({
        side: 'left',
        verticalAnchor: 'top',
        offsetY: 120,
      });

      const saved = window.localStorage.getItem('lux_dock_position');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual({
        side: 'left',
        verticalAnchor: 'top',
        offsetY: 120,
      });
    });

    it('recovers saved dock position across fresh instance reloads', () => {
      window.localStorage.setItem(
        'lux_dock_position',
        JSON.stringify({
          side: 'left',
          verticalAnchor: 'bottom',
          offsetY: 80,
        })
      );

      OverlayStateManager.resetInstance();
      const reloaded = OverlayStateManager.getInstance();

      expect(reloaded.dockPosition).toEqual({
        side: 'left',
        verticalAnchor: 'bottom',
        offsetY: 80,
      });
    });
  });

  describe('comment composing & reload resilience', () => {
    it('detects when user is actively composing comments', () => {
      expect(state.isComposingComment()).toBe(false);

      const target = document.createElement('div');
      document.body.appendChild(target);

      state.setCommentTarget(target);
      expect(state.isComposingComment()).toBe(true);

      state.setCommentTarget(null);
      expect(state.isComposingComment()).toBe(false);

      state.setTool('comment');
      state.setCommentDraftText('Typing something...');
      expect(state.isComposingComment()).toBe(true);
    });

    it('defers RELOAD_PAGE when user is composing and executes on save', () => {
      const target = document.createElement('button');
      document.body.appendChild(target);

      state.setCommentTarget(target);
      state.setCommentDraftText('Unfinished comment');

      expect(state.isComposingComment()).toBe(true);
      expect(state.pendingPageReload).toBe(false);

      // Simulate receiving RELOAD_PAGE over WebSocket
      const ws = (state as any).ws;
      if (ws?.onmessage) {
        ws.onmessage({ data: JSON.stringify({ type: 'RELOAD_PAGE', payload: { file: 'App.tsx' } }) });
      }

      // Reload must be deferred because user is actively composing
      expect(state.pendingPageReload).toBe(true);

      // User submits comment
      state.addComment('Finished comment', target);

      // Comment is saved and pending reload is cleared
      expect(state.annotations.length).toBe(1);
      expect(state.annotations[0].comment).toBe('Finished comment');
      expect(state.pendingPageReload).toBe(false);
    });

    it('does not throw ReferenceError when WebSocket is undefined during autoSync', async () => {
      // Simulate environments like Node 20 where WebSocket is not defined globally
      delete (globalThis as any).WebSocket;

      state.setUserPrompt('Test prompt for autosync without websocket');
      await expect(state.autoSync()).resolves.toBeUndefined();
    });

    it('cleans up timers and sockets cleanly on resetInstance and destroy', () => {
      state.scheduleAutoSync();
      expect((state as any).syncTimer).not.toBeNull();

      OverlayStateManager.resetInstance();
      expect((state as any).syncTimer).toBeNull();
      expect((state as any).ws).toBeNull();
    });
  });

  describe('Live vs. Batch Review Mode, Component Variants, and Verification Halo', () => {
    it('switches reviewMode and immediately submits discrete comments in Live Mode', () => {
      state.setReviewMode('live');
      expect(state.reviewMode).toBe('live');
      expect(window.localStorage.getItem('lux_review_mode')).toBe('live');

      const btn = document.createElement('button');
      btn.id = 'live-btn';
      document.body.appendChild(btn);

      state.addComment('Stream this immediately', btn);
      expect(state.sessionStatus).toBe('submitted');
    });

    it('maintains draft status during batch mode edits and flips back to draft on new changes after submit', async () => {
      state.setReviewMode('batch');
      expect(state.reviewMode).toBe('batch');
      expect(state.sessionStatus).toBe('draft');

      const btn = document.createElement('button');
      btn.id = 'batch-btn';
      document.body.appendChild(btn);

      state.addComment('First batch item', btn);
      expect(state.sessionStatus).toBe('draft');

      await state.submitBatch();
      expect(state.sessionStatus).toBe('submitted');

      // Adding new comment resets status to draft
      state.addComment('Second batch item', btn);
      expect(state.sessionStatus).toBe('draft');
    });

    it('previews and decides component variants in the live DOM and reverts cleanly', () => {
      const card = document.createElement('div');
      card.id = 'var-card';
      card.className = 'card base';
      card.textContent = 'Original Text';
      document.body.appendChild(card);

      state.variantSets = [
        {
          id: 'vset_test',
          targetSelector: '#var-card',
          label: 'Card Variants',
          createdAt: Date.now(),
          status: 'pending',
          variants: [
            {
              id: 'var_1',
              name: 'Emerald Variant',
              rationale: 'Emerald design',
              styles: { 'background-color': 'rgb(16, 185, 129)' },
              classes: { add: ['emerald-glow'], remove: ['base'] },
              text: 'Emerald Text',
            },
          ],
        },
      ];

      // Preview variant 1
      state.previewVariant('vset_test', 'var_1');
      expect(card.textContent).toBe('Emerald Text');
      expect(card.classList.contains('emerald-glow')).toBe(true);
      expect(card.classList.contains('base')).toBe(false);

      // Preview Original (null)
      state.previewVariant('vset_test', null);
      expect(card.textContent).toBe('Original Text');
      expect(card.classList.contains('base')).toBe(true);
      expect(card.classList.contains('emerald-glow')).toBe(false);

      // Decide variant 1
      state.decideVariant('vset_test', 'var_1', 'Picked emerald');
      expect(state.variantDecisions).toHaveLength(1);
      expect(state.variantDecisions[0].variantName).toBe('Emerald Variant');
    });

    it('triggers verification halo targets', () => {
      state.triggerVerificationHalo([{ selector: '#var-card', label: 'Implemented', timestamp: Date.now() }]);
      expect(state.verificationTargets).toHaveLength(1);
      expect(state.verificationTargets[0].selector).toBe('#var-card');
    });
  });
});
