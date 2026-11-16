import type { CaptionSegment } from "../captions/segments";

const pad = (n: number, width = 2) => String(Math.floor(n)).padStart(width, "0");

/** 3723456 ms -> "01:02:03.456" (WebVTT) or "01:02:03,456" (SubRip). */
export function formatTimestamp(ms: number, separator: "." | "," = "."): string {
  const total = Math.max(0, Math.round(ms));
  const h = total / 3_600_000;
  const m = (total % 3_600_000) / 60_000;
  const s = (total % 60_000) / 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(total % 1000, 3)}`;
}

/** 83000 ms -> "1:23", 3723000 ms -> "1:02:03" (for on-screen timestamps). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Subtitle cues need a visible duration: at least 1 s, and never overlapping the next cue. */
function cueTimes(segments: CaptionSegment[]): Array<{ seg: CaptionSegment; start: number; end: number }> {
  return segments.map((seg, i) => {
    const next = segments[i + 1];
    let end = Math.max(seg.endMs, seg.startMs + 1000);
    if (next) end = Math.min(end, Math.max(next.startMs, seg.startMs + 1));
    return { seg, start: seg.startMs, end };
  });
}

const finals = (segments: CaptionSegment[]) => segments.filter((s) => s.isFinal && s.text.trim());

export function toTxt(segments: CaptionSegment[], withTimestamps = true): string {
  return finals(segments)
    .map((s) => (withTimestamps ? `[${formatClock(s.startMs)}] ${s.text}` : s.text))
    .join("\n") + "\n";
}

export function toVtt(segments: CaptionSegment[]): string {
  const cues = cueTimes(finals(segments)).map(
    ({ seg, start, end }, i) => `${i + 1}\n${formatTimestamp(start, ".")} --> ${formatTimestamp(end, ".")}\n${seg.text}`,
  );
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export function toSrt(segments: CaptionSegment[]): string {
  const cues = cueTimes(finals(segments)).map(
    ({ seg, start, end }, i) => `${i + 1}\n${formatTimestamp(start, ",")} --> ${formatTimestamp(end, ",")}\n${seg.text}`,
  );
  return cues.join("\n\n") + "\n";
}

export type ExportFormat = "txt" | "vtt" | "srt";

export const EXPORTERS: Record<ExportFormat, { label: string; mime: string; build: (s: CaptionSegment[]) => string }> = {
  txt: { label: "Text (.txt)", mime: "text/plain", build: (s) => toTxt(s) },
  vtt: { label: "WebVTT (.vtt)", mime: "text/vtt", build: toVtt },
  srt: { label: "SubRip (.srt)", mime: "application/x-subrip", build: toSrt },
};

/** Trigger a browser download of the transcript in the chosen format. */
export function downloadTranscript(segments: CaptionSegment[], format: ExportFormat, date = new Date()): void {
  const { mime, build } = EXPORTERS[format];
  const blob = new Blob([build(segments)], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lecture-captions-${date.toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
