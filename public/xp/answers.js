// Scripted understanding for plain-English input: keyword scoring against
// the knowledge base in content.js, and "did you mean" suggestions. Pure.

const STOP = new Set((
  'a am an and any are be can could did do does for from give has have how i in is it me my of on or '
  + 'please s show some t tell that the there this to was what whats who with would you your about '
  + 'zohn zohns wheeler'
).split(' '));

function stem(t) {
  return t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t) ? t.slice(0, -1) : t;
}

export function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map(stem)
    .filter((t) => !STOP.has(t));
}

export function answer(input, kb, { threshold = 1 } = {}) {
  const tokens = tokenize(input);
  if (!tokens.length) return null;
  let best = null;
  let bestScore = 0;
  for (const entry of kb) {
    const keys = new Set(entry.keywords);
    const score = tokens.filter((t) => keys.has(t)).length;
    if (score > bestScore) { best = entry; bestScore = score; }
  }
  return best && bestScore >= threshold ? { id: best.id, reply: best.reply, score: bestScore } : null;
}

export function editDistance(a, b) {
  const s = String(a);
  const t = String(b);
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    for (let j = 1; j <= t.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[t.length];
}

export function suggest(word, candidates) {
  const w = String(word ?? '').toLowerCase();
  if (w.length < 3) return null;
  const max = w.length <= 3 ? 1 : 2;
  let best = null;
  let bestDistance = Infinity;
  for (const c of new Set(candidates)) {
    const d = editDistance(w, c);
    if (d < bestDistance) { best = c; bestDistance = d; }
  }
  return bestDistance > 0 && bestDistance <= max ? best : null;
}
