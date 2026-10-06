import { VoiceTargetPin, VoiceReviewWalkthrough, formatVoiceTargetTag, SourceLocation } from '@visual-edit/core';

export interface VoiceRecorderState {
  isRecording: boolean;
  isReady: boolean;
  durationMs: number;
  transcript: string;
  interimTranscript: string;
  annotatedTranscript: string;
  pins: VoiceTargetPin[];
  error?: string;
}

export class VoiceRecorder {
  private static instance: VoiceRecorder;
  private recognition: any = null;
  private isRecording = false;
  private isReady = false;
  private startTime = 0;
  private timerInterval: any = null;

  private transcript = '';
  private interimTranscript = '';
  private annotatedTranscript = '';
  private lastProcessedLength = 0;
  private pins: VoiceTargetPin[] = [];
  private listeners = new Set<(state: VoiceRecorderState) => void>();
  private error?: string;

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public static getInstance(): VoiceRecorder {
    if (!VoiceRecorder.instance) {
      VoiceRecorder.instance = new VoiceRecorder();
    }
    return VoiceRecorder.instance;
  }

  private constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let defaultLang = 'en-US';
      if (typeof navigator !== 'undefined' && navigator?.language) {
        defaultLang = navigator.language;
      } else if (typeof window !== 'undefined' && (window as any).navigator?.language) {
        defaultLang = (window as any).navigator.language;
      }
      recognition.lang = defaultLang;

      recognition.onstart = () => {
        this.isReady = true;
        if (this.startTime === 0) {
          this.startTime = performance.now();
        }
        this.notify();
      };

