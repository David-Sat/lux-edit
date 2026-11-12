// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OverlayStateManager } from '../inspector/state.js';
import { VoiceRecorder } from '../inspector/voice-recorder.js';

describe('OverlayStateManager workbench mode', () => {
  const storageSetSpy = vi.fn();
  const storageGetSpy = vi.fn(() => null);
  const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  const wsConstructorSpy = vi.fn();

  beforeEach(() => {
    storageSetSpy.mockClear();
    storageGetSpy.mockClear();
    fetchSpy.mockClear();
    wsConstructorSpy.mockClear();

    const mockStorage = {
      getItem: storageGetSpy,
      setItem: storageSetSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: () => null,
    };

    Object.defineProperty(window, 'localStorage', { value: mockStorage, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: mockStorage, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: mockStorage, configurable: true });
    (globalThis as any).fetch = fetchSpy;
    (globalThis as any).WebSocket = class {
      constructor(url: string) {
        wsConstructorSpy(url);
      }
      public close = vi.fn();
    };

    OverlayStateManager.resetInstance();
    OverlayStateManager.setWorkbenchMode(true);
  });

  afterEach(() => {
    OverlayStateManager.resetInstance();
    OverlayStateManager.setWorkbenchMode(false);
    VoiceRecorder.getInstance().setWorkbenchState(null);
  });

  it('skips storage, WebSocket, and fetch side effects in workbench mode', async () => {
    const state = OverlayStateManager.getInstance();

    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(wsConstructorSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    state.setReviewMode('live');
    state.setDockPosition({ side: 'left', verticalAnchor: 'top', offsetY: 32 });
    state.setCommentDraftText('Draft comment');
    state.userPrompt = 'Keep padding crisp';
    state.notify();
    await state.autoSync();
    await state.submitBatch();

    expect(state.sessionStatus).toBe('submitted');
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resets state cleanly and clears VoiceRecorder override via resetForWorkbench', () => {
    const state = OverlayStateManager.getInstance();
    const recorder = VoiceRecorder.getInstance();

    state.isDockMenuOpen = true;
    state.isDrawerOpen = true;
    state.activeTool = 'voice';
    state.userPrompt = 'Check contrast';
    recorder.setWorkbenchState({
      isRecording: true,
      isReady: true,
      durationMs: 12000,
      transcript: 'Testing voice pill',
    });

    expect(recorder.getState().isRecording).toBe(true);
    expect(recorder.getState().transcript).toBe('Testing voice pill');

    state.resetForWorkbench();

    expect(state.isDockMenuOpen).toBe(false);
    expect(state.isDrawerOpen).toBe(false);
    expect(state.activeTool).toBe('none');
    expect(state.userPrompt).toBe('');
    expect(recorder.getState().isRecording).toBe(false);
    expect(recorder.getState().transcript).toBe('');
  });
});
