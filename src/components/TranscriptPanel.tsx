import { useMemo, useState } from "react";
import { searchSegments, type CaptionSegment } from "../captions/segments";
import { EXPORTERS, downloadTranscript, formatClock, type ExportFormat } from "../export/formats";

type Props = {
  segments: CaptionSegment[];
  onClear: () => void;
};

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : p));
}

/** Running transcript with timestamps, search and export. */
export function TranscriptPanel({ segments, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const finals = useMemo(() => segments.filter((s) => s.isFinal), [segments]);
  const matches = useMemo(() => searchSegments(finals, query), [finals, query]);

  return (
    <section className="panel transcript" aria-labelledby="transcript-title">
      <div className="panel-head">
        <h2 id="transcript-title">Transcript</h2>
        <span className="count">{finals.length} {finals.length === 1 ? "line" : "lines"}</span>
      </div>

      <label htmlFor="search" className="visually-hidden">Search the transcript</label>
      <input id="search" type="search" placeholder="Search the transcript" value={query}
        onChange={(e) => setQuery(e.target.value)} />
      {query && <p className="hint" role="status">{matches.length} {matches.length === 1 ? "match" : "matches"}</p>}

      <ol className="transcript-list">
        {matches.map((s) => (
          <li key={s.id}>
            <time>{formatClock(s.startMs)}</time>
            <span>{highlight(s.text, query)}</span>
          </li>
        ))}
        {finals.length === 0 && <li className="empty">Finished lines appear here, with timestamps, as captions run.</li>}
      </ol>

      <div className="export" role="group" aria-label="Download transcript">
        {(Object.keys(EXPORTERS) as ExportFormat[]).map((f) => (
          <button key={f} type="button" className="btn btn-quiet" disabled={finals.length === 0}
            onClick={() => downloadTranscript(finals, f)}>
            {EXPORTERS[f].label}
          </button>
        ))}
      </div>

      <div className="clear-row">
        {confirmClear ? (
          <>
            <span>Delete the whole transcript from this device?</span>
            <button type="button" className="btn btn-danger" onClick={() => { onClear(); setConfirmClear(false); }}>
              Delete transcript
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmClear(false)}>Keep it</button>
          </>
        ) : (
          <button type="button" className="btn btn-quiet" disabled={finals.length === 0} onClick={() => setConfirmClear(true)}>
            Clear transcript
          </button>
        )}
      </div>
    </section>
  );
}
