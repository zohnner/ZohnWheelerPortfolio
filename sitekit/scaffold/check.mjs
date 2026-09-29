// The fact checker. Every fact in a content file must be backed by a
// provenance entry whose quote really occurs in its source (a fetched page,
// the Muse stub, or Zohn's note) and contains the value. Unbacked facts are
// removed; fact-like wording in copy is flagged. Pure: no file I/O.

import { norm, words, wordsMatch, phoneDigits, numbersIn, includesToken } from './match.mjs';
import { museText } from './facts.mjs';
import { validateContent } from '../validate.mjs';

const SCALARS = {
  phone: 'phone', email: 'exact', address: 'words', city: 'words', hours: 'words',
  founded: 'number', license: 'words', rating: 'number', reviewCount: 'number',
  googleMapsUrl: 'exact', emergency: 'flag',
};
const ARRAYS = { trust: 'words', reviews: 'review', gallery: 'gallery', services: 'named', areas: 'named' };
const FLAG_WORDS = {
  'business.emergency': /emergency|24\s*\/\s*7|24 hours/i,
  'financing.enabled': /financ|payment plan/i,
};

export function factEntries(content) {
  const out = [];
  const b = content.business || {};
  for (const [key, kind] of Object.entries(SCALARS)) {
    const v = b[key];
    if (v === undefined || v === null || v === '' || v === false) continue;
    out.push({ path: `business.${key}`, value: v, kind });
  }
  for (const [key, kind] of Object.entries(ARRAYS)) {
    (Array.isArray(content[key]) ? content[key] : []).forEach((v, i) => out.push({ path: `${key}[${i}]`, value: v, kind }));
  }
  if (content.financing?.enabled === true) out.push({ path: 'financing.enabled', value: true, kind: 'flag' });
  return out;
}

export function sourceText(source, brief) {
  if (source === 'muse') return museText(brief.stub);
  if (source === 'note') return brief.note || '';
  if (typeof source === 'string' && source.startsWith('site:')) {
    const pages = Array.isArray(brief.pages) ? brief.pages : [];
    const page = pages.find((p) => p && `site:${p.path}` === source);
    return page ? `${page.title}\n${page.text}` : null;
  }
  return null;
}

export function valueInQuote(fact, quote) {
  const v = fact.value;
  switch (fact.kind) {
    case 'phone': {
      const d = phoneDigits(v);
      return d.length === 10 && phoneDigits(quote).includes(d);
    }
    // A bare digit run (e.g. "555" plucked from a dot- or dash-delimited
    // phone number) satisfies includesToken's punctuation-boundary rule on
    // its own, so a number fact also requires its quote to contain at
    // least one alphabetic word (e.g. "review_count=112", "since 2004") —
    // real quotes for founded/rating/reviewCount always have one.
    case 'number': return numbersIn(quote).includes(Number(v)) && words(quote).some((w) => /[a-z]/.test(w));
    case 'exact': return includesToken(quote, v);
    case 'flag': return FLAG_WORDS[fact.path]?.test(quote) ?? false;
    case 'named': return wordsMatch(v?.name, quote);
    case 'review':
      return includesToken(quote, v?.text)
        && wordsMatch(v?.name, quote)
        && (v?.rating === undefined || numbersIn(quote).includes(Number(v.rating)));
    case 'gallery': return Boolean(v?.caption) && wordsMatch(v.caption, quote);
    default: return wordsMatch(v, quote);
  }
}

export function factProblem(fact, entry, brief) {
  if (!entry || typeof entry !== 'object') return 'no provenance entry';
  const { source, quote } = entry;
  if (typeof quote !== 'string' || !quote.trim()) return 'provenance has no quote';
  if (fact.kind === 'review' && !(source === 'note' || String(source).startsWith('site:'))) {
    return 'reviews must come from the business’s own site or the note';
  }
  const text = sourceText(source, brief);
  if (text === null) return `unknown source "${source}"`;
  if (!includesToken(text, quote)) return `quote not found in ${source}`;
  if (!valueInQuote(fact, quote)) return 'value does not appear in the quote';
  return null;
}

export function copyFields(c) {
  const out = [];
  const add = (path, text) => { if (typeof text === 'string' && text.trim()) out.push({ path, text }); };
  add('hero.headline', c.hero?.headline);
  add('hero.sub', c.hero?.sub);
  (Array.isArray(c.services) ? c.services : []).forEach((s, i) => { add(`services[${i}].summary`, s?.summary); add(`services[${i}].body`, s?.body); });
  (Array.isArray(c.areas) ? c.areas : []).forEach((a, i) => add(`areas[${i}].intro`, a?.intro));
  (Array.isArray(c.whyUs) ? c.whyUs : []).forEach((w, i) => { add(`whyUs[${i}].title`, w?.title); add(`whyUs[${i}].text`, w?.text); });
  (Array.isArray(c.faq) ? c.faq : []).forEach((f, i) => { add(`faq[${i}].q`, f?.q); add(`faq[${i}].a`, f?.a); });
  for (const [k, v] of Object.entries(c.copy || {})) add(`copy.${k}`, v);
  add('banner.text', c.banner?.text);
  add('financing.text', c.financing?.text);
  return out;
}

