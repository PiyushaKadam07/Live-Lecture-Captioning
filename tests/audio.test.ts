import { describe, expect, it } from "vitest";
import { Chunker, downsample, encodeWav, rms } from "../src/recognizers/audio";

const tone = (seconds: number, rate: number, level = 0.3) =>
  Float32Array.from({ length: seconds * rate }, (_, i) => level * Math.sin((2 * Math.PI * 220 * i) / rate));
const silence = (seconds: number, rate: number) => new Float32Array(seconds * rate);
const join = (...parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

describe("downsample", () => {
  it("turns 48 kHz into 16 kHz by averaging groups of three", () => {
    const out = downsample(Float32Array.from([1, 2, 3, 4, 5, 6]), 48000, 16000);
    expect(Array.from(out)).toEqual([2, 5]);
  });

  it("handles rates that don't divide evenly, like 44.1 kHz", () => {
    expect(downsample(new Float32Array(44100), 44100).length).toBe(16000);
  });
});

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16-bit WAV header the server accepts", async () => {
    const wav = encodeWav(Float32Array.from([0, 1, -1]));
    const view = new DataView(await wav.arrayBuffer());
    const text = (at: number) => String.fromCharCode(...new Uint8Array(view.buffer, at, 4));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6); // 3 samples x 2 bytes
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([0, 32767, -32768]);
  });
});

describe("Chunker", () => {
  const rate = 16000;

  it("waits for a pause after the minimum length, so words aren't cut", () => {
    const chunker = new Chunker(rate);
    expect(chunker.push(tone(2, rate))).toEqual([]); // too short to cut yet
    const chunks = chunker.push(join(tone(2, rate), silence(1, rate)));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBeCloseTo(4.1 * rate, -2); // cut at the first quiet frame
  });

  it("cuts at the maximum length even if the speaker never pauses", () => {
    const chunks = new Chunker(rate).push(tone(10, rate));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBe(8 * rate);
  });

  it("skips chunks that are silent all the way through", () => {
    const chunker = new Chunker(rate);
    expect(chunker.push(silence(10, rate))).toEqual([]);
    expect(chunker.flush()).toBeNull();
  });

  it("returns the leftover speech, at 16 kHz, when captions stop", () => {
    const chunker = new Chunker(48000);
    chunker.push(tone(1.5, 48000));
    const rest = chunker.flush();
    expect(rest?.length).toBe(1.5 * 16000);
    expect(rms(rest!)).toBeGreaterThan(0.1);
  });
});