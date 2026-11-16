import type { Recognizer, RecognizerError, RecognizerResult } from "./Recognizer";

// Minimal typings for the Web Speech API, which TypeScript's DOM library does not include.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(win: unknown = globalThis): SpeechRecognitionConstructor | null {
  const w = win as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isWebSpeechSupported(win: unknown = globalThis): boolean {
  return getSpeechRecognition(win) !== null;
}

const FATAL_ERRORS: Record<string, RecognizerError> = {
  "not-allowed": { code: "not-allowed", message: "Microphone access was blocked. Allow the microphone in your browser's site settings, then press Start again." },
  "service-not-allowed": { code: "not-allowed", message: "Speech recognition is blocked in this browser. Try Chrome or Edge, and make sure the page is opened over HTTPS." },
  "audio-capture": { code: "no-microphone", message: "No microphone was found. Connect a microphone and press Start again." },
  network: { code: "network", message: "Captions need an internet connection in this mode. Check your connection and press Start again." },
};

/**
 * Web Speech API engine. Chrome ends a recognition session after a pause in speech,
 * so while the user has not pressed Stop, the engine quietly restarts itself.
 */
export class WebSpeechRecognizer implements Recognizer {
  private recognition: SpeechRecognitionLike;
  private wanted = false;
  private resultCb: (r: RecognizerResult) => void = () => {};
  private errorCb: (e: RecognizerError) => void = () => {};
  private endCb: () => void = () => {};

  constructor(lang = "en-US", Ctor: SpeechRecognitionConstructor | null = getSpeechRecognition()) {
    if (!Ctor) throw new Error("Web Speech API is not supported in this browser.");
    this.recognition = new Ctor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = lang;

    this.recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) this.resultCb({ text, isFinal: true });
        else interim += (interim ? " " : "") + text;
      }
      if (interim) this.resultCb({ text: interim, isFinal: false });
    };

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return; // normal during pauses
      const fatal = FATAL_ERRORS[event.error];
      if (fatal) {
        this.wanted = false;
        this.errorCb(fatal);
      } else {
        this.errorCb({ code: "unknown", message: `Speech recognition error: ${event.error}` });
      }
    };

    this.recognition.onend = () => {
      if (this.wanted) {
        try {
          this.recognition.start();
          return;
        } catch {
          this.wanted = false;
        }
      }
      this.endCb();
    };
  }

  start(): void {
    this.wanted = true;
    this.recognition.start();
  }

  stop(): void {
    this.wanted = false;
    this.recognition.stop();
  }

  onResult(callback: (result: RecognizerResult) => void): void {
    this.resultCb = callback;
  }

  onError(callback: (error: RecognizerError) => void): void {
    this.errorCb = callback;
  }

  onEnd(callback: () => void): void {
    this.endCb = callback;
  }
}
