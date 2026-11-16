import { describe, expect, it } from "vitest";
import type { CaptionSegment } from "../src/captions/segments";
import { formatClock, formatTimestamp, toSrt, toTxt, toVtt } from "../src/export/formats";

const seg = (text: string, startMs: number, endMs: number, isFinal = true): CaptionSegment => ({
  id: `${text}-${startMs}`, text, startMs, endMs, isFinal, source: "mic",
});

describe("timestamps", () => {
  it("formats WebVTT and SubRip times", () => {
    expect(formatTimestamp(3_723_456, ".")).toBe("01:02:03.456");
    expect(formatTimestamp(3_723_456, ",")).toBe("01:02:03,456");
    expect(formatTimestamp(0)).toBe("00:00:00.000");
    expect(formatTimestamp(-50)).toBe("00:00:00.000");
  });
  it("formats on-screen clock times", () => {
    expect(formatClock(83_000)).toBe("1:23");
    expect(formatClock(3_723_000)).toBe("1:02:03");
  });
});

describe("exporters", () => {
  const segments = [
    seg("Today we cover eigenvalues.", 1_000, 3_500),
    seg("An eigenvector keeps its direction.", 4_000, 4_200), // shorter than 1 s
    seg("still being recognized", 6_000, 6_100, false), // interim: never exported
  ];

  it("writes plain text with timestamps and skips interim text", () => {
    expect(toTxt(segments)).toBe("[0:01] Today we cover eigenvalues.\n[0:04] An eigenvector keeps its direction.\n");
    expect(toTxt(segments, false)).not.toContain("[");
  });

  it("writes valid WebVTT with a minimum cue length", () => {
    expect(toVtt(segments)).toBe(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500\nToday we cover eigenvalues.\n\n" +
        "2\n00:00:04.000 --> 00:00:05.000\nAn eigenvector keeps its direction.\n",
    );
  });

  it("writes SubRip with comma timestamps and never overlaps the next cue", () => {
    const srt = toSrt([seg("A", 0, 200), seg("B", 500, 3_000)]);
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:00,500\nA\n\n2\n00:00:00,500 --> 00:00:03,000\nB\n");
  });
});
