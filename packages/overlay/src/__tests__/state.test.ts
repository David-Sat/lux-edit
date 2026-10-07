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

    // Reset singleton instance
    (OverlayStateManager as any).instance = undefined;
    state = OverlayStateManager.getInstance();
  });

  afterEach(() => {
    storageMap.clear();
    delete (globalThis as any).WebSocket;
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
      expect(state.isThemePanelOpen).toBe(false);
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

  describe('theme tokens and mutations', () => {
    it('updates theme tokens and creates THEME_CHANGE mutation', () => {
      state.updateThemeToken('primary', '#10b981');
      expect(state.themeTokens.primary).toBe('#10b981');

      const themeMutations = state.mutations.filter((m) => m.type === 'THEME_CHANGE');
      expect(themeMutations.length).toBe(1);
      expect(themeMutations[0].property).toBe('primary');
      expect(themeMutations[0].after).toBe('#10b981');

      // Updating again replaces previous mutation for same token
      state.updateThemeToken('primary', '#3b82f6');
      const updated = state.mutations.filter((m) => m.type === 'THEME_CHANGE');
      expect(updated.length).toBe(1);
      expect(updated[0].after).toBe('#3b82f6');
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
      state.updateThemeToken('accent', '#f59e0b');

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
      (OverlayStateManager as any).instance = undefined;
      const newInstance = OverlayStateManager.getInstance();

      expect(newInstance.sessionId).toBe('recovered_session_42');
      expect(newInstance.userPrompt).toBe('Recovered prompt from previous tab');
      expect(newInstance.annotations.length).toBe(1);
      expect(newInstance.annotations[0].comment).toBe('Recovered pin');
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
});
