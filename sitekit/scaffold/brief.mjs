// sitekit/scaffold/brief.mjs
// Gather (fetch → extract → pattern facts) into a brief, render it for the
// writer, and assemble the deterministic --no-ai content file. No file I/O.

import { fetchSite } from './fetchSite.mjs';
import { extractPage, dropRepeatedLines, capText } from './extract.mjs';
import { extractFacts, museText } from './facts.mjs';
import { getPreset } from '../presets/index.mjs';

const MIN_TEXT = 200;

// A "stub" is a content file that scaffold --no-ai is still safe to
// overwrite: no hero, no non-empty reviews or trust badges, and no area has
// been given a real intro. This is exactly what stubFromProspect() (in
// sitekit/admin.mjs) produces, and it's how the CLI tells an untouched
// prospect apart from a filled-in client file it must never clobber.
export function isStub(content) {
  const c = content && typeof content === 'object' ? content : {};
  if (c.hero && typeof c.hero === 'object' && Object.keys(c.hero).length > 0) return false;
  if (Array.isArray(c.reviews) && c.reviews.length > 0) return false;
  if (Array.isArray(c.trust) && c.trust.length > 0) return false;
  if (Array.isArray(c.areas) && c.areas.some((a) => a && typeof a.intro === 'string' && a.intro.trim())) return false;
  return true;
}

export function briefStatus({ siteUrl, blocked, pages }) {
  if (!siteUrl) return 'no-site';
  if (blocked) return `blocked (${blocked})`;
  const chars = pages.reduce((n, p) => n + p.text.length, 0);
  return chars < MIN_TEXT ? 'partial (little text)' : 'ok';
}

export async function gather({ slug, stub, fetch, now = new Date() }) {
  const preset = getPreset(stub.industry);
  const siteUrl = stub.outreach?.currentSite || '';
  let pages = [];
  let fetchLog = [];
  let blocked = null;
  if (siteUrl) {
    const r = await fetchSite(siteUrl, { fetch, serviceNames: preset.services.map((s) => s.name) });
    fetchLog = r.log;
    blocked = r.blocked;
    pages = capText(dropRepeatedLines(r.pages.map((p) => ({ path: p.path, ...extractPage(p.html) }))));
  }
  const facts = extractFacts({ pages, stub, presetServices: preset.services, year: now.getFullYear() });
  return {
    slug,
    generatedAt: now.toISOString(),
    status: briefStatus({ siteUrl, blocked, pages }),
    siteUrl,
    stub,
    note: stub.outreach?.note || '',
    pages: pages.map(({ path, title, text }) => ({ path, title, text })),
    facts,
    fetchLog,
  };
}

const cell = (v) => (v !== null && typeof v === 'object' ? `${v.name}: ${v.text}` : String(v))
  .replace(/\|/g, '\\|')
  .replace(/\s*\n\s*/g, ' / ');

function factRows(facts) {
  const rows = [];
  for (const [key, f] of Object.entries(facts)) {
    if (Array.isArray(f)) f.forEach((x, i) => rows.push([`${key}[${i}]`, x.value, x.source, x.quote]));
    else rows.push([key, f.value, f.source, f.quote]);
  }
  return rows;
}

export function renderBriefMd(brief) {
  const rows = factRows(brief.facts);
  const out = [
    `# Brief: ${brief.stub.business?.name || brief.slug} (${brief.slug})`,
    '',
    `Status: ${brief.status}`,
    `Generated: ${brief.generatedAt}`,
    `Industry: ${brief.stub.industry || 'generic'}`,
    `Site: ${brief.siteUrl || '(none)'}`,
    '',
    '## Stub (source: muse)',
    '',
    '```',
    museText(brief.stub),
    '```',
    '',
    '## Note from Zohn (source: note)',
    '',
    brief.note || '(none)',
    '',
    '## Pattern facts',
    '',
    ...(rows.length
      ? ['| Fact | Value | Source | Quote |', '|---|---|---|---|', ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)]
      : ['(none found)']),
    '',
    '## Fetch log',
    '',
    ...(brief.fetchLog.length ? brief.fetchLog.map((l) => `- ${l}`) : ['(no fetch)']),
    '',
  ];
  for (const p of brief.pages) out.push(`## site:${p.path} — ${p.title}`, '', p.text, '');
  return out.join('\n');
}

const BUSINESS_FACTS = ['phone', 'email', 'address', 'city', 'founded', 'license', 'rating', 'reviewCount', 'googleMapsUrl'];
const prov = (f) => ({ value: f.value, source: f.source, quote: f.quote });

// Stub + pattern facts. Copy (headline, service text, FAQ…) is left unset so
// the industry preset supplies it at render time.
export function noAiContent(brief) {
  const { stub, facts } = brief;
  const content = structuredClone(stub);
  content.business = { ...(content.business || {}) };
  const provenance = {};
  for (const key of BUSINESS_FACTS) {
    const f = facts[key];
    if (!f) continue;
    content.business[key] = f.value;
    provenance[`business.${key}`] = prov(f);
  }
  if (facts.services.length) {
    content.services = facts.services.map((s) => ({ slug: s.slug, name: s.value }));
    facts.services.forEach((s, i) => { provenance[`services[${i}]`] = prov(s); });
  }
  const museCity = stub.business?.city;
  (content.areas || []).forEach((a, i) => {
    if (museCity && a.name === museCity) provenance[`areas[${i}]`] = { value: a.name, source: 'muse', quote: `city=${museCity}` };
  });
  if (facts.testimonials.length) {
    content.reviews = facts.testimonials.map((t) => ({ name: t.value.name, text: t.value.text }));
    facts.testimonials.forEach((t, i) => { provenance[`reviews[${i}]`] = prov(t); });
  }
  return { content, provenance };
}
