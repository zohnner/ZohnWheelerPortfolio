// Shared text matching for the scaffolder. Facts are matched loosely on
// form (case, whitespace, quote style, dashes, plurals) but never on meaning.

export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function words(s) {
  return norm(s).replace(/'/g, '').match(/[a-z0-9]+/g) || [];
}

const stem = (w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w);

export function wordsMatch(value, text) {
  const want = words(value);
  if (!want.length) return false;
  const have = words(text);
  return want.every((w) => {
    const s = stem(w);
    return have.some((h) => h.startsWith(s));
  });
}

export function digits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

export function phoneDigits(s) {
  const d = digits(s);
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

export function numbersIn(s) {
  return (String(s ?? '').replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

export function includesNorm(haystack, needle) {
  const n = norm(needle);
  return n.length > 0 && norm(haystack).includes(n);
}

export function quoteAround(line, start, len, max = 200) {
  if (line.length <= max) return line.trim();
  const pad = Math.max(0, Math.floor((max - len) / 2));
  const from = Math.max(0, Math.min(start - pad, line.length - max));
  return line.slice(from, from + max).trim();
}
