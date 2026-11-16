import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSpeechRecognizer, isWebSpeechSupported } from "../src/recognizers/webSpeech";
import { FakeSpeechRecognition } from "./fakeSpeech";

describe("WebSpeechRecognizer", () => {
  beforeEach(() => (FakeSpeechRecognition.instances = []));

  it("detects support from either constructor name", () => {
    expect(isWebSpeechSupported({})).toBe(false);
    expect(isWebSpeechSupported({ webkitSpeechRecognition: FakeSpeechRecognition })).toBe(true);
  });

  it("configures continuous interim recognition and reports results", () => {
    const rec = new WebSpeechRecognizer("en-GB", FakeSpeechRecognition);
    const fake = FakeSpeechRecognition.instances[0];
    expect(fake).toMatchObject({ continuous: true, interimResults: true, lang: "en-GB" });

    const results: Array<{ text: string; isFinal: boolean }> = [];
    rec.onResult((r) => results.push(r));
    rec.start();
    fake.emit([{ text: " Hello class ", isFinal: true }, { text: "today", isFinal: false }, { text: "we", isFinal: false }]);
    expect(results).toEqual([{ text: "Hello class", isFinal: true }, { text: "today we", isFinal: false }]);
  });

  it("restarts after Chrome ends the session on silence, but not after Stop", () => {
    const rec = new WebSpeechRecognizer("en-US", FakeSpeechRecognition);
    const fake = FakeSpeechRecognition.instances[0];
    const ended = vi.fn();
    rec.onEnd(ended);
    rec.start();
    fake.endBySilence();
    expect(fake.starts).toBe(2);
    expect(ended).not.toHaveBeenCalled();
    rec.stop();
    expect(ended).toHaveBeenCalledOnce();
    expect(fake.starts).toBe(2);
  });

  it("turns a blocked microphone into a clear message and stops restarting", () => {
    const rec = new WebSpeechRecognizer("en-US", FakeSpeechRecognition);
    const fake = FakeSpeechRecognition.instances[0];
    const errors: string[] = [];
    rec.onError((e) => errors.push(e.code));
    rec.start();
    fake.onerror?.({ error: "no-speech" }); // harmless pause
    fake.onerror?.({ error: "not-allowed" });
    fake.endBySilence();
    expect(errors).toEqual(["not-allowed"]);
    expect(fake.starts).toBe(1);
  });
});
