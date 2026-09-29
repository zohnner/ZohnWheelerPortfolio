// sitekit/scaffold/extract.mjs
// HTML → plain structured text. Regex-based on purpose (no dependencies);
// good enough for small-business marketing pages. Output is untrusted text.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
  hellip: '…', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•',
};

export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    const key = e.toLowerCase();
    return Object.hasOwn(ENTITIES, key) ? ENTITIES[key] : m;
  });
}

const stripTags = (s) => s.replace(/<[^>]*>/g, ' ');
const clean = (s) => decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

const BLOCK = /<\/?(?:p|div|br|section|article|header|footer|nav|main|aside|ul|ol|table|tr|td|th|form|blockquote|figure|figcaption|address|dl|dt|dd|hr)\b[^>]*>/gi;

export function extractPage(html) {
  const src = String(html ?? '');
  const title = clean((src.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const withoutComments = src.replace(/<!--[\s\S]*?-->/g, ' ');
  const links = [];
  for (const m of withoutComments.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    links.push({ href: decodeEntities((m[1] ?? m[2] ?? m[3] ?? '').trim()), text: clean(m[4]) });
  }
  const body = withoutComments
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<h([1-6])\b[^>]*>/gi, (_, n) => `\n${'#'.repeat(Number(n))} `)
    .replace(/<\/h[1-6]\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(BLOCK, '\n');
  const text = decodeEntities(stripTags(body))
    .split('\n')
    .map((l) => l.replace(/[ \t\f\v ]+/g, ' ').trim())
    .filter((l) => l && !/^#+$/.test(l) && l !== '-')
    .join('\n');
  const tels = links.filter((l) => /^tel:/i.test(l.href)).map((l) => ({ number: l.href.slice(4), text: l.text }));
  const mailtos = links.filter((l) => /^mailto:/i.test(l.href)).map((l) => l.href.slice(7).split('?')[0]);
  return { title, text, links, tels, mailtos };
}

// Nav/footer boilerplate: lines on ≥ minPages pages stay on the first page
// (the homepage, so a footer phone/address remains quotable) and are
// dropped from the rest.
export function dropRepeatedLines(pages, minPages = 3) {
  if (pages.length < minPages) return pages;
  const count = new Map();
  for (const p of pages) for (const l of new Set(p.text.split('\n'))) count.set(l, (count.get(l) || 0) + 1);
  return pages.map((p, i) => (i === 0 ? p : { ...p, text: p.text.split('\n').filter((l) => count.get(l) < minPages).join('\n') }));
}

export const TEXT_CAP = 400 * 1024;

export function capText(pages, cap = TEXT_CAP) {
  let left = cap;
  return pages.map((p) => {
    const text = p.text.slice(0, Math.max(0, left));
    left -= text.length;
    return { ...p, text };
  });
}
