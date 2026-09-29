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
const isDigits = (w) => /^[0-9]+$/.test(w);

export function wordsMatch(value, text) {
  const want = words(value);
  if (!want.length) return false;
  const have = words(text);
  return want.every((w) => {
    if (isDigits(w)) return have.includes(w);
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

const isAlnum = (c) => c !== undefined && /[a-z0-9]/.test(c);

// Like includesNorm, but requires the needle to sit on a token boundary in
// the haystack wherever the needle's own edge character is alphanumeric —
// so a raw substring like "555" can't be "found" as a fragment in the
// middle of a longer digit run such as a phone number. A needle edge that
// is punctuation (e.g. a quote starting with "(" or ending with ".") skips
// the boundary check on that side, since real quotes are often cut there.
export function includesToken(haystack, needle) {
  const n = norm(needle);
  if (!n.length) return false;
  const h = norm(haystack);
  const checkLeft = isAlnum(n[0]);
  const checkRight = isAlnum(n[n.length - 1]);
  let from = 0;
  for (;;) {
    const i = h.indexOf(n, from);
    if (i === -1) return false;
    const leftOk = !checkLeft || i === 0 || !isAlnum(h[i - 1]);
    const rightOk = !checkRight || i + n.length === h.length || !isAlnum(h[i + n.length]);
    if (leftOk && rightOk) return true;
    from = i + 1;
  }
}

export function quoteAround(line, start, len, max = 200) {
  if (line.length <= max) return line.trim();
  const pad = Math.max(0, Math.floor((max - len) / 2));
  const from = Math.max(0, Math.min(start - pad, line.length - max));
  const to = from + max;
  let slice = line.slice(from, to);
  if (from > 0) {
    const cut = slice.search(/\s/);
    if (cut !== -1) slice = slice.slice(cut + 1);
  }
  if (to < line.length) {
    const cut = slice.search(/\s\S*$/);
    if (cut !== -1) slice = slice.slice(0, cut);
  }
  return slice.trim();
}
