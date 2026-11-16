import { useEffect, useRef } from "react";
import type { CaptionSegment } from "../captions/segments";
import type { Settings } from "../settings";
import { FONT_STACKS } from "../settings";

type Props = {
  segments: CaptionSegment[];
  settings: Settings;
  autoScroll: boolean;
  listening: boolean;
};

/** The large caption display. Gray text is still being recognized; full-contrast text is final. */
export function CaptionView({ segments, settings, autoScroll, listening }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lineHeightPx = settings.fontSize * settings.lineHeight;
  // Only the recent tail is rendered while auto-scrolling; paused mode shows everything for re-reading.
  const shown = autoScroll ? segments.slice(-Math.max(6, settings.visibleLines * 3)) : segments;

  useEffect(() => {
    const box = boxRef.current;
    if (box && autoScroll) box.scrollTop = box.scrollHeight;
  }, [segments, autoScroll]);

  return (
    <div
      ref={boxRef}
      className={`caption-box${autoScroll ? "" : " is-paused"}`}
      style={{
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
        fontFamily: FONT_STACKS[settings.font],
        height: `${lineHeightPx * settings.visibleLines + 32}px`,
      }}
      tabIndex={autoScroll ? -1 : 0}
      aria-label="Live captions"
    >
      {shown.length === 0 ? (
        <p className="caption-placeholder">
          {listening ? "Listening… captions will appear here as soon as someone speaks." : "Press Start captions to begin."}
        </p>
      ) : (
        <p className="caption-text">
          {shown.map((s) => (
            <span key={s.id} className={s.isFinal ? "seg-final" : "seg-interim"}>
              {s.text}{" "}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
