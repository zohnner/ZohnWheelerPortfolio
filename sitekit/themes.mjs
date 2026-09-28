// Theme presets are what gets switched live in a sales demo. Each defines the
// same tokens for light and dark; `accent` can be overridden per site.

export const THEMES = {
  storm: {
    label: 'Storm',
    light: { bg: '#ffffff', surface: '#f3f5f9', text: '#0f1b2d', muted: '#4b5a73', primary: '#12233f', onPrimary: '#ffffff', border: '#dde3ec', accent: '#f97316', onAccent: '#111111' },
    dark: { bg: '#0b1220', surface: '#131d31', text: '#e8edf6', muted: '#a3b0c6', primary: '#16274a', onPrimary: '#ffffff', border: '#24334f', accent: '#fb923c', onAccent: '#111111' },
  },
  clean: {
    label: 'Clean',
    light: { bg: '#ffffff', surface: '#f5f8fc', text: '#111827', muted: '#4b5563', primary: '#0f3d91', onPrimary: '#ffffff', border: '#e2e8f0', accent: '#2563eb', onAccent: '#ffffff' },
    dark: { bg: '#0a0f1a', surface: '#111a2b', text: '#e5e9f0', muted: '#a0aec0', primary: '#132a57', onPrimary: '#ffffff', border: '#1f2c44', accent: '#60a5fa', onAccent: '#111111' },
  },
  bold: {
    label: 'Bold',
    light: { bg: '#ffffff', surface: '#f4f4f2', text: '#161616', muted: '#52525b', primary: '#1c1c1c', onPrimary: '#ffffff', border: '#e4e4e0', accent: '#facc15', onAccent: '#111111' },
    dark: { bg: '#0d0d0d', surface: '#171717', text: '#f2f2f0', muted: '#a8a8a3', primary: '#1f1f1f', onPrimary: '#ffffff', border: '#2a2a2a', accent: '#facc15', onAccent: '#111111' },
  },
  earth: {
    label: 'Earth',
    light: { bg: '#fdfcf9', surface: '#f3efe6', text: '#1f2a1f', muted: '#56604f', primary: '#23402b', onPrimary: '#ffffff', border: '#e3dccd', accent: '#c0823f', onAccent: '#111111' },
    dark: { bg: '#0f140f', surface: '#172017', text: '#ecefe6', muted: '#a9b3a0', primary: '#1d3323', onPrimary: '#ffffff', border: '#26332a', accent: '#d69a57', onAccent: '#111111' },
  },
};

export const ACCENT_SWATCHES = ['#f97316', '#2563eb', '#facc15', '#16a34a', '#dc2626', '#7c3aed'];

const HEX = /^#[0-9a-f]{6}$/i;
export function isHex(v) {
  return HEX.test(String(v ?? ''));
}

const MODES = new Set(['light', 'dark']);
const validPreset = (p) => typeof p === 'string' && Object.hasOwn(THEMES, p);

export function resolveTheme(base = {}, overrides = {}) {
  const preset = validPreset(overrides.preset) ? overrides.preset : validPreset(base.preset) ? base.preset : 'storm';
  const mode = MODES.has(overrides.mode) ? overrides.mode : MODES.has(base.mode) ? base.mode : 'light';
  const accent = isHex(overrides.accent) ? overrides.accent : isHex(base.accent) ? base.accent : null;
  return accent ? { preset, mode, accent } : { preset, mode };
}

// WCAG relative luminance — the naive 0.299/0.587/0.114 weighted average this
// replaced misjudged saturated colors like #f97316 as "light enough" for
// white text (2.8:1, fails AA) when black text is the correct, passing
// choice (7.5:1). 0.1791 is the luminance where black-on-X and white-on-X
// contrast ratios are equal; above it, black wins.
function relLuminance(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastText(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return relLuminance(r, g, b) > 0.1791 ? '#111111' : '#ffffff';
}

export function themeVars(theme) {
  const vars = { ...THEMES[theme.preset][theme.mode] };
  if (theme.accent) {
    vars.accent = theme.accent;
    vars.onAccent = contrastText(theme.accent);
  }
  return vars;
}

export function themeCss(theme) {
  return `:root{${Object.entries(themeVars(theme)).map(([k, v]) => `--${k}:${v}`).join(';')}}`;
}