      recognition.onaudiostart = () => {
        this.isReady = true;
        if (this.startTime === 0) {
          this.startTime = performance.now();
        }
        this.notify();
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (finalChunk) {
          const cleanChunk = finalChunk.trim();
          if (cleanChunk) {
            if (this.transcript.length > 0 && !this.transcript.endsWith(' ')) {
              this.transcript += ' ';
            }
            this.transcript += cleanChunk;
          }
        }

        this.interimTranscript = interim;
        this.notify();
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Normal silence, ignore
          return;
        }
        if (event.error === 'not-allowed') {
          this.error = 'Microphone permission denied. Please allow microphone access.';
        } else {
          this.error = `Speech error: ${event.error}`;
        }
        this.notify();
      };

      recognition.onend = () => {
        // If recording is still supposed to be active, automatically restart it
        // (browsers may stop recognition after prolonged silence)
        if (this.isRecording) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      this.recognition = recognition;
    } catch (err: any) {
      this.error = err?.message || 'Failed to initialize speech recognition';
    }
  }

  public subscribe(fn: (state: VoiceRecorderState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  public getState(): VoiceRecorderState {
    const durationMs =
      this.isRecording && this.isReady && this.startTime > 0
        ? Math.round(performance.now() - this.startTime)
        : 0;
    return {
      isRecording: this.isRecording,
      isReady: this.isReady,
      durationMs,
      transcript: this.transcript,
      interimTranscript: this.interimTranscript,
      annotatedTranscript: this.buildCurrentAnnotatedTranscript(),
      pins: [...this.pins],
      error: this.error,
    };
  }

  public start(): boolean {
    if (this.isRecording) return true;
    this.error = undefined;
    this.transcript = '';
    this.interimTranscript = '';
    this.annotatedTranscript = '';
    this.lastProcessedLength = 0;
    this.pins = [];
    this.startTime = 0;
    this.isRecording = true;
    this.isReady = false;

    if (!VoiceRecorder.isSupported()) {
      this.error = 'Web Speech API is not supported in this browser. Use Chrome, Edge, or Safari.';
      this.notify();
      return false;
    }

    try {
      this.initRecognition();
      this.recognition.start();
    } catch (e: any) {
      this.error = e?.message || 'Could not start recording';
      this.notify();
    }

    // Safety timeout: If browser does not fire onaudiostart within 700ms, mark as ready
    setTimeout(() => {
      if (this.isRecording && !this.isReady) {
        this.isReady = true;
        if (this.startTime === 0) {
          this.startTime = performance.now();
        }
        this.notify();
      }
    }, 700);

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isRecording && this.isReady) {
        this.notify();
      }
    }, 250);

    this.notify();
    return true;
  }

  public addPin(target: {
    selector: string;
    sourceLocation?: SourceLocation;
    htmlSnippet?: string;
    bounds?: { x: number; y: number; width: number; height: number };
  }): VoiceTargetPin {
    const order = this.pins.length + 1;
    const pin: VoiceTargetPin = {
      id: `vpin_${Date.now()}_${order}`,
      order,
      targetSelector: target.selector,
      sourceLocation: target.sourceLocation,
      htmlSnippet: target.htmlSnippet,
      bounds: target.bounds,
      timestampMs: this.startTime > 0 ? Math.round(performance.now() - this.startTime) : 0,
    };

    this.pins.push(pin);

    // Commit any spoken text up to this moment, then embed the target tag
    const currentSpoken = this.getCurrentFullText();
    const newSpoken = currentSpoken.slice(this.lastProcessedLength).trim();

    const tag = formatVoiceTargetTag(pin);

    if (newSpoken) {
      if (this.annotatedTranscript.length > 0 && !this.annotatedTranscript.endsWith(' ')) {
        this.annotatedTranscript += ' ';
      }
      this.annotatedTranscript += newSpoken;
    }

    if (this.annotatedTranscript.length > 0 && !this.annotatedTranscript.endsWith(' ')) {
      this.annotatedTranscript += ' ';
    }
    this.annotatedTranscript += tag;

    this.lastProcessedLength = currentSpoken.length;
    this.notify();
    return pin;
  }

  private getCurrentFullText(): string {
    const parts: string[] = [];
    if (this.transcript.trim()) parts.push(this.transcript.trim());
    if (this.interimTranscript.trim()) parts.push(this.interimTranscript.trim());
    return parts.join(' ').trim();
  }

  private buildCurrentAnnotatedTranscript(): string {
    let result = this.annotatedTranscript;
    const currentSpoken = this.getCurrentFullText();
    const remainingSpoken = currentSpoken.slice(this.lastProcessedLength).trim();
    if (remainingSpoken) {
      if (result.length > 0 && !result.endsWith(' ')) {
        result += ' ';
      }
      result += remainingSpoken;
    }
    return result;
  }

  public async stop(): Promise<VoiceReviewWalkthrough | null> {
    if (!this.isRecording) return null;
    this.isRecording = false;
    this.isReady = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    try {
      if (this.recognition) {
        this.recognition.stop();
      }
    } catch (e) {}

    // Flush window: Allow the speech recognition engine to decode the final speech buffer
    const flushDelay = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 500;
    if (flushDelay > 0) {
      await new Promise((r) => setTimeout(r, flushDelay));
    }

    // In case there is still interim text that has not been converted to final,
    // append it to the transcript so no spoken words are lost
    if (this.interimTranscript.trim()) {
      if (this.transcript.length > 0 && !this.transcript.endsWith(' ')) {
        this.transcript += ' ';
      }
      this.transcript += this.interimTranscript.trim();
      this.interimTranscript = '';
    }

    const totalDurationMs = this.startTime > 0 ? Math.round(performance.now() - this.startTime) : 0;
    const finalAnnotated = this.buildCurrentAnnotatedTranscript().trim();
    const finalRawTranscript = this.getCurrentFullText().trim();

    // If there is no transcript and no pins, return null
    if (!finalRawTranscript && this.pins.length === 0) {
      this.notify();
      return null;
    }

    const review: VoiceReviewWalkthrough = {
      id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      durationMs: totalDurationMs,
      transcript: finalRawTranscript,
      annotatedTranscript: finalAnnotated || finalRawTranscript,
      pins: [...this.pins],
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
      pageTitle: typeof document !== 'undefined' ? document.title : undefined,
    };

    this.notify();
    return review;
  }

  public cancel(): void {
    this.isRecording = false;
    this.isReady = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    try {
      if (this.recognition) {
        this.recognition.stop();
      }
    } catch (e) {}
    this.transcript = '';
    this.interimTranscript = '';
    this.annotatedTranscript = '';
    this.pins = [];
    this.lastProcessedLength = 0;
    this.notify();
  }
}
