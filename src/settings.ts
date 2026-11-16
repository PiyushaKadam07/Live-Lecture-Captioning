export type Theme = "dark" | "light" | "contrast";
export type FontChoice = "atkinson" | "lexend" | "system";

export type Settings = {
  fontSize: number; // px
  lineHeight: number; // multiplier
  visibleLines: number;
  theme: Theme;
  font: FontChoice;
  language: string; // BCP-47, e.g. "en-US"
  privacyAcknowledged: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 40,
  lineHeight: 1.4,
  visibleLines: 4,
  theme: "dark",
  font: "atkinson",
  language: "en-US",
  privacyAcknowledged: false,
};

export const FONT_STACKS: Record<FontChoice, string> = {
  atkinson: '"Atkinson Hyperlegible", system-ui, sans-serif',
  lexend: '"Lexend", system-ui, sans-serif',
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export const FONT_LABELS: Record<FontChoice, string> = {
  atkinson: "Atkinson Hyperlegible (high legibility)",
  lexend: "Lexend (reading-friendly)",
  system: "System font",
};

export const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-IN", label: "English (India)" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "hi-IN", label: "Hindi" },
];