const COPY_PATTERNS = [
  [/\b(?:19|20)\d{2}\b/g, 'number'],
  [/\b(?:since|established|founded)\b/gi, 'keyword'],
  [/\b(?:licensed|insured|bonded|certified|accredited|award(?:-winning|s)?|best in)\b|#1\b/gi, 'keyword'],
  [/\b\d(?:\.\d)?\s*stars?\b/gi, 'number'],
  [/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, 'phone'],
  [/\b\d+(?:\.\d+)?\s*%/g, 'number'],
];

export function copyWarnings(content, facts) {
  const corpus = facts.map((f) => `${f.value !== null && typeof f.value === 'object' ? JSON.stringify(f.value) : f.value}\n${f.quote}`).join('\n');
  const corpusNorm = norm(corpus);
  const corpusNums = new Set(numbersIn(corpus));
  const corpusPhones = facts.flatMap((f) => [phoneDigits(String(f.value)), phoneDigits(f.quote)]);
  const backed = (kind, match) => {
    if (kind === 'keyword') return corpusNorm.includes(norm(match));
    if (kind === 'phone') { const d = phoneDigits(match); return corpusPhones.some((p) => p.includes(d)); }
    return numbersIn(match).every((n) => corpusNums.has(n));
  };
  const out = [];
  const seen = new Set();
  for (const { path, text } of copyFields(content)) {
    for (const [re, kind] of COPY_PATTERNS) {
      for (const m of text.matchAll(re)) {
        const key = `${path}|${m[0].toLowerCase()}`;
        if (seen.has(key) || backed(kind, m[0])) continue;
        seen.add(key);
        out.push(`${path}: "${m[0]}" reads like a fact but isn't backed by a proven fact`);
      }
    }
  }
  return out;
}

const ARRAY_PATH = /^(\w+)\[(\d+)\]$/;

function removePath(c, path) {
  const a = path.match(ARRAY_PATH);
  if (a) { c[a[1]].splice(Number(a[2]), 1); return; }
  const [obj, key] = path.split('.');
  if (c[obj]) delete c[obj][key];
}

export function checkScaffold({ content, provenance, brief }) {
  const out = structuredClone(content);
  const prov = provenance && typeof provenance === 'object' ? provenance : {};
  const dropped = [];
  const kept = [];
  for (const fact of factEntries(out)) {
    const entry = Object.hasOwn(prov, fact.path) ? prov[fact.path] : undefined;
    const reason = factProblem(fact, entry, brief);
    if (reason) dropped.push({ path: fact.path, value: fact.value, reason });
    else kept.push({ path: fact.path, value: fact.value, source: entry.source, quote: entry.quote, entry });
  }
  // Highest index first so earlier indexes stay valid while splicing.
  for (const d of [...dropped].reverse()) removePath(out, d.path);
  const shift = (path) => {
    const m = path.match(ARRAY_PATH);
    if (!m) return path;
    const n = Number(m[2]);
    const lower = dropped.filter((d) => { const x = d.path.match(ARRAY_PATH); return x && x[1] === m[1] && Number(x[2]) < n; }).length;
    return `${m[1]}[${n - lower}]`;
  };
  const facts = kept.map(({ path, value, source, quote }) => ({ path: shift(path), value, source, quote }));
  const newProv = Object.fromEntries(kept.map((k) => [shift(k.path), k.entry]));
  return { content: out, provenance: newProv, dropped, warnings: copyWarnings(out, facts), facts };
}

export function scaffoldStatus({ validation, dropped, warnings, briefStatus }) {
  if (validation.errors.length) return 'blocked';
  if (dropped.length || warnings.length || validation.warnings.length || briefStatus !== 'ok') return 'needs-look';
  return 'ready';
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function parse(text, what) {
  if (text === null || text === undefined) return { missing: true };
  try { return { value: JSON.parse(text) }; } catch (err) { return { error: `${what} is not valid JSON: ${err.message}` }; }
}

export function runCheck({ slug, contentText, provenanceText, briefText, fileExists }) {
  const b = parse(briefText, 'brief');
  const brief = b.value;
  const base = { slug, name: slug, briefStatus: brief?.status || 'missing', fetchLog: brief?.fetchLog || [] };
  const blocked = (error) => ({ ...base, status: 'blocked', error, facts: [], dropped: [], warnings: [], validation: { errors: [], warnings: [] }, changed: false });
  if (b.missing) return blocked('no brief — run scaffold first');
  if (b.error) return blocked(b.error);
  if (!isObject(brief)) return blocked('brief must be a JSON object');
  const c = parse(contentText, 'content file');
  if (c.missing) return blocked(`no content file at sites/${slug}.json`);
  if (c.error) return blocked(c.error);
  if (!isObject(c.value)) return blocked('content file must be a JSON object');
  const p = parse(provenanceText, 'provenance file');
  if (p.error) return blocked(p.error);
  const provenance = p.missing ? {} : p.value;
  if (!isObject(provenance)) return blocked('provenance file must be a JSON object');

  const r = checkScaffold({ content: c.value, provenance, brief });
  const validation = validateContent(r.content, { slug, fileExists });
  return {
    ...base,
    name: r.content.business?.name || slug,
    ...r,
    validation,
    changed: JSON.stringify(r.content) !== JSON.stringify(c.value),
    status: scaffoldStatus({ validation, dropped: r.dropped, warnings: r.warnings, briefStatus: base.briefStatus }),
  };
}
