import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceRecorder } from '../inspector/voice-recorder.js';

class MockSpeechRecognition {
  public continuous = false;
  public interimResults = false;
  public maxAlternatives = 1;
  public lang = 'en-US';

  public onstart: ((e: any) => void) | null = null;
  public onaudiostart: ((e: any) => void) | null = null;
  public onresult: ((e: any) => void) | null = null;
  public onerror: ((e: any) => void) | null = null;
  public onend: ((e: any) => void) | null = null;

  public start = vi.fn(() => {
    if (this.onstart) this.onstart({});
  });
  public stop = vi.fn();

  // Test helper to simulate speech recognition receiving transcribed words
  public simulateSpeech(finalChunk: string, interimText = '') {
    if (!this.onresult) return;
    const results: any[] = [];
    if (finalChunk) {
      results.push([{ transcript: finalChunk }]);
      results[0].isFinal = true;
    }
    if (interimText) {
      results.push([{ transcript: interimText }]);
      results[results.length - 1].isFinal = false;
    }

    this.onresult({
      resultIndex: 0,
      results,
    });
  }
}

describe('VoiceRecorder', () => {
  let mockRecognition: MockSpeechRecognition;

  beforeEach(() => {
    mockRecognition = new MockSpeechRecognition();
    (globalThis as any).window = {
      SpeechRecognition: vi.fn(() => mockRecognition),
      location: { href: 'http://localhost:3000/app', pathname: '/app' },
    };
    (globalThis as any).document = {
      title: 'App Test',
    };
    // Reset singleton instance for test isolation
    (VoiceRecorder as any).instance = undefined;
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
  });

  it('detects Web Speech API support', () => {
    expect(VoiceRecorder.isSupported()).toBe(true);
  });

  it('records speech and interleaves target pins into transcript', async () => {
    const recorder = VoiceRecorder.getInstance();
    recorder.start();

    expect(recorder.getState().isRecording).toBe(true);

    // 1. User says: "Here I think the font is too big"
    mockRecognition.simulateSpeech('Here I think the font is too big');

    // 2. User clicks Hero title element
    const pin1 = recorder.addPin({
      selector: 'h1.hero-title',
      sourceLocation: {
        fileName: 'src/Hero.tsx',
        lineNumber: 14,
        componentName: 'HeroTitle',
        selector: 'h1.hero-title',
        tag: 'h1',
      },
      htmlSnippet: '<h1 class="hero-title">Build faster</h1>',
      bounds: { x: 100, y: 150, width: 300, height: 40 },
    });

    expect(pin1.order).toBe(1);

    // 3. User says: "and this button is too small"
    mockRecognition.simulateSpeech('and this button is too small');

    // 4. User clicks CTA button element
    const pin2 = recorder.addPin({
      selector: 'button.cta-btn',
      sourceLocation: {
        fileName: 'src/Hero.tsx',
        lineNumber: 32,
        componentName: 'CTAButton',
        selector: 'button.cta-btn',
        tag: 'button',
      },
      htmlSnippet: '<button class="cta-btn">Get Started</button>',
      bounds: { x: 100, y: 220, width: 140, height: 40 },
    });

    expect(pin2.order).toBe(2);

    // 5. User finishes with: "make it bigger."
    mockRecognition.simulateSpeech('make it bigger.');

    // 6. Stop recording
    const review = await recorder.stop();

    expect(review).not.toBeNull();
    expect(review?.pins).toHaveLength(2);
    expect(review?.transcript).toBe('Here I think the font is too big and this button is too small make it bigger.');

    // Verify annotated transcript contains both targets at the right inline locations
    expect(review?.annotatedTranscript).toContain('Here I think the font is too big');
    expect(review?.annotatedTranscript).toContain('[Target 1]');
    expect(review?.annotatedTranscript).toContain('and this button is too small');
    expect(review?.annotatedTranscript).toContain('[Target 2]');
    expect(review?.annotatedTranscript).toContain('make it bigger.');
  });

  it('initializes speech recognition gracefully when navigator is undefined (e.g. Node 20)', async () => {
    const origNav = (globalThis as any).navigator;
    try {
      // Force navigator to be undefined to simulate Node 20
      delete (globalThis as any).navigator;

      (VoiceRecorder as any).instance = undefined;
      const recorder = VoiceRecorder.getInstance();
      recorder.start();

      mockRecognition.simulateSpeech('Testing without navigator');
      const review = await recorder.stop();

      expect(review?.transcript).toBe('Testing without navigator');
    } finally {
      if (origNav !== undefined) {
        (globalThis as any).navigator = origNav;
      }
    }
  });
});
