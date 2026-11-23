/**
 * Audio helpers for the Whisper engine: cut the microphone stream into chunks
 * at natural pauses, shrink them to 16 kHz, and wrap them as WAV files.
 */

export const WHISPER_RATE = 16000;

/** Loudness of a block of samples (root mean square). Speech is roughly 0.02-0.3. */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

/**
 * Lower the sample rate (e.g. 48 kHz -> 16 kHz) by averaging each group of
 * input samples. Averaging also removes sounds too high-pitched for the new rate.
 */
export function downsample(input: Float32Array, fromRate: number, toRate = WHISPER_RATE): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const output = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    output[i] = sum / (end - start);
  }
  return output;
}

/** Wrap samples (-1..1) as a 16-bit mono WAV file, the format the server reads. */
export function encodeWav(samples: Float32Array, sampleRate = WHISPER_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // size of the format section
  view.setUint16(20, 1, true); // 1 = plain PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  samples.forEach((s, i) => {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return new Blob([buffer], { type: "audio/wav" });
}

export type ChunkerOptions = {
  /** Don't cut before this much audio, so Whisper gets enough context. */
  minSeconds: number;
  /** Always cut by this point, so captions never fall too far behind. */
  maxSeconds: number;
  /** Below this loudness a 100 ms frame counts as a pause. */
  silence: number;
};

export const DEFAULT_CHUNKER: ChunkerOptions = { minSeconds: 3, maxSeconds: 8, silence: 0.01 };

/**
 * Collects microphone audio and hands back chunks ready to transcribe.
 * It cuts at the first pause after minSeconds, so words aren't split in half,
 * and skips chunks that are silent the whole way through.
 */
export class Chunker {
  private frames: Float32Array[] = [];
  private pending = new Float32Array(0);
  private loudest = 0;
  private readonly frameSize: number;

  constructor(private readonly sampleRate: number, private readonly options: ChunkerOptions = DEFAULT_CHUNKER) {
    this.frameSize = Math.round(sampleRate / 10); // 100 ms
  }

  /** Add audio; returns any chunks that are now complete. */
  push(samples: Float32Array): Float32Array[] {
    const joined = new Float32Array(this.pending.length + samples.length);
    joined.set(this.pending);
    joined.set(samples, this.pending.length);

    const ready: Float32Array[] = [];
    let offset = 0;
    while (offset + this.frameSize <= joined.length) {
      const frame = joined.slice(offset, offset + this.frameSize);
      offset += this.frameSize;
      this.frames.push(frame);
      const level = rms(frame);
      this.loudest = Math.max(this.loudest, level);

      const seconds = this.frames.length / 10;
      const pause = level < this.options.silence;
      if ((seconds >= this.options.minSeconds && pause) || seconds >= this.options.maxSeconds) {
        const chunk = this.take();
        if (chunk) ready.push(chunk);
      }
    }
    this.pending = joined.slice(offset);
    return ready;
  }

  /** Return whatever is left (when captions stop), or null if it's silence. */
  flush(): Float32Array | null {
    if (this.pending.length) this.frames.push(this.pending);
    this.pending = new Float32Array(0);
    return this.take();
  }

  private take(): Float32Array | null {
    const hadSpeech = this.loudest >= this.options.silence;
    const length = this.frames.reduce((n, f) => n + f.length, 0);
    const chunk = new Float32Array(length);
    let at = 0;
    for (const f of this.frames) {
      chunk.set(f, at);
      at += f.length;
    }
    this.frames = [];
    this.loudest = 0;
    return hadSpeech && length ? downsample(chunk, this.sampleRate) : null;
  }
}