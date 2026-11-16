import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { captionsReducer, type CaptionSegment } from "./captions/segments";
import type { Recognizer } from "./recognizers/Recognizer";
import { WebSpeechRecognizer } from "./recognizers/webSpeech";
import { loadArray, saveJSON } from "./storage/local";

export type Status = "idle" | "starting" | "listening" | "stopping";
export type RecognizerFactory = (lang: string) => Recognizer;

const TRANSCRIPT_KEY = "lecture-captions:transcript";
const defaultFactory: RecognizerFactory = (lang) => new WebSpeechRecognizer(lang);

/**
 * Owns the caption store and the recognizer lifecycle.
 * Final segments are saved on this device so a refresh doesn't lose the transcript.
 */
export function useCaptions(language: string, createRecognizer: RecognizerFactory = defaultFactory) {
  const [segments, dispatch] = useReducer(captionsReducer, undefined, () =>
    captionsReducer([], { type: "load", segments: loadArray<CaptionSegment>(TRANSCRIPT_KEY) }),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const clockRef = useRef(0); // performance.now() value that corresponds to transcript time 0
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    saveJSON(TRANSCRIPT_KEY, segments.filter((s) => s.isFinal));
  }, [segments]);

  const start = useCallback(() => {
    if (recognizerRef.current) return;
    setError(null);
    let recognizer: Recognizer;
    try {
      recognizer = createRecognizer(language);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start speech recognition.");
      return;
    }
    // Continue the transcript timeline after any earlier session.
    const last = segmentsRef.current[segmentsRef.current.length - 1];
    clockRef.current = performance.now() - (last ? last.endMs + 1000 : 0);

    recognizer.onResult(({ text, isFinal }) => {
      setStatus("listening");
      dispatch({ type: "result", text, isFinal, atMs: performance.now() - clockRef.current });
    });
    recognizer.onError((err) => setError(err.message));
    recognizer.onEnd(() => {
      recognizerRef.current = null;
      setStatus("idle");
    });
    recognizerRef.current = recognizer;
    setStatus("starting");
    try {
      recognizer.start();
      setStatus("listening");
    } catch (e) {
      recognizerRef.current = null;
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Could not start speech recognition.");
    }
  }, [createRecognizer, language]);

  const stop = useCallback(() => {
    if (!recognizerRef.current) return;
    setStatus("stopping");
    recognizerRef.current.stop();
  }, []);

  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  useEffect(() => () => recognizerRef.current?.stop(), []);

  return { segments, status, error, start, stop, clear, dismissError: () => setError(null) };
}
