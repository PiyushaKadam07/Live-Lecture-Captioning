/**
 * Common interface for every speech recognition engine, so the rest of the app
 * does not care whether captions come from the Web Speech API or (later) Whisper.
 */
export interface RecognizerResult {
  /** Recognized text for the current utterance. */
  text: string;
  /** False while the engine is still guessing; true once the text is settled. */
  isFinal: boolean;
}

export type RecognizerErrorCode =
  | "not-allowed" // microphone permission denied
  | "no-microphone"
  | "network"
  | "unsupported"
  | "unknown";

export interface RecognizerError {
  code: RecognizerErrorCode;
  message: string;
}

export interface Recognizer {
  start(): void;
  stop(): void;
  onResult(callback: (result: RecognizerResult) => void): void;
  onError(callback: (error: RecognizerError) => void): void;
  /** Fired when the engine has fully stopped (after stop() or a fatal error). */
  onEnd(callback: () => void): void;
}
