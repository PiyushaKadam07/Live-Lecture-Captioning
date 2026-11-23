import { Chunker, encodeWav } from "./audio";
import type { Recognizer, RecognizerError, RecognizerResult } from "./Recognizer";

export const SPEECH_SERVER_URL: string =
  import.meta.env.VITE_SPEECH_SERVER_URL ?? "https://lecture-captions-api-610310613353.us-east1.run.app";

/** Starts the microphone and streams raw samples to onAudio. */
export type Microphone = (onAudio: (samples: Float32Array) => void) => Promise<{ sampleRate: number; stop: () => void }>;

/** Sends one WAV chunk to the speech server and returns the text. */
export type Transcriber = (audio: Blob, prompt: string) => Promise<string>;

export function isWhisperSupported(win: unknown = globalThis): boolean {
  const w = win as { navigator?: Navigator; AudioWorkletNode?: unknown };
  return Boolean(w.navigator?.mediaDevices?.getUserMedia && w.AudioWorkletNode);
}

/** Real microphone: getUserMedia -> AudioWorklet that posts raw samples back to us. */
export const openMicrophone: Microphone = async (onAudio) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const context = new AudioContext();
  await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}recorder-worklet.js`);
  const source = context.createMediaStreamSource(stream);
  const recorder = new AudioWorkletNode(context, "recorder");
  recorder.port.onmessage = (event: MessageEvent<Float32Array>) => onAudio(event.data);
  source.connect(recorder);
  recorder.connect(context.destination); // the recorder outputs silence; this just keeps it running
  await context.resume();

  return {
    sampleRate: context.sampleRate,
    stop: () => {
      recorder.port.onmessage = null;
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
};

export function serverTranscriber(baseUrl = SPEECH_SERVER_URL): Transcriber {
  return async (audio, prompt) => {
    const form = new FormData();
    form.append("audio", audio, "chunk.wav");
    form.append("prompt", prompt);
    const response = await fetch(`${baseUrl}/transcribe`, { method: "POST", body: form });
    if (!response.ok) throw new Error(`Speech server replied ${response.status}`);
    const data: { text: string } = await response.json();
    return data.text;
  };
}

function micError(error: unknown): RecognizerError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return { code: "not-allowed", message: "Microphone access was blocked. Allow the microphone in your browser's site settings, then press Start again." };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { code: "no-microphone", message: "No microphone was found. Connect a microphone and press Start again." };
  }
  return { code: "unknown", message: "Could not start the microphone." };
}

/**
 * Whisper engine. Records the microphone, cuts the audio at pauses, and sends
 * each chunk to our Whisper server. Chunks are sent one at a time, in order,
 * and each one gets the end of the previous text so sentences carry on.
 */
export class WhisperRecognizer implements Recognizer {
  private chunker: Chunker | null = null;
  private stopMic: (() => void) | null = null;
  private queue: Promise<void> = Promise.resolve();
  private previousText = "";
  private running = false;
  private reportedNetworkError = false;
  private resultCb: (r: RecognizerResult) => void = () => {};
  private errorCb: (e: RecognizerError) => void = () => {};
  private endCb: () => void = () => {};

  constructor(
    private readonly microphone: Microphone = openMicrophone,
    private readonly transcribe: Transcriber = serverTranscriber(),
  ) {}

  start(): void {
    this.running = true;
    this.microphone((samples) => {
      for (const chunk of this.chunker?.push(samples) ?? []) this.send(chunk);
    })
      .then(({ sampleRate, stop }) => {
        if (!this.running) return stop(); // Stop was pressed while the mic was starting
        this.chunker = new Chunker(sampleRate);
        this.stopMic = stop;
      })
      .catch((error) => {
        this.running = false;
        this.errorCb(micError(error));
        this.endCb();
      });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.stopMic?.();
    const rest = this.chunker?.flush();
    if (rest) this.send(rest);
    this.chunker = null;
    // End only after the last chunks have come back, so no words are lost.
    this.queue.then(() => this.endCb());
  }

  private send(chunk: Float32Array): void {
    this.queue = this.queue.then(async () => {
      try {
        const text = (await this.transcribe(encodeWav(chunk), this.previousText.slice(-200).trim())).trim();
        this.reportedNetworkError = false;
        if (text) {
          this.previousText += ` ${text}`;
          this.resultCb({ text, isFinal: true });
        }
      } catch {
        // Keep listening, but only show the message once until the server answers again.
        if (!this.reportedNetworkError) {
          this.reportedNetworkError = true;
          this.errorCb({ code: "network", message: "Couldn't reach the speech server. Check your internet connection; captions will continue when it's back." });
        }
      }
    });
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