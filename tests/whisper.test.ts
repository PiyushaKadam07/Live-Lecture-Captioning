import { describe, expect, it, vi } from "vitest";
import type { Microphone } from "../src/recognizers/whisper";
import { WhisperRecognizer } from "../src/recognizers/whisper";

const RATE = 16000;
const speech = (seconds: number) => Float32Array.from({ length: seconds * RATE }, (_, i) => 0.3 * Math.sin(i / 5));
const pause = (seconds: number) => new Float32Array(seconds * RATE);

/** A pretend microphone that tests feed audio into by hand. */
function fakeMic() {
  let feed: (samples: Float32Array) => void = () => {};
  const stop = vi.fn();
  const microphone: Microphone = async (onAudio) => {
    feed = onAudio;
    return { sampleRate: RATE, stop };
  };
  return { microphone, stop, say: (s: Float32Array) => feed(s) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("WhisperRecognizer", () => {
  it("sends each chunk with the previous text as a prompt and reports the result", async () => {
    const mic = fakeMic();
    const replies = ["The mitochondria", "makes energy."];
    const transcribe = vi.fn(async (_audio: Blob, _prompt: string) => replies.shift() ?? "");
    const recognizer = new WhisperRecognizer(mic.microphone, transcribe);
    const results: string[] = [];
    recognizer.onResult((r) => results.push(r.text));

    recognizer.start();
    await settle();
    mic.say(speech(3));
    mic.say(pause(0.5));
    mic.say(speech(3));
    mic.say(pause(0.5));
    await settle();

    expect(results).toEqual(["The mitochondria", "makes energy."]);
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect(transcribe.mock.calls[1][1]).toContain("The mitochondria");
  });

  it("sends the unfinished chunk on stop and ends only after it comes back", async () => {
    const mic = fakeMic();
    const recognizer = new WhisperRecognizer(mic.microphone, async () => "last words");
    const results: string[] = [];
    const ended = vi.fn();
    recognizer.onResult((r) => results.push(r.text));
    recognizer.onEnd(ended);

    recognizer.start();
    await settle();
    mic.say(speech(1));
    recognizer.stop();
    expect(mic.stop).toHaveBeenCalled();
    await settle();

    expect(results).toEqual(["last words"]);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("reports a blocked microphone clearly", async () => {
    const recognizer = new WhisperRecognizer(
      async () => { throw new DOMException("denied", "NotAllowedError"); },
      async () => "",
    );
    const onError = vi.fn();
    const ended = vi.fn();
    recognizer.onError(onError);
    recognizer.onEnd(ended);
    recognizer.start();
    await settle();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "not-allowed" }));
    expect(ended).toHaveBeenCalled();
  });

  it("keeps listening when the server is unreachable, and says so only once", async () => {
    const mic = fakeMic();
    const transcribe = vi.fn().mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockResolvedValue("back again");
    const recognizer = new WhisperRecognizer(mic.microphone, transcribe);
    const onError = vi.fn();
    const results: string[] = [];
    recognizer.onError(onError);
    recognizer.onResult((r) => results.push(r.text));

    recognizer.start();
    await settle();
    for (let i = 0; i < 3; i++) {
      mic.say(speech(3));
      mic.say(pause(0.5));
    }
    await settle();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].code).toBe("network");
    expect(results).toEqual(["back again"]);
  });
});