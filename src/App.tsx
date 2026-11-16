import { useEffect, useRef, useState } from "react";
import { CaptionView } from "./components/CaptionView";
import { SettingsPanel } from "./components/SettingsPanel";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { isWebSpeechSupported } from "./recognizers/webSpeech";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { loadJSON, saveJSON } from "./storage/local";
import { useCaptions, type RecognizerFactory } from "./useCaptions";

const SETTINGS_KEY = "lecture-captions:settings";

type Props = {
  /** Injected in tests; the real app uses the Web Speech API. */
  createRecognizer?: RecognizerFactory;
  supported?: boolean;
};

export default function App({ createRecognizer, supported = isWebSpeechSupported() }: Props) {
  const [settings, setSettings] = useState<Settings>(() => loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [autoScroll, setAutoScroll] = useState(true);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const captionRef = useRef<HTMLElement>(null);
  const { segments, status, error, start, stop, clear, dismissError } = useCaptions(settings.language, createRecognizer);
  const running = status === "listening" || status === "starting";

  useEffect(() => saveJSON(SETTINGS_KEY, settings), [settings]);
  const update = (next: Partial<Settings>) => setSettings((s) => ({ ...s, ...next }));

  const handleStart = () => {
    if (!settings.privacyAcknowledged) {
      setShowPrivacy(true);
      return;
    }
    start();
  };

  const acceptPrivacy = () => {
    update({ privacyAcknowledged: true });
    setShowPrivacy(false);
    start();
  };

  const goFullscreen = () => {
    captionRef.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="app" data-theme={settings.theme}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Lecture Captions</h1>
        </div>
        <p className="status" role="status" aria-live="polite">
          <span className={`dot dot-${running ? "on" : "off"}`} aria-hidden="true" />
          {status === "listening" ? "Listening to the microphone" : status === "starting" ? "Starting…" : status === "stopping" ? "Stopping…" : "Not listening"}
        </p>
      </header>

      <main className="layout">
        <section className="stage" ref={captionRef} aria-labelledby="captions-title">
          <h2 id="captions-title" className="visually-hidden">Captions</h2>

          {!supported && (
            <div className="notice notice-warn" role="alert">
              <strong>Live microphone captions need Chrome or Edge on a computer.</strong> This browser doesn't support the
              Web Speech API. Open this page in Chrome or Edge to caption a lecture.
            </div>
          )}

          {showPrivacy && (
            <div className="notice" role="dialog" aria-labelledby="privacy-title">
              <h3 id="privacy-title">Before you start</h3>
              <p>
                In this mode, your browser sends microphone audio to its speech service (Google in Chrome, Microsoft in Edge)
                to turn it into text. Transcripts are saved only on this device. Follow your university's rules about
                recording lectures.
              </p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={acceptPrivacy}>I understand, start captions</button>
                <button type="button" className="btn btn-quiet" onClick={() => setShowPrivacy(false)}>Not now</button>
              </div>
            </div>
          )}

          {error && (
            <div className="notice notice-error" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn-quiet" onClick={dismissError}>Dismiss</button>
            </div>
          )}

          <CaptionView segments={segments} settings={settings} autoScroll={autoScroll} listening={running} />

          <div className="controls">
            {running ? (
              <button type="button" className="btn btn-stop" onClick={stop}>Stop captions</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleStart} disabled={!supported || status === "stopping"}>
                Start captions
              </button>
            )}
            <button type="button" className="btn btn-quiet" aria-pressed={!autoScroll} onClick={() => setAutoScroll((a) => !a)}>
              {autoScroll ? "Pause scrolling" : "Resume scrolling"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={goFullscreen}>Full screen</button>
          </div>
        </section>

        <aside className="side">
          <TranscriptPanel segments={segments} onClear={clear} />
          <SettingsPanel settings={settings} onChange={update} disabledLanguage={running} />
        </aside>
      </main>

      <footer className="footer">
        Designed to support, not replace, qualified interpreters and captioners.{" "}
        <a href="https://github.com/PiyushaKadam07/Live-Lecture-Captioning" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </div>
  );
}
