import type { SpeechRecognitionLike } from "../src/recognizers/webSpeech";

/** A stand-in for the browser's SpeechRecognition that tests can drive by hand. */
export class FakeSpeechRecognition implements SpeechRecognitionLike {
  static instances: FakeSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: SpeechRecognitionLike["onresult"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  starts = 0;
  running = false;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }
  start() {
    this.starts++;
    this.running = true;
  }
  stop() {
    this.running = false;
    this.onend?.();
  }
  abort() {
    this.stop();
  }
  /** Simulate the browser reporting results (one entry per utterance). */
  emit(results: Array<{ text: string; isFinal: boolean }>, resultIndex = 0) {
    const list = results.map((r) => ({ isFinal: r.isFinal, 0: { transcript: r.text } }));
    this.onresult?.({ resultIndex, results: list });
  }
  /** Simulate Chrome ending the session on its own after silence. */
  endBySilence() {
    this.running = false;
    this.onend?.();
  }
}
