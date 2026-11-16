/** One caption segment: a stretch of speech with its timing. */
export type CaptionSegment = {
  id: string;
  text: string;
  startMs: number; // time since the session started
  endMs: number;
  isFinal: boolean; // false while the recognizer is still guessing
  source: "mic" | "video" | "tab";
};

export type CaptionAction =
  | { type: "result"; text: string; isFinal: boolean; atMs: number; source?: CaptionSegment["source"] }
  | { type: "clear" }
  | { type: "load"; segments: CaptionSegment[] };

let counter = 0;
const newId = () => `seg-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * The caption store. Interim text keeps updating the last open segment;
 * a final result closes it. The next result starts a new segment.
 */
export function captionsReducer(state: CaptionSegment[], action: CaptionAction): CaptionSegment[] {
  switch (action.type) {
    case "clear":
      return [];
    case "load":
      return action.segments.filter((s) => s.isFinal);
    case "result": {
      const text = action.text.trim();
      if (!text) return state;
      const last = state[state.length - 1];
      if (last && !last.isFinal) {
        const updated: CaptionSegment = { ...last, text, endMs: Math.max(action.atMs, last.startMs), isFinal: action.isFinal };
        return [...state.slice(0, -1), updated];
      }
      const segment: CaptionSegment = {
        id: newId(),
        text,
        startMs: action.atMs,
        endMs: action.atMs,
        isFinal: action.isFinal,
        source: action.source ?? "mic",
      };
      return [...state, segment];
    }
  }
}

/** Case-insensitive search over the transcript; returns matching segments. */
export function searchSegments(segments: CaptionSegment[], query: string): CaptionSegment[] {
  const q = query.trim().toLowerCase();
  if (!q) return segments;
  return segments.filter((s) => s.text.toLowerCase().includes(q));
}
