import { describe, expect, it } from "vitest";
import { captionsReducer, searchSegments, type CaptionSegment } from "../src/captions/segments";

describe("caption store", () => {
  it("updates interim text in place, then finalizes it", () => {
    let s: CaptionSegment[] = [];
    s = captionsReducer(s, { type: "result", text: "today we", isFinal: false, atMs: 1000 });
    s = captionsReducer(s, { type: "result", text: "today we cover", isFinal: false, atMs: 1500 });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ text: "today we cover", isFinal: false, startMs: 1000, endMs: 1500 });

    s = captionsReducer(s, { type: "result", text: "Today we cover eigenvalues.", isFinal: true, atMs: 2000 });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ text: "Today we cover eigenvalues.", isFinal: true, startMs: 1000, endMs: 2000 });

    s = captionsReducer(s, { type: "result", text: "Next", isFinal: false, atMs: 2500 });
    expect(s).toHaveLength(2);
    expect(s[1]).toMatchObject({ startMs: 2500, isFinal: false });
  });

  it("ignores empty results, clears, and only reloads finished segments", () => {
    let s = captionsReducer([], { type: "result", text: "   ", isFinal: true, atMs: 0 });
    expect(s).toHaveLength(0);
    s = captionsReducer(s, { type: "result", text: "kept", isFinal: true, atMs: 0 });
    s = captionsReducer(s, { type: "result", text: "dropped", isFinal: false, atMs: 10 });
    expect(captionsReducer([], { type: "load", segments: s }).map((x) => x.text)).toEqual(["kept"]);
    expect(captionsReducer(s, { type: "clear" })).toEqual([]);
  });

  it("searches case-insensitively", () => {
    let s: CaptionSegment[] = [];
    for (const t of ["Mitochondria make energy", "The cell wall", "mitochondrial DNA"]) {
      s = captionsReducer(s, { type: "result", text: t, isFinal: true, atMs: 0 });
    }
    expect(searchSegments(s, "MITOCHONDRI").map((x) => x.text)).toEqual(["Mitochondria make energy", "mitochondrial DNA"]);
    expect(searchSegments(s, "  ")).toHaveLength(3);
  });
});
