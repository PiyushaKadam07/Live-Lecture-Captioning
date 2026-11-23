import type { Engine, FontChoice, Settings, Theme } from "../settings";
import { FONT_LABELS, LANGUAGES } from "../settings";

type Props = {
  settings: Settings;
  onChange: (next: Partial<Settings>) => void;
  disabledLanguage: boolean;
};

const ENGINES: Array<{ value: Engine; label: string }> = [
  { value: "whisper", label: "Whisper (works in any browser, English)" },
  { value: "browser", label: "Browser speech (Chrome and Edge, many languages)" },
];

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "contrast", label: "High contrast" },
];

export function SettingsPanel({ settings, onChange, disabledLanguage }: Props) {
  return (
    <section className="panel" aria-labelledby="settings-title">
      <h2 id="settings-title">Display</h2>
      <div className="field">
        <label htmlFor="font-size">
          Text size <span className="value">{settings.fontSize}px</span>
        </label>
        <input id="font-size" type="range" min={20} max={96} step={2} value={settings.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label htmlFor="lines">
          Visible lines <span className="value">{settings.visibleLines}</span>
        </label>
        <input id="lines" type="range" min={2} max={10} step={1} value={settings.visibleLines}
          onChange={(e) => onChange({ visibleLines: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label htmlFor="line-height">
          Line spacing <span className="value">{settings.lineHeight.toFixed(1)}</span>
        </label>
        <input id="line-height" type="range" min={1.1} max={2} step={0.1} value={settings.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })} />
      </div>
      <fieldset className="field">
        <legend>Theme</legend>
        <div className="segmented">
          {THEMES.map((t) => (
            <label key={t.value} className={settings.theme === t.value ? "is-active" : ""}>
              <input type="radio" name="theme" value={t.value} checked={settings.theme === t.value}
                onChange={() => onChange({ theme: t.value })} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="font">Font</label>
        <select id="font" value={settings.font} onChange={(e) => onChange({ font: e.target.value as FontChoice })}>
          {(Object.keys(FONT_LABELS) as FontChoice[]).map((f) => (
            <option key={f} value={f}>{FONT_LABELS[f]}</option>
          ))}
        </select>
      </div>
            <div className="field">
        <label htmlFor="engine">Speech recognition</label>
        <select id="engine" value={settings.engine} disabled={disabledLanguage}
          onChange={(e) => onChange({ engine: e.target.value as Engine })}>
          {ENGINES.map((en) => (
            <option key={en.value} value={en.value}>{en.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="language">Spoken language</label>
        <select id="language" value={settings.engine === "whisper" ? "en-US" : settings.language}
          disabled={disabledLanguage || settings.engine === "whisper"}
          onChange={(e) => onChange({ language: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
        {disabledLanguage ? (
          <p className="hint">Stop captions to change these settings.</p>
        ) : settings.engine === "whisper" ? (
          <p className="hint">The Whisper engine understands English only for now.</p>
        ) : null}
      </div>
    </section>
  );
}
